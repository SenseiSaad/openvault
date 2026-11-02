# ECR repositories. Images are immutable (tags never reused — rollback safety),
# scanned on push, and pruned by lifecycle rule.
terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}

variable "name_prefix" {
  description = "Name prefix for the repositories."
  type        = string
}

variable "repositories" {
  description = "Repository names to create (api, web, ...)."
  type        = list(string)
}

variable "image_retention_count" {
  description = "How many tagged images to keep per repository."
  type        = number
  default     = 30
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default     = {}
}

resource "aws_ecr_repository" "this" {
  for_each = toset(var.repositories)

  name                 = "${var.name_prefix}-${each.key}"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS" # AWS-managed aws/ecr key: no extra cost
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-${each.key}", Layer = "registry" })
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each   = aws_ecr_repository.this
  repository = aws_ecr_repository.this[each.key].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 14 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 14
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep the last ${var.image_retention_count} tagged images"
        selection = {
          tagStatus      = "tagged"
          tagPatternList = ["*"]
          countType      = "imageCountMoreThan"
          countNumber    = var.image_retention_count
        }
        action = { type = "expire" }
      }
    ]
  })
}
