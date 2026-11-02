variable "name_prefix" {
  description = "Name prefix."
  type        = string
}

variable "env" {
  description = "Environment name (staging|prod) used in paths and log groups."
  type        = string

  validation {
    condition     = contains(["staging", "prod"], var.env)
    error_message = "env must be staging or prod."
  }
}

variable "vpc_id" {
  description = "VPC id."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnets for the ALB and Fargate tasks."
  type        = list(string)
}

variable "alb_sg_id" {
  description = "ALB security group id."
  type        = string
}

variable "api_sg_id" {
  description = "API task security group id."
  type        = string
}

variable "web_sg_id" {
  description = "Web task security group id."
  type        = string
}

variable "worker_sg_id" {
  description = "Worker task security group id."
  type        = string
}

variable "api_port" {
  description = "API container port."
  type        = number
  default     = 8000
}

variable "web_port" {
  description = "Frontend container port."
  type        = number
  default     = 3000
}

variable "api_image" {
  description = "Full ECR image URI for the api/worker/migrate/backup containers."
  type        = string
}

variable "web_image" {
  description = "Full ECR image URI for the web container."
  type        = string
}

variable "api_desired_count" {
  description = "Desired api tasks."
  type        = number
  default     = 1
}

variable "web_desired_count" {
  description = "Desired web tasks."
  type        = number
  default     = 1
}

variable "worker_desired_count" {
  description = "Desired worker tasks (fixed: queue-length scaling is not worth an extra metric pipeline yet — revisit when queue depth alarms fire)."
  type        = number
  default     = 1
}

variable "api_cpu" {
  description = "Fargate CPU units for the api task."
  type        = string
  default     = "512"
}

variable "api_memory" {
  description = "Fargate memory (MB) for the api task."
  type        = string
  default     = "1024"
}

variable "worker_cpu" {
  description = "Fargate CPU units for the worker task."
  type        = string
  default     = "256"
}

variable "worker_memory" {
  description = "Fargate memory (MB) for the worker task."
  type        = string
  default     = "512"
}

variable "web_cpu" {
  description = "Fargate CPU units for the web task."
  type        = string
  default     = "256"
}

variable "web_memory" {
  description = "Fargate memory (MB) for the web task."
  type        = string
  default     = "512"
}

variable "migrate_cpu" {
  description = "Fargate CPU units for the one-off migrate task."
  type        = string
  default     = "512"
}

variable "migrate_memory" {
  description = "Fargate memory (MB) for the one-off migrate task."
  type        = string
  default     = "1024"
}

variable "api_deployment_max_percent" {
  description = "Max tasks during deploy (200 allows blue/green at 1 task)."
  type        = number
  default     = 200
}

variable "api_deployment_min_percent" {
  description = "Min healthy tasks during deploy (50 allows a 1-task replace)."
  type        = number
  default     = 50
}

variable "api_min_capacity" {
  description = "Autoscaling floor for api tasks (equal to max disables scaling)."
  type        = number
  default     = 1
}

variable "api_max_capacity" {
  description = "Autoscaling ceiling for api tasks."
  type        = number
  default     = 1
}

variable "alb_idle_timeout" {
  description = "ALB idle timeout in seconds — must cover streamed answers (matches gunicorn --timeout 300)."
  type        = number
  default     = 300
}

variable "certificate_arn" {
  description = "ACM certificate ARN for the HTTPS listener."
  type        = string
}

variable "app_environment" {
  description = "Plain (non-secret) environment variables for api/worker/migrate."
  type        = map(string)
  default     = {}
}

variable "app_secrets" {
  description = "Secret list for task definitions: { name = env var name, ssm_arn = full SSM parameter ARN }. Values are NEVER here — only parameter names."
  type = list(object({
    name    = string
    ssm_arn = string
  }))
  default = []
}

variable "documents_bucket_arn" {
  description = "Documents bucket ARN for the task role."
  type        = string
}

variable "backups_bucket_arn" {
  description = "Backups bucket ARN for the task role."
  type        = string
}

variable "backups_bucket_name" {
  description = "Backups bucket name passed to the backup container."
  type        = string
}

variable "bedrock_model_arns" {
  description = "Exact Bedrock model / inference-profile ARNs the task role may invoke. Empty = Bedrock blocked at IAM even if misconfigured."
  type        = list(string)
  default     = []
}

variable "log_retention_days" {
  description = "CloudWatch log retention."
  type        = number
  default     = 90
}

variable "enable_nightly_backup" {
  description = "Schedule the nightly logical pg_dump task."
  type        = bool
  default     = true
}

variable "backup_cron" {
  description = "EventBridge cron for the nightly backup (UTC)."
  type        = string
  default     = "cron(30 20 * * ? *)"
}

variable "container_insights" {
  description = "Enable ECS Container Insights (staging: off to save cost)."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default     = {}
}
variable "access_logs_bucket_id" {
  description = "Central access-logs bucket for ALB logs."
  type        = string
}
