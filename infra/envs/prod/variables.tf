variable "region" {
  description = "AWS region for everything in this environment."
  type        = string
}

variable "owner" {
  description = "Tag value for the resource owner."
  type        = string
  default     = "OpenVault"
}

variable "domain" {
  description = "The delegated hostname this stack owns; it must not be the current live hostname."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9.-]+\\.[a-z]{2,}$", var.domain))
    error_message = "domain must be a fully qualified hostname without a scheme or path."
  }
}

variable "github_repo" {
  description = "GitHub owner/repository allowed to deploy this environment."
  type        = string
}

variable "services_enabled" {
  description = "Start ECS services only after the first image is pushed and migrations/seed complete."
  type        = bool
  default     = false
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
    SECRET_KEY             = "openvault/prod/SECRET_KEY"
    DATABASE_URL           = "openvault/prod/DATABASE_URL"
    LLM_KEY_ENCRYPTION_KEY = "openvault/prod/LLM_KEY_ENCRYPTION_KEY"
    EMAIL_HOST_USER        = "openvault/prod/EMAIL_HOST_USER"
    EMAIL_HOST_PASSWORD    = "openvault/prod/EMAIL_HOST_PASSWORD"
    SENTRY_DSN             = "openvault/prod/SENTRY_DSN"
  }
}

variable "alert_email" {
  description = "Email for SNS alarms and budget notifications."
  type        = string
  default     = ""
}

variable "from_email" {
  description = "Verified sender address for SES, generated from deploy.config."
  type        = string

  validation {
    condition     = can(regex("^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$", var.from_email))
    error_message = "from_email must be a valid address under the verified SES identity."
  }
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
  default     = "v=DMARC1; p=none"
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
