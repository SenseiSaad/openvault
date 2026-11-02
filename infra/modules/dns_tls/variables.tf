variable "name_prefix" {
  description = "Name prefix."
  type        = string
}

variable "domain" {
  description = "The SUBDOMAIN this stack owns (e.g. v2.example.com). The parent domain stays on the current DNS provider."
  type        = string
}

variable "alb_dns_name" {
  description = "ALB DNS name for the alias records."
  type        = string
}

variable "alb_zone_id" {
  description = "ALB hosted zone id."
  type        = string
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default     = {}
}
