# Stateful layer: RDS PostgreSQL 16 (pgvector-capable), ElastiCache Redis,
# documents bucket and backups bucket. Everything in the isolated private
# subnets except S3 (regional service).
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
  common_tags = merge(var.tags, { Layer = "data" })
}

# ------------------------------------------------------------------ RDS
resource "aws_db_parameter_group" "postgres" {
  name_prefix = "${var.name_prefix}-pg-"
  family      = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_subnet_group" "this" {
  name_prefix = "${var.name_prefix}-"
  subnet_ids  = var.private_subnet_ids

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-db-subnets" })
}

resource "aws_db_instance" "postgres" {
  identifier     = "${var.name_prefix}-postgres"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage_gb
  max_allocated_storage = var.db_max_allocated_storage_gb
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  # AWS-managed master password lives in Secrets Manager (NOT in tf state).
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.this.name
  parameter_group_name   = aws_db_parameter_group.postgres.name
  vpc_security_group_ids = [var.rds_sg_id]
  publicly_accessible    = false
  multi_az               = var.db_multi_az

  backup_retention_period = var.db_backup_retention_days
  backup_window           = "19:00-20:00"
  maintenance_window      = "sun:20:30-sun:21:30"
  copy_tags_to_snapshot   = true

  deletion_protection       = var.db_deletion_protection
  skip_final_snapshot       = var.db_skip_final_snapshot
  final_snapshot_identifier = var.db_skip_final_snapshot ? null : "${var.name_prefix}-postgres-final"

  auto_minor_version_upgrade = true

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-postgres" })
}

# ------------------------------------------------------------- ElastiCache
resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name_prefix}-redis-subnets"
  subnet_ids = var.private_subnet_ids
}

# Single-node replication group = same price as a cluster node, but supports
# at-rest encryption and snapshots properly.
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.name_prefix}-redis"
  description          = "OpenVault cache + rate-limit + Celery broker"
  engine               = "redis"
  engine_version       = var.redis_engine_version
  node_type            = var.redis_node_type
  num_cache_clusters   = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.this.name
  security_group_ids   = [var.redis_sg_id]

  at_rest_encryption_enabled = true
  snapshot_retention_limit   = var.redis_snapshot_retention_days
  apply_immediately          = true

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-redis" })
}

# ------------------------------------------------------------- S3 buckets
resource "aws_s3_bucket" "documents" {
  bucket        = "${var.name_prefix}-documents-${var.account_suffix}"
  force_destroy = var.force_destroy_buckets

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-documents" })
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = "alias/aws/s3" # AWS-managed KMS key: no extra cost
    }
  }
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket                  = aws_s3_bucket.documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Presigned browser PUTs need CORS against the app origin.
resource "aws_s3_bucket_cors_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_logging" "documents" {
  bucket = aws_s3_bucket.documents.id

  target_bucket = var.access_logs_bucket_id
  target_prefix = "documents/"
}

# TLS-only access policy (defense in depth on top of block-public-access).
resource "aws_s3_bucket_policy" "documents_tls_only" {
  bucket = aws_s3_bucket.documents.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource = [
        aws_s3_bucket.documents.arn,
        "${aws_s3_bucket.documents.arn}/*",
      ]
      Condition = {
        Bool = { "aws:SecureTransport" = "false" }
      }
    }]
  })
}

resource "aws_s3_bucket" "backups" {
  bucket        = "${var.name_prefix}-backups-${var.account_suffix}"
  force_destroy = var.force_destroy_buckets

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-backups" })
}

resource "aws_s3_bucket_logging" "backups" {
  bucket = aws_s3_bucket.backups.id

  target_bucket = var.access_logs_bucket_id
  target_prefix = "backups/"
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = "alias/aws/s3" # AWS-managed KMS key: no extra cost
    }
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "retention"
    status = "Enabled"
    filter {}
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
    expiration {
      days = var.backup_retention_days
    }
  }
}
