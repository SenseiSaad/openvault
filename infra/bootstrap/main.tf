# Bootstrap: run ONCE per account with LOCAL state, before any environment.
#   cd infra/bootstrap && terraform init && terraform apply
# Creates the remote state bucket (versioned + encrypted) and the DynamoDB
# lock table that every environment root then uses.
terraform {
  required_version = ">= 1.9.0"
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
