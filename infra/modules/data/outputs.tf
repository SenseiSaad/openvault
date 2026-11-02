output "db_endpoint" {
  description = "RDS writer endpoint (host:port)."
  value       = aws_db_instance.postgres.address
}

output "db_port" {
  description = "RDS port."
  value       = aws_db_instance.postgres.port
}

output "db_master_secret_arn" {
  description = "Secrets Manager ARN holding the RDS master credentials (AWS-managed; never in tf state)."
  value       = aws_db_instance.postgres.master_user_secret[0].secret_arn
}

output "redis_endpoint" {
  description = "ElastiCache primary endpoint (host)."
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "documents_bucket" {
  description = "Documents bucket name (per-tenant prefixes live under <company-slug>/)."
  value       = aws_s3_bucket.documents.id
}

output "backups_bucket" {
  description = "Backups bucket name."
  value       = aws_s3_bucket.backups.id
}

output "documents_bucket_arn" {
  description = "Documents bucket ARN (task-role policy)."
  value       = aws_s3_bucket.documents.arn
}

output "backups_bucket_arn" {
  description = "Backups bucket ARN (task-role policy)."
  value       = aws_s3_bucket.backups.arn
}
