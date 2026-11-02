output "state_bucket" {
  description = "Name of the S3 bucket holding all remote Terraform state."
  value       = aws_s3_bucket.terraform_state.id
}

output "lock_table" {
  description = "DynamoDB table used for Terraform state locking."
  value       = aws_dynamodb_table.terraform_locks.name
}
