output "alb_dns_name" {
  description = "ALB DNS name for the Route 53 alias records."
  value       = aws_lb.this.dns_name
}

output "alb_zone_id" {
  description = "ALB hosted zone id for Route 53 alias records."
  value       = aws_lb.this.zone_id
}

output "cluster_name" {
  description = "ECS cluster name (used by deploy tooling)."
  value       = aws_ecs_cluster.this.name
}

output "service_names" {
  description = "ECS service names consumed by deploy/rollback tooling."
  value = {
    api    = aws_ecs_service.api.name
    web    = aws_ecs_service.web.name
    worker = aws_ecs_service.worker.name
  }
}

output "task_definition_families" {
  description = "Task def families for CI: api, worker, web, migrate, backup."
  value = {
    api     = aws_ecs_task_definition.api.family
    worker  = aws_ecs_task_definition.worker.family
    web     = aws_ecs_task_definition.web.family
    migrate = aws_ecs_task_definition.migrate.family
    backup  = aws_ecs_task_definition.backup.family
  }
}

output "task_role_arn" {
  description = "App task role arn (Bedrock/S3/SSM permissions)."
  value       = aws_iam_role.app_task.arn
}

output "api_log_group" {
  description = "API log group for metric filters and alarms."
  value       = aws_cloudwatch_log_group.services["api"].name
}

output "alb_arn_suffix" {
  description = "ALB arn suffix for CloudWatch metric dimensions."
  value       = aws_lb.this.arn_suffix
}
