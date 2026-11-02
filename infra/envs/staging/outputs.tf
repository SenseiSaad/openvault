output "fqdn" {
  description = "The HTTPS origin served by this environment."
  value       = module.dns_tls.fqdn
}

output "name_servers" {
  description = "NS records to delegate v2.<domain> from the parent DNS provider."
  value       = module.dns_tls.zone_name_servers
}

output "db_endpoint" {
  description = "RDS endpoint for DATABASE_URL (password comes from the Secrets Manager secret below)."
  value       = module.data.db_endpoint
}

output "db_master_secret_arn" {
  description = "Fetch the master password with: aws secretsmanager get-secret-value --secret-id <arn>"
  value       = module.data.db_master_secret_arn
}

output "documents_bucket" {
  description = "S3 bucket for documents (per-tenant prefixes: <company-slug>/...)."
  value       = module.data.documents_bucket
}

output "backups_bucket" {
  description = "S3 bucket for database dumps."
  value       = module.data.backups_bucket
}

output "ecr_repositories" {
  description = "ECR URLs to push api/web images to."
  value       = module.registry.repository_urls
}

output "cluster_name" {
  description = "ECS cluster for deploy tooling."
  value       = module.ecs.cluster_name
}

output "task_definition_families" {
  description = "Task def families CI updates (api/worker/web/migrate/backup)."
  value       = module.ecs.task_definition_families
}

output "deploy_role_arn" {
  description = "OIDC role for the deploy workflow."
  value       = module.iam_oidc.deploy_role_arn
}

output "terraform_plan_role_arn" {
  description = "Read-only OIDC role for terraform-plan PR checks."
  value       = module.iam_oidc.terraform_plan_role_arn
}

output "terraform_apply_role_arn" {
  description = "OIDC role for the manual terraform-apply workflow."
  value       = module.iam_oidc.terraform_apply_role_arn
}

output "sns_alerts_topic_arn" {
  description = "SNS topic all alarms publish to."
  value       = module.observability.sns_topic_arn
}
