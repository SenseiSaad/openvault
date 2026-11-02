output "instance_id" {
  description = "The Ollama host instance id (null while disabled)."
  value       = local.enabled ? aws_autoscaling_group.this[0].id : null
}

output "private_dns" {
  description = "Host to point OLLAMA_URL at (port 11434)."
  value       = local.enabled ? aws_autoscaling_group.this[0].name : null
}
