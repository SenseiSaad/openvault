# GitHub OIDC: no static AWS keys anywhere. Four roles with distinct blast
# radius. Each role trusts only the ref/environment it actually runs from:
# build = main, deploy/apply = this environment, plan = pull_request.
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

  # Filter ONE user-supplied subject list per role. This prevents a
  # pull_request token (or a staging environment token) from assuming the
  # production apply role, even though all subjects live in one variable.
  env_subject_suffix       = var.name_prefix == "openvault-prod" ? ":environment:production" : ":environment:staging"
  build_subjects           = [for s in var.allowed_subjects : s if endswith(s, ":ref:refs/heads/main")]
  deploy_subjects          = [for s in var.allowed_subjects : s if endswith(s, local.env_subject_suffix)]
  plan_subjects            = [for s in var.allowed_subjects : s if endswith(s, ":pull_request")]
  apply_subjects           = [for s in var.allowed_subjects : s if endswith(s, local.env_subject_suffix)]
  github_oidc_provider_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : var.oidc_provider_arn
  managed_oidc_provider    = var.create_oidc_provider ? [local.github_oidc_provider_arn] : []

  oidc_trust = {
    for role, subjects in {
      build  = local.build_subjects
      deploy = local.deploy_subjects
      plan   = local.plan_subjects
      apply  = local.apply_subjects
      } : role => jsonencode({
        Version = "2012-10-17"
        Statement = [{
          Effect    = "Allow"
          Action    = "sts:AssumeRoleWithWebIdentity"
          Principal = { Federated = local.github_oidc_provider_arn }
          Condition = {
            StringEquals = {
              "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            }
            StringLike = {
              "token.actions.githubusercontent.com:sub" = subjects
            }
          }
        }]
    })
  }
}

resource "aws_iam_openid_connect_provider" "github" {
  count           = var.create_oidc_provider ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = local.thumbprints

  lifecycle {
    prevent_destroy = true
  }

  tags = local.common_tags
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "deploy" {
  name                 = "${var.name_prefix}-github-deploy"
  assume_role_policy   = local.oidc_trust["deploy"]
  max_session_duration = 3600

  tags = local.common_tags
}

data "aws_iam_policy_document" "deploy_permissions" {
  statement {
    sid       = "ECRLogin"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "ECRPush"
    effect = "Allow"
    actions = [
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
    sid    = "NightlyBackupTarget"
    effect = "Allow"
    actions = [
      "events:DescribeRule",
      "events:ListTargetsByRule",
      "events:PutTargets",
    ]
    resources = ["arn:aws:events:*:${data.aws_caller_identity.current.account_id}:rule/${var.name_prefix}-*"]
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

# Build-only role: pulls/pushes SHA-tagged images to both environment repos.
# It has no ECS, SSM, or Terraform permissions.
resource "aws_iam_role" "build" {
  name                 = "${var.name_prefix}-github-build"
  assume_role_policy   = local.oidc_trust["build"]
  max_session_duration = 3600

  tags = local.common_tags
}

data "aws_iam_policy_document" "build_permissions" {
  statement {
    sid       = "ECRLogin"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid    = "ECRPushBothEnvs"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = ["arn:aws:ecr:*:${data.aws_caller_identity.current.account_id}:repository/openvault-*"]
  }
}

resource "aws_iam_role_policy" "build" {
  name   = "github-build-permissions"
  role   = aws_iam_role.build.id
  policy = data.aws_iam_policy_document.build_permissions.json
}

resource "aws_iam_role" "terraform_plan" {
  name               = "${var.name_prefix}-github-terraform-plan"
  assume_role_policy = local.oidc_trust["plan"]

  tags = local.common_tags
}

resource "aws_iam_role_policy" "terraform_plan_read" {
  name = "terraform-plan-read"
  role = aws_iam_role.terraform_plan.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ec2:Describe*", "elasticloadbalancing:Describe*", "acm:Describe*",
        "acm:List*", "application-autoscaling:Describe*", "logs:Describe*",
        "logs:ListTags*", "events:Describe*", "events:List*", "kms:Describe*",
        "kms:List*", "ecr:Describe*", "ecs:Describe*", "rds:Describe*",
        "s3:List*", "s3:Get*", "iam:Get*", "iam:List*", "ssm:Describe*",
        "ssm:Get*", "elasticache:Describe*", "route53:Get*", "route53:List*",
        "bedrock:Get*", "bedrock:List*", "dynamodb:Describe*",
        "budgets:ViewBudget", "sts:GetCallerIdentity", "cloudwatch:Describe*",
        "cloudwatch:List*", "sns:Get*", "sns:List*",
      ]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role" "terraform_apply" {
  name               = "${var.name_prefix}-github-terraform-apply"
  assume_role_policy = local.oidc_trust["apply"]

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

# Terraform owns IAM roles/policies (task roles, GitHub OIDC provider), which
# PowerUserAccess deliberately excludes. This custom policy grants only the
# project-prefixed IAM objects plus the GitHub OIDC provider — not account-wide
# IAM. The apply role is still behind the protected GitHub environment.
resource "aws_iam_policy" "terraform_apply_iam" {
  name        = "${var.name_prefix}-github-terraform-apply-iam"
  description = "Create/refresh OpenVault IAM roles, policies, instance profiles and the GitHub OIDC provider."

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ProjectIamObjects"
        Effect = "Allow"
        Action = [
          "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:UpdateRole",
          "iam:UpdateAssumeRolePolicy", "iam:TagRole", "iam:UntagRole",
          "iam:ListRolePolicies", "iam:ListAttachedRolePolicies",
          "iam:ListInstanceProfilesForRole", "iam:PutRolePolicy",
          "iam:GetRolePolicy", "iam:DeleteRolePolicy", "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:CreatePolicy", "iam:DeletePolicy", "iam:GetPolicy",
          "iam:GetPolicyVersion", "iam:CreatePolicyVersion",
          "iam:DeletePolicyVersion", "iam:ListPolicyVersions",
          "iam:TagPolicy", "iam:UntagPolicy",
          "iam:CreateInstanceProfile", "iam:DeleteInstanceProfile",
          "iam:GetInstanceProfile", "iam:AddRoleToInstanceProfile",
          "iam:RemoveRoleFromInstanceProfile", "iam:TagInstanceProfile",
          "iam:UntagInstanceProfile",
          "iam:CreateOpenIDConnectProvider", "iam:DeleteOpenIDConnectProvider",
          "iam:GetOpenIDConnectProvider",
          "iam:UpdateOpenIDConnectProviderThumbprint",
          "iam:TagOpenIDConnectProvider", "iam:UntagOpenIDConnectProvider",
        ]
        Resource = concat(
          [
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.name_prefix}-*",
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/${var.name_prefix}-*",
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:instance-profile/${var.name_prefix}-*",
          ],
          local.managed_oidc_provider,
        )
      },
      {
        Sid      = "ListOidcProviders"
        Effect   = "Allow"
        Action   = ["iam:ListOpenIDConnectProviders", "iam:ListOpenIDConnectProviderTags"]
        Resource = "*"
      },
      {
        Sid      = "ProjectPassRole"
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.name_prefix}-*"
      },
      {
        Sid      = "ServiceLinkedRoles"
        Effect   = "Allow"
        Action   = ["iam:CreateServiceLinkedRole", "iam:DeleteServiceLinkedRole"]
        Resource = "*"
        Condition = {
          StringLike = {
            "iam:AWSServiceName" = [
              "ecs.amazonaws.com",
              "autoscaling.amazonaws.com",
              "elasticloadbalancing.amazonaws.com",
              "rds.amazonaws.com",
              "elasticache.amazonaws.com",
            ]
          }
        }
      },
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "terraform_apply_iam" {
  role       = aws_iam_role.terraform_apply.name
  policy_arn = aws_iam_policy.terraform_apply_iam.arn
}
