variable "name_prefix" {
  description = "Environment resource prefix."
  type        = string
}

variable "github_repo" {
  description = "GitHub owner/repository allowed to deploy this environment."
  type        = string
}

variable "github_environment" {
  description = "Exact GitHub Actions environment name used by this deploy job."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.github_environment)
    error_message = "github_environment must be staging or production."
  }
}

variable "oidc_provider_arn" {
  description = "Account-global GitHub OIDC provider created by the bootstrap stack."
  type        = string

  validation {
    condition = can(regex(
      "^arn:aws:iam::[0-9]{12}:oidc-provider/token.actions.githubusercontent.com$",
      var.oidc_provider_arn,
    ))
    error_message = "oidc_provider_arn must identify the GitHub OIDC provider."
  }
}

variable "tags" {
  description = "Tags applied to every role/policy."
  type        = map(string)
  default     = {}
}
