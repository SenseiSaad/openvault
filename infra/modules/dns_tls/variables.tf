variable "name_prefix" {
  description = "Name prefix."
  type        = string
}

variable "domain" {
  description = "The delegated hostname this stack owns; the parent domain stays with the current DNS provider."
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
