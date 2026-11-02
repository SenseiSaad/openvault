# VPC with 2 AZs: public subnets (ALB + ECS tasks, NO NAT) and isolated
# private subnets (RDS + ElastiCache). ECS tasks in public subnets get public
# IPs and egress via the IGW — see docs/decisions/0004 (no-NAT trade-off).
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
  common_tags = merge(var.tags, { Layer = "network" })
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-vpc" })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-igw" })
}

resource "aws_subnet" "public" {
  count                   = var.az_count
  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true #checkov:skip=CKV_AWS_130:ECS tasks in public subnets by design (no NAT) — ADR 0004

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-public-${count.index + 1}"
    Tier = "public"
  })
}

resource "aws_subnet" "private" {
  count             = var.az_count
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.common_tags, {
    Name = "${var.name_prefix}-private-${count.index + 1}"
    Tier = "private-isolated"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-public-rt" })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  count          = var.az_count
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Private subnets: local routes only (no NAT gateway). RDS and Redis need no
# outbound internet; ECS tasks deliberately run in PUBLIC subnets instead.
resource "aws_route_table" "private" {
  count  = var.az_count
  vpc_id = aws_vpc.this.id

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-private-rt-${count.index + 1}" })
}

resource "aws_route_table_association" "private" {
  count          = var.az_count
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# ---------------------------------------------------------------- security groups
resource "aws_security_group" "alb" {
  name_prefix = "${var.name_prefix}-alb-"
  description = "ALB: HTTPS from the internet"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "HTTP (redirects to HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound (targets + certificate handling)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-alb-sg" })
}

resource "aws_security_group" "api" {
  name_prefix = "${var.name_prefix}-api-"
  description = "API service: only from the ALB"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "App port from ALB"
    from_port       = var.api_port
    to_port         = var.api_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress { #checkov:skip=CKV_AWS_382:Outbound HTTPS to Bedrock/SES/S3 is required; pinning egress CIDRs is not possible for AWS service APIs
    description = "All outbound: RDS/Redis inside VPC, Bedrock/SES/S3 via IGW"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-api-sg" })
}

resource "aws_security_group" "web" {
  name_prefix = "${var.name_prefix}-web-"
  description = "Frontend service: only from the ALB"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "Frontend port from ALB"
    from_port       = var.web_port
    to_port         = var.web_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "All outbound (backend API calls over the internet)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-web-sg" })
}

resource "aws_security_group" "worker" {
  name_prefix = "${var.name_prefix}-worker-"
  description = "Celery worker: no inbound, egress only"
  vpc_id      = aws_vpc.this.id

  egress {
    description = "All outbound: RDS/Redis inside VPC, S3/Bedrock via IGW"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-worker-sg" })
}

resource "aws_security_group" "rds" {
  name_prefix = "${var.name_prefix}-rds-"
  description = "PostgreSQL: only from api and worker services"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "PostgreSQL from api"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
  }

  ingress {
    description     = "PostgreSQL from worker"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.worker.id]
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-rds-sg" })
}

resource "aws_security_group" "redis" {
  name_prefix = "${var.name_prefix}-redis-"
  description = "Redis: only from api and worker services"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "Redis from api"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
  }

  ingress {
    description     = "Redis from worker"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.worker.id]
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-redis-sg" })
}

resource "aws_security_group" "model_host" {
  name_prefix = "${var.name_prefix}-modelhost-"
  description = "Optional Ollama host: port 11434 only from api/worker"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "Ollama from api"
    from_port       = 11434
    to_port         = 11434
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
  }

  ingress {
    description     = "Ollama from worker"
    from_port       = 11434
    to_port         = 11434
    protocol        = "tcp"
    security_groups = [aws_security_group.worker.id]
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-modelhost-sg" })
}


# Central access-logs bucket for ALB + S3 access logging (7-year-free tier
# storage; lifecycle trims to 365 days).
resource "aws_s3_bucket" "access_logs" { #checkov:skip=CKV_AWS_18:Access logs bucket cannot log to itself meaningfully; ALB logging lands here instead
  bucket        = "${var.name_prefix}-access-logs"
  force_destroy = false

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-access-logs" })
}

resource "aws_s3_bucket_public_access_block" "access_logs" {
  bucket                  = aws_s3_bucket.access_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = "alias/aws/s3"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  rule {
    id     = "expire-logs"
    status = "Enabled"
    filter {}
    expiration {
      days = 365
    }
  }
}

# S3 requires the log-delivery service to write via bucket policy grants.
# (caller identity is resolved by consumers via data sources in their own roots)

resource "aws_s3_bucket_policy" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [{
        Sid       = "S3ServerAccessLogsPolicy"
        Effect    = "Allow"
        Principal = { Service = "logging.s3.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.access_logs.arn}/*"
        Condition = {
          ArnLike = { "aws:SourceArn" = "arn:aws:s3:::${var.name_prefix}-*" }
        }
      }],
      [{
        Sid       = "ELBLogDelivery"
        Effect    = "Allow"
        Principal = { Service = "delivery.logs.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.access_logs.arn}/alb/*"
        Condition = {
          StringEquals = { "s3:x-amz-acl" = "bucket-owner-full-control" }
        }
        },
        {
          Sid       = "ELBLogDeliveryAclCheck"
          Effect    = "Allow"
          Principal = { Service = "delivery.logs.amazonaws.com" }
          Action    = "s3:GetBucketAcl"
          Resource  = aws_s3_bucket.access_logs.arn
      }]
    )
  })
}
