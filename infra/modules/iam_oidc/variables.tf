variable "name_prefix" {
  description = "Name prefix."
  type        = string
}

variable "allowed_subjects" {
  description = "Full OIDC subject patterns allowed to assume these roles. Example: ['repo:me/openvault:ref:refs/heads/main', 'repo:me/openvault:ref:refs/tags/v*', 'repo:me/openvault:environment:production']"
  type        = list(string)
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default     = {}
}
