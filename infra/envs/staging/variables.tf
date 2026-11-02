variable "region" {
  description = "AWS region for the staging environment."
  type        = string
  default     = "ap-south-1"
}

variable "owner" {
  description = "Tag value for the resource owner."
  type        = string
  default     = "saad"
}

variable "domain" {
  description = "Staging subdomain, e.g. stg.v2.example.com."
  type        = string
}

variable "oidc_allowed_subjects" {
  description = "OIDC subject patterns allowed to assume AWS roles."
  type        = list(string)
  default = [
    "repo:REPLACE_ME/openvault:ref:refs/heads/main",
    "repo:REPLACE_ME/openvault:pull_request",
    "repo:REPLACE_ME/openvault:environment:staging",
  ]
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
    SECRET_KEY                        = "openvault/staging/SECRET_KEY"
    DATABASE_URL                      = "openvault/staging/DATABASE_URL"
    LLM_KEY_ENCRYPTION_KEY            = "openvault/staging/LLM_KEY_ENCRYPTION_KEY"
    EMAIL_HOST_USER                   = "openvault/staging/EMAIL_HOST_USER"
    EMAIL_HOST_PASSWORD               = "openvault/staging/EMAIL_HOST_PASSWORD"
    SENTRY_DSN                        = "openvault/staging/SENTRY_DSN"
    BOOTSTRAP_PLATFORM_ADMIN_EMAIL    = "openvault/staging/BOOTSTRAP_PLATFORM_ADMIN_EMAIL"
    BOOTSTRAP_PLATFORM_ADMIN_PASSWORD = "openvault/staging/BOOTSTRAP_PLATFORM_ADMIN_PASSWORD"
  }
}

variable "alert_email" {
  description = "Email for SNS alarms."
  type        = string
  default     = ""
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
