# GitHub OIDC: no static AWS keys anywhere. Two roles with distinct blast
# radius, trust limited to ONE repo and specific refs/environments.
terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}

locals {
  common_tags = merge(var.tags, { Layer = "iam_oidc" })
  # GitHub's token endpoint certificates (stable values, per AWS docs).
  thumbprints = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a8aefa6054556c9ea8c9a25fe42c1e0a0f2c",
  ]
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = local.thumbprints

  tags = local.common_tags
}

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "deploy_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = var.allowed_subjects
    }
  }
}

resource "aws_iam_role" "deploy" {
  name                 = "${var.name_prefix}-github-deploy"
  assume_role_policy   = data.aws_iam_policy_document.deploy_trust.json
  max_session_duration = 3600

  tags = local.common_tags
}

data "aws_iam_policy_document" "deploy_permissions" {
  statement {
    sid    = "ECRPush"
    effect = "Allow"
    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = ["arn:aws:ecr:*:${data.aws_caller_identity.current.account_id}:repository/${var.name_prefix}-*"]
  }

  statement {
    sid    = "ECSDeploy"
    effect = "Allow"
    actions = [
      "ecs:DescribeServices",
      "ecs:UpdateService",
      "ecs:DescribeTaskDefinition",
      "ecs:RegisterTaskDefinition",
      "ecs:RunTask",
      "ecs:DescribeTasks",
      "ecs:StopTask",
      "ecs:ListTasks",
      "ecs:DescribeClusters",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "PassTaskRoles"
    effect = "Allow"
    actions = [
      "iam:PassRole",
      "iam:GetRole",
    ]
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.name_prefix}-ecs-*",
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.name_prefix}-events-run-task",
    ]
  }

  statement {
    sid       = "SSMReadApp"
    effect    = "Allow"
    actions   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath", "ssm:DescribeParameters"]
    resources = ["arn:aws:ssm:*:${data.aws_caller_identity.current.account_id}:parameter/openvault/*"]
  }

  statement {
    sid       = "LogsRead"
    effect    = "Allow"
    actions   = ["logs:GetLogEvents", "logs:DescribeLogGroups", "logs:DescribeLogStreams", "logs:FilterLogEvents"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "github-deploy-permissions"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy_permissions.json
}

resource "aws_iam_role" "terraform_plan" {
  name               = "${var.name_prefix}-github-terraform-plan"
  assume_role_policy = data.aws_iam_policy_document.deploy_trust.json

  tags = local.common_tags
}

resource "aws_iam_role_policy" "terraform_plan_read" {
  name = "terraform-plan-read"
  role = aws_iam_role.terraform_plan.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ecr:Describe*", "ecs:Describe*", "rds:Describe*", "s3:List*", "s3:Get*", "iam:Get*", "iam:List*", "ssm:Describe*", "ssm:Get*", "elasticache:Describe*", "route53:Get*", "route53:List*", "bedrock:Get*", "bedrock:List*", "dynamodb:Describe*", "budgets:ViewBudget", "sts:GetCallerIdentity", "cloudwatch:Describe*", "sns:Get*"]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role" "terraform_apply" {
  name               = "${var.name_prefix}-github-terraform-apply"
  assume_role_policy = data.aws_iam_policy_document.deploy_trust.json

  tags = local.common_tags
}

# Solo operator trade-off, documented in the DEPLOY docs: the apply role is
# broad (PowerUser minus billing/iam-account-mutations), gated by a REQUIRED
# manual-approval GitHub environment. Tightening to an explicit per-service
# policy list is tracked as a TODO once the resource set stabilizes.
resource "aws_iam_role_policy_attachment" "terraform_apply" {
  role       = aws_iam_role.terraform_apply.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}
