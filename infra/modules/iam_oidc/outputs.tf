output "deploy_role_arn" {
  description = "Environment-scoped role assumed by deploy/rollback workflows."
  value       = aws_iam_role.deploy.arn
}
