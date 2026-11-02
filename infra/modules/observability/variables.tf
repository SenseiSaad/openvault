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

variable "daily_output_token_budget" {
  description = "Daily sum of output tokens that fires the cost alarm."
  type        = number
  default     = 2000000
}

variable "budget_monthly_limit_usd" {
  description = "Monthly AWS budget in USD (0 disables the budget)."
  type        = number
  default     = 50
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default     = {}
}
