variable "name_prefix" {
  description = "Name prefix."
  type        = string
}

variable "create_oidc_provider" {
  description = "Create the account-global GitHub OIDC provider (only one environment should)."
  type        = bool
  default     = true
}

variable "oidc_provider_arn" {
  description = "Existing account-global GitHub OIDC provider ARN when create_oidc_provider=false."
  type        = string
  default     = ""

  validation {
    condition = var.create_oidc_provider || can(regex(
      "^arn:aws:iam::[0-9]{12}:oidc-provider/token.actions.githubusercontent.com$",
      var.oidc_provider_arn,
    ))
    error_message = "oidc_provider_arn must identify the shared GitHub provider when create_oidc_provider is false."
  }
}

variable "allowed_subjects" {
  description = "Subject patterns from which this module filters role-specific GitHub OIDC trust (main, pull_request, environment subjects)."
  type        = list(string)
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default     = {}
}
