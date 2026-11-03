variable "region" {
  description = "AWS region for the staging environment."
  type        = string
}

variable "owner" {
  description = "Tag value for the resource owner."
  type        = string
  default     = "OpenVault"
}

variable "domain" {
  description = "Staging delegated hostname; it must be different from production and live hostnames."
  type        = string
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
  description = "Bedrock model/inference-profile ARNs (same as prod, or empty to force keyword fallback in staging)."
  type        = list(string)
  default     = []
}

variable "app_environment" {
  description = "Extra plain environment variables."
  type        = map(string)
  default     = {}
}

variable "app_secrets" {
  description = "Map of env-var name -> SSM parameter NAME under /openvault/staging/."
  type        = map(string)
  default = {
    SECRET_KEY             = "openvault/staging/SECRET_KEY"
    DATABASE_URL           = "openvault/staging/DATABASE_URL"
    LLM_KEY_ENCRYPTION_KEY = "openvault/staging/LLM_KEY_ENCRYPTION_KEY"
    EMAIL_HOST_USER        = "openvault/staging/EMAIL_HOST_USER"
    EMAIL_HOST_PASSWORD    = "openvault/staging/EMAIL_HOST_PASSWORD"
    SENTRY_DSN             = "openvault/staging/SENTRY_DSN"
  }
}

variable "alert_email" {
  description = "Email for SNS alarms."
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
  default     = 500000
}

variable "budget_alarm_thresholds" {
  description = "Absolute monthly AWS spend alarms in USD."
  type        = list(number)
  default     = [10, 15]
}

variable "dmarc_record" {
  description = "DMARC TXT record value."
  type        = string
  default     = "v=DMARC1; p=none"
}

variable "enable_model_host" {
  description = "Optional Ollama host in staging (default off)."
  type        = bool
  default     = false
}

variable "model_host_cost_schedule" {
  description = "Stop/start schedule for the model host."
  type        = bool
  default     = false
}

variable "initial_image_tag" {
  description = "Image tag for the FIRST apply."
  type        = string
  default     = "bootstrap"
}
