variable "region" {
  description = "AWS region for the bootstrap resources."
  type        = string
  default     = "ap-south-1"
}

variable "name_prefix" {
  description = "Prefix for the state bucket and lock table."
  type        = string
  default     = "openvault"

  validation {
    condition     = can(regex("^[a-z0-9-]{3,20}$", var.name_prefix))
    error_message = "name_prefix must be 3-20 lowercase letters, digits or dashes."
  }
}

variable "owner" {
  description = "Tag value identifying the owner of these resources."
  type        = string
  default     = "saad"
}
