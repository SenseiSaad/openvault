variable "enable_model_host" {
  description = "Create the optional Ollama EC2 host (default off)."
  type        = bool
  default     = false
}

variable "name_prefix" {
  description = "Name prefix."
  type        = string
}

variable "instance_type" {
  description = "Instance type for the Ollama host (arm64)."
  type        = string
  default     = "t4g.medium"
}

variable "root_volume_gb" {
  description = "Encrypted root volume size (models are stored under /opt/ollama)."
  type        = number
  default     = 60
}

variable "min_size" {
  description = "ASG size while enabled (0 stops billing the instance)."
  type        = number
  default     = 1
}

variable "subnet_id" {
  description = "Public subnet id (no NAT in this VPC)."
  type        = string
}

variable "model_host_sg_id" {
  description = "Security group allowing 11434 from api/worker only."
  type        = string
}

variable "enable_cost_schedule" {
  description = "Stop the host at night and start it in the morning."
  type        = bool
  default     = false
}

variable "stop_cron" {
  description = "Cron (UTC) for the nightly stop."
  type        = string
  default     = "0 21 * * MON-FRI"
}

variable "start_cron" {
  description = "Cron (UTC) for the morning start."
  type        = string
  default     = "0 3 * * MON-FRI"
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default     = {}
}
