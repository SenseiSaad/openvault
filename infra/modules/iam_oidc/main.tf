# Environment-scoped GitHub OIDC deploy role. The account-global provider and
# shared build/plan/apply roles are owned by infra/bootstrap.
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
  common_tags     = merge(var.tags, { Layer = "iam_oidc" })
  aws_environment = var.github_environment == "production" ? "prod" : "staging"
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "deploy" {
  name = "${var.name_prefix}-github-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRoleWithWebIdentity"
      Principal = { Federated = var.oidc_provider_arn }
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:environment:${var.github_environment}"
        }
      }
    }]
  })

  max_session_duration = 3600
  tags                 = local.common_tags
}

data "aws_iam_policy_document" "deploy" {
  statement {
    sid    = "UpdateProjectServices"
    effect = "Allow"
    actions = [
      "ecs:DescribeClusters", "ecs:DescribeServices", "ecs:DescribeTasks",
      "ecs:ListTasks", "ecs:DescribeTaskDefinition", "ecs:RegisterTaskDefinition",
      "ecs:RunTask", "ecs:StopTask", "ecs:UpdateService",
    ]
    resources = ["*"]
  }

  statement {
    sid       = "UpdateNightlyBackupTarget"
    effect    = "Allow"
    actions   = ["events:DescribeRule", "events:ListTargetsByRule", "events:PutTargets"]
    resources = ["arn:aws:events:*:${data.aws_caller_identity.current.account_id}:rule/${var.name_prefix}-*"]
  }

  statement {
    sid     = "PassProjectTaskRoles"
    effect  = "Allow"
    actions = ["iam:PassRole", "iam:GetRole"]
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.name_prefix}-ecs-*",
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.name_prefix}-events-run-task",
    ]
  }

  statement {
    sid       = "ReadProjectTaskLogs"
    effect    = "Allow"
    actions   = ["logs:GetLogEvents", "logs:DescribeLogGroups", "logs:DescribeLogStreams", "logs:FilterLogEvents"]
    resources = ["arn:aws:logs:*:${data.aws_caller_identity.current.account_id}:log-group:/openvault/${local.aws_environment}/*"]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "github-deploy-permissions"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}
