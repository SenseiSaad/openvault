variable "region" {
  description = "AWS region for everything in this environment."
  type        = string
  default     = "ap-south-1"
}

variable "owner" {
  description = "Tag value for the resource owner."
  type        = string
  default     = "saad"
}

variable "domain" {
  description = "The subdomain this stack owns, e.g. v2.example.com. The current live site is untouched."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9.-]+\\.[a-z]{2,}$", var.domain))
    error_message = "domain must be a hostname like v2.example.com."
  }
}

variable "oidc_allowed_subjects" {
  description = "OIDC subject patterns allowed to assume AWS roles."
  type        = list(string)
  default = [
    "repo:REPLACE_ME/openvault:ref:refs/heads/main",
    "repo:REPLACE_ME/openvault:ref:refs/tags/v*",
    "repo:REPLACE_ME/openvault:environment:production",
    "repo:REPLACE_ME/openvault:environment:staging",
  ]
}

variable "bedrock_model_arns" {
  description = "Exact Bedrock model/inference-profile ARNs the app may invoke. Only these two are needed for the default provider: the India Claude Haiku chat profile and the Titan v2 embedding model. Compose them from var.region + your account id."
  type        = list(string)
  default     = []
}

variable "app_environment" {
  description = "Extra plain environment variables merged into the ECS task definitions."
  type        = map(string)
  default     = {}
}

variable "app_secrets" {
  description = "Map of env-var name -> SSM parameter NAME under /openvault/prod/ (values are pushed by scripts/push_env_to_ssm.sh and never live in Terraform)."
  type        = map(string)
  default = {
    SECRET_KEY                        = "openvault/prod/SECRET_KEY"
    DATABASE_URL                      = "openvault/prod/DATABASE_URL"
    LLM_KEY_ENCRYPTION_KEY            = "openvault/prod/LLM_KEY_ENCRYPTION_KEY"
    EMAIL_HOST_USER                   = "openvault/prod/EMAIL_HOST_USER"
    EMAIL_HOST_PASSWORD               = "openvault/prod/EMAIL_HOST_PASSWORD"
    SENTRY_DSN                        = "openvault/prod/SENTRY_DSN"
    BOOTSTRAP_PLATFORM_ADMIN_EMAIL    = "openvault/prod/BOOTSTRAP_PLATFORM_ADMIN_EMAIL"
    BOOTSTRAP_PLATFORM_ADMIN_PASSWORD = "openvault/prod/BOOTSTRAP_PLATFORM_ADMIN_PASSWORD"
  }
}

variable "alert_email" {
  description = "Email for SNS alarms and budget notifications."
  type        = string
  default     = ""
}

variable "daily_total_token_budget" {
  description = "Daily input+output token guard for Bedrock cost (docs/COST.md)."
  type        = number
  default     = 3000000
}

variable "budget_alarm_thresholds" {
  description = "Absolute monthly AWS spend alarms in USD."
  type        = list(number)
  default     = [20, 35, 50, 100]
}

variable "dmarc_record" {
  description = "DMARC TXT record value."
  type        = string
  default     = "v=DMARC1; p=none; rua=mailto:postmaster@openvault.pk"
}

variable "enable_model_host" {
  description = "Optional self-hosted Ollama EC2 host (default off — Bedrock is the provider)."
  type        = bool
  default     = false
}

variable "model_host_cost_schedule" {
  description = "Stop/start the model host on a schedule while it is enabled."
  type        = bool
  default     = false
}

variable "initial_image_tag" {
  description = "Image tag used for the FIRST apply only (a 'bootstrap' image you push once). CI replaces it with commit SHAs afterwards."
  type        = string
  default     = "bootstrap"
}
