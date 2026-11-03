output "state_bucket" {
  description = "Name of the S3 bucket holding all remote Terraform state."
  value       = aws_s3_bucket.terraform_state.id
}

output "lock_table" {
  description = "DynamoDB table used for Terraform state locking."
  value       = aws_dynamodb_table.terraform_locks.name
}

output "github_oidc_provider_arn" {
  description = "Account-global GitHub OIDC provider owned by bootstrap."
  value       = aws_iam_openid_connect_provider.github.arn
}

output "github_build_role_arn" {
  description = "ECR-only image build role."
  value       = aws_iam_role.github_build.arn
}

output "github_terraform_plan_role_arn" {
  description = "Read-only Terraform plan role."
  value       = aws_iam_role.github_terraform_plan.arn
}

output "github_terraform_apply_role_arn" {
  description = "Protected-environment Terraform apply role."
  value       = aws_iam_role.github_terraform_apply.arn
}
