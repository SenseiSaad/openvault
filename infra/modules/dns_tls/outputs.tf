output "zone_id" {
  description = "Hosted zone id (SES records go here too)."
  value       = aws_route53_zone.this.zone_id
}

output "zone_name_servers" {
  description = "NS records to delegate from the parent DNS provider."
  value       = aws_route53_zone.this.name_servers
}

output "certificate_arn" {
  description = "Validated ACM certificate ARN."
  value       = aws_acm_certificate_validation.this.certificate_arn
}

output "fqdn" {
  description = "The HTTPS origin for allowed-hosts/CORS/PUBLIC_BASE_URL."
  value       = local.domain_name
}
