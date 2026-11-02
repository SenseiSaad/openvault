output "deploy_role_arn" {
  description = "Role assumed by deploy/rollback workflows (ECR push, ECS update)."
  value       = aws_iam_role.deploy.arn
}

output "terraform_plan_role_arn" {
  description = "Read-only role assumed by terraform-plan PR checks."
  value       = aws_iam_role.terraform_plan.arn
}

output "terraform_apply_role_arn" {
  description = "Role assumed by the manual terraform-apply workflow (protected environment)."
  value       = aws_iam_role.terraform_apply.arn
}
