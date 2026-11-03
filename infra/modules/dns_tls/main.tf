# Route 53 zone for a delegated subdomain so the existing
# live site stays untouched: delegate the subdomain by pasting the output NS
# records into the parent DNS provider. ACM validates via Route 53.
terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}

locals {
  common_tags = merge(var.tags, { Layer = "dns_tls" })
  domain_name = var.domain
}

resource "aws_route53_zone" "this" {
  name = local.domain_name

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-zone" })
}

resource "aws_acm_certificate" "this" {
  domain_name       = local.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-cert" })
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }

  allow_overwrite = true
  name            = each.value.name
  type            = each.value.type
  zone_id         = aws_route53_zone.this.zone_id
  ttl             = 60
  records         = [each.value.value]
}

resource "aws_acm_certificate_validation" "this" {
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

resource "aws_route53_record" "alb_a" {
  zone_id = aws_route53_zone.this.zone_id
  name    = local.domain_name
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "alb_aaaa" {
  zone_id = aws_route53_zone.this.zone_id
  name    = local.domain_name
  type    = "AAAA"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}
