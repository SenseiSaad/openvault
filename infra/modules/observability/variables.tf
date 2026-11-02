variable "name_prefix" {
  description = "Name prefix."
  type        = string
}

variable "alert_email" {
  description = "Email subscribed to the SNS alerts topic and budgets (confirm the subscription!)."
  type        = string
  default     = ""
}

variable "api_log_group_name" {
  description = "API log group for Bedrock usage/error metric filters."
  type        = string
}

variable "alb_arn_suffix" {
  description = "ALB arn suffix for metric dimensions."
  type        = string
}

variable "cluster_name" {
  description = "ECS cluster name."
  type        = string
}

variable "service_desired_counts" {
  description = "Map of service name -> desired count (for below-desired alarms)."
  type        = map(number)
}

variable "db_instance_identifier" {
  description = "RDS instance identifier."
  type        = string
}

variable "daily_total_token_budget" {
  description = "Daily sum of input + output Bedrock tokens that fires the cost alarm. Tune from actual usage; 3M is a launch guard, not an invoice."
  type        = number
  default     = 3000000
}

variable "budget_alarm_thresholds" {
  description = "Absolute monthly USD spend thresholds for AWS Budgets. Prod uses 20/35/50/100. Empty disables budgets."
  type        = list(number)
  default     = [20, 35, 50, 100]

  validation {
    condition     = alltrue([for t in var.budget_alarm_thresholds : t > 0])
    error_message = "Budget thresholds must be positive USD amounts."
  }
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default     = {}
}
