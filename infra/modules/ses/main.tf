# SES domain identity for transactional email: DKIM records, SPF and DMARC.
# SMTP credentials are NOT created here (they would be long-lived IAM keys in
# state) — see docs/DEPLOY.md: create the SMTP user in the console and push
# EMAIL_HOST_USER/EMAIL_HOST_PASSWORD via scripts/push_env_to_ssm.sh.
terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}

resource "aws_ses_domain_identity" "this" {
  domain = var.mail_domain
}

resource "aws_ses_domain_dkim" "this" {
  domain = aws_ses_domain_identity.this.domain
}

resource "aws_route53_record" "dkim" {
  count = 3

  zone_id = var.route53_zone_id
  name    = "${aws_ses_domain_dkim.this.dkim_tokens[count.index]}._domainkey.${var.mail_domain}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.this.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_route53_record" "spf" {
  zone_id = var.route53_zone_id
  name    = var.mail_domain
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

resource "aws_route53_record" "verification" {
  zone_id = var.route53_zone_id
  name    = "_amazonses.${var.mail_domain}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.this.verification_token]
}

resource "aws_ses_domain_identity_verification" "this" {
  domain     = aws_ses_domain_identity.this.id
  depends_on = [aws_route53_record.verification, aws_route53_record.dkim]
}

resource "aws_route53_record" "dmarc" {
  zone_id = var.route53_zone_id
  name    = "_dmarc.${var.mail_domain}"
  type    = "TXT"
  ttl     = 600
  records = [var.dmarc_record]
}
