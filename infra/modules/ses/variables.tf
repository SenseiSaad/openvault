variable "mail_domain" {
  description = "Domain sending email (usually the same subdomain as the app, e.g. v2.example.com)."
  type        = string
}

variable "route53_zone_id" {
  description = "Hosted zone id that owns the mail domain."
  type        = string
}

variable "dmarc_record" {
  description = "DMARC policy record. Start at p=none with a rua mailbox, tighten after monitoring."
  type        = string
  default     = "v=DMARC1; p=none; rua=mailto:postmaster@openvault.pk"
}
