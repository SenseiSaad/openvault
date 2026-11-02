variable "name_prefix" {
  description = "Name prefix for all data resources."
  type        = string
}

variable "account_suffix" {
  description = "Short account/environment suffix to keep bucket names globally unique (e.g. 'stg1', 'prod1')."
  type        = string
}

variable "private_subnet_ids" {
  description = "Isolated private subnet ids for RDS and ElastiCache."
  type        = list(string)
}

variable "rds_sg_id" {
  description = "Security group id the database accepts traffic from."
  type        = string
}

variable "redis_sg_id" {
  description = "Security group id the cache accepts traffic from."
  type        = string
}

variable "db_instance_class" {
  description = "RDS instance class (smallest viable in prod: db.t4g.medium)."
  type        = string
  default     = "db.t4g.micro"
}

variable "engine_version" {
  description = "PostgreSQL engine version (16.x supports pgvector)."
  type        = string
  default     = "16.6"
}

variable "db_name" {
  description = "Initial database name."
  type        = string
  default     = "openvault"
}

variable "db_username" {
  description = "Master username (not a secret; password is AWS-managed)."
  type        = string
  default     = "openvault"
}

variable "db_allocated_storage_gb" {
  description = "Initial allocated storage in GB (gp3 autoscales up to max)."
  type        = number
  default     = 20
}

variable "db_max_allocated_storage_gb" {
  description = "Storage autoscaling ceiling in GB."
  type        = number
  default     = 100
}

variable "db_multi_az" {
  description = "Multi-AZ standby (prod: true when real customers exist)."
  type        = bool
  default     = false
}

variable "db_backup_retention_days" {
  description = "PITR retention in days (0 disables backups — never in prod)."
  type        = number
  default     = 7
}

variable "db_deletion_protection" {
  description = "Refuse API-level deletion of the instance."
  type        = bool
  default     = true
}

variable "db_skip_final_snapshot" {
  description = "Skip the final snapshot on destroy (false in prod)."
  type        = bool
  default     = false
}

variable "redis_engine_version" {
  description = "Redis engine version."
  type        = string
  default     = "7.1"
}

variable "redis_node_type" {
  description = "ElastiCache node type."
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_snapshot_retention_days" {
  description = "Days of Redis snapshots to keep (0 disables)."
  type        = number
  default     = 1
}

variable "cors_allowed_origins" {
  description = "Origins allowed to presign/upload documents from the browser."
  type        = list(string)
}

variable "backup_retention_days" {
  description = "Days to keep objects in the backups bucket."
  type        = number
  default     = 90
}

variable "force_destroy_buckets" {
  description = "Allow emptying buckets on destroy (staging convenience only)."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default     = {}
}
variable "access_logs_bucket_id" {
  description = "Central access-logs bucket id (see network module)."
  type        = string
}
