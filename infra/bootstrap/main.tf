# Bootstrap: run ONCE per account with LOCAL state, before any environment.
#   cd infra/bootstrap && terraform init && terraform apply
# Creates the remote state bucket (versioned + encrypted) and the DynamoDB
# lock table that every environment root then uses.
terraform {
  required_version = ">= 1.9.0"
  # Initially created with local state; bootstrap.sh migrates it to the state
  # bucket created here.
  backend "s3" {}
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project = "openvault"
      Layer   = "terraform-bootstrap"
      Owner   = var.owner
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  github_sub = "repo:${var.github_repo}"
  tags       = { Project = "openvault", Layer = "terraform-bootstrap", Owner = var.owner }
}

resource "aws_s3_bucket" "terraform_state" { #checkov:skip=CKV_AWS_18:State bucket is itself the logging target source; self-logging provides no additional signal
  bucket        = "${var.name_prefix}-tfstate"
  force_destroy = false

  tags = { Name = "${var.name_prefix}-tfstate" }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket                  = aws_s3_bucket.terraform_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = "${var.name_prefix}-tf-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = { Name = "${var.name_prefix}-tf-locks" }
}

# GitHub's OIDC provider is account-global: only bootstrap owns it. Environment
# roots create their own deploy roles and reference this deterministic ARN.
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a8aefa6054556c9ea8c9a25fe42c1e0a0f2c",
  ]

  lifecycle {
    prevent_destroy = true
  }

  tags = local.tags
}

locals {
  build_trust = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRoleWithWebIdentity"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Condition = {
        StringEquals = { "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com" }
        StringLike   = { "token.actions.githubusercontent.com:sub" = "${local.github_sub}:ref:refs/heads/main" }
      }
    }]
  })
  plan_trust = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRoleWithWebIdentity"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Condition = {
        StringEquals = { "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com" }
        StringLike   = { "token.actions.githubusercontent.com:sub" = "${local.github_sub}:pull_request" }
      }
    }]
  })
  apply_trust = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRoleWithWebIdentity"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Condition = {
        StringEquals = { "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com" }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = [
            "${local.github_sub}:environment:staging",
            "${local.github_sub}:environment:production",
          ]
        }
      }
    }]
  })
}

resource "aws_iam_role" "github_build" {
  name                 = "${var.name_prefix}-github-build"
  assume_role_policy   = local.build_trust
  max_session_duration = 3600
  tags                 = local.tags
}

resource "aws_iam_role_policy" "github_build" {
  name = "ecr-push-project-images"
  role = aws_iam_role.github_build.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability", "ecr:CompleteLayerUpload",
          "ecr:InitiateLayerUpload", "ecr:PutImage", "ecr:UploadLayerPart",
          "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer",
        ]
        Resource = "arn:aws:ecr:${var.region}:${local.account_id}:repository/openvault-*"
      },
    ]
  })
}

resource "aws_iam_role" "github_terraform_plan" {
  name               = "${var.name_prefix}-github-terraform-plan"
  assume_role_policy = local.plan_trust
  tags               = local.tags
}

resource "aws_iam_role_policy" "github_terraform_plan" {
  name = "terraform-read-only"
  role = aws_iam_role.github_terraform_plan.id
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
        "bedrock:Get*", "bedrock:List*", "dynamodb:Describe*", "ses:Get*",
        "ses:List*", "budgets:ViewBudget", "sts:GetCallerIdentity",
        "cloudwatch:Describe*", "cloudwatch:List*", "sns:Get*", "sns:List*",
      ]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role" "github_terraform_apply" {
  name               = "${var.name_prefix}-github-terraform-apply"
  assume_role_policy = local.apply_trust
  tags               = local.tags
}

resource "aws_iam_role_policy_attachment" "github_terraform_apply_power_user" {
  role       = aws_iam_role.github_terraform_apply.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

# PowerUserAccess intentionally lacks IAM. Add only project-prefixed IAM
# objects; the account-global OIDC provider remains bootstrap-owned.
resource "aws_iam_role_policy" "github_terraform_apply_iam" {
  name = "project-prefixed-iam"
  role = aws_iam_role.github_terraform_apply.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:UpdateRole",
          "iam:UpdateAssumeRolePolicy", "iam:TagRole", "iam:UntagRole",
          "iam:ListRolePolicies", "iam:ListAttachedRolePolicies",
          "iam:ListInstanceProfilesForRole", "iam:PutRolePolicy",
          "iam:GetRolePolicy", "iam:DeleteRolePolicy", "iam:AttachRolePolicy",
          "iam:DetachRolePolicy", "iam:CreatePolicy", "iam:DeletePolicy",
          "iam:GetPolicy", "iam:GetPolicyVersion", "iam:CreatePolicyVersion",
          "iam:DeletePolicyVersion", "iam:ListPolicyVersions", "iam:TagPolicy",
          "iam:UntagPolicy", "iam:CreateInstanceProfile", "iam:DeleteInstanceProfile",
          "iam:GetInstanceProfile", "iam:AddRoleToInstanceProfile",
          "iam:RemoveRoleFromInstanceProfile", "iam:TagInstanceProfile",
          "iam:UntagInstanceProfile",
        ]
        Resource = [
          "arn:aws:iam::${local.account_id}:role/openvault-*",
          "arn:aws:iam::${local.account_id}:policy/openvault-*",
          "arn:aws:iam::${local.account_id}:instance-profile/openvault-*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = "arn:aws:iam::${local.account_id}:role/openvault-*"
      },
      {
        Effect   = "Allow"
        Action   = ["iam:CreateServiceLinkedRole", "iam:DeleteServiceLinkedRole"]
        Resource = "*"
        Condition = {
          StringLike = {
            "iam:AWSServiceName" = [
              "ecs.amazonaws.com", "autoscaling.amazonaws.com",
              "elasticloadbalancing.amazonaws.com", "rds.amazonaws.com",
              "elasticache.amazonaws.com",
            ]
          }
        }
      },
    ]
  })
}
