variable "region" {
  description = "AWS region for the bootstrap resources."
  type        = string
}

variable "name_prefix" {
  description = "Prefix for the state bucket and lock table."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,20}$", var.name_prefix))
    error_message = "name_prefix must be 3-20 lowercase letters, digits or dashes."
  }
}


variable "owner" {
  description = "Tag value identifying the owner of these resources."
  type        = string
  default     = "OpenVault"
}

variable "github_repo" {
  description = "GitHub owner/repository allowed to assume the OIDC roles."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repo))
    error_message = "github_repo must be owner/repository."
  }
}
