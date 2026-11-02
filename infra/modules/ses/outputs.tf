output "domain_identity_arn" {
  description = "Verified SES domain identity ARN."
  value       = aws_ses_domain_identity.this.arn
}

output "dkim_tokens" {
  description = "DKIM CNAME tokens (also created as Route 53 records)."
  value       = aws_ses_domain_dkim.this.dkim_tokens
}
