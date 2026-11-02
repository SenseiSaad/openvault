output "vpc_id" {
  description = "The VPC id."
  value       = aws_vpc.this.id
}

output "public_subnet_ids" {
  description = "Public subnet ids (ALB + ECS tasks with public IPs)."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Isolated private subnet ids (RDS + ElastiCache)."
  value       = aws_subnet.private[*].id
}

output "security_groups" {
  description = "Security group ids keyed by role."
  value = {
    alb        = aws_security_group.alb.id
    api        = aws_security_group.api.id
    web        = aws_security_group.web.id
    worker     = aws_security_group.worker.id
    rds        = aws_security_group.rds.id
    redis      = aws_security_group.redis.id
    model_host = aws_security_group.model_host.id
  }
}

output "access_logs_bucket_id" {
  description = "Central access-logs bucket for ALB and S3 logging."
  value       = aws_s3_bucket.access_logs.id
}
