variable "mail_domain" {
  description = "Domain sending email, typically the same hostname as the app."
  type        = string
}

variable "route53_zone_id" {
  description = "Hosted zone id that owns the mail domain."
  type        = string
}

variable "dmarc_record" {
  description = "DMARC TXT record derived from the alert mailbox in deploy.config."
  type        = string
}
