variable "name_prefix" {
  description = "Name prefix for all network resources."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.40.0.0/16"
}

variable "az_count" {
  description = "Number of Availability Zones (2 for HA of ALB/RDS)."
  type        = number
  default     = 2

  validation {
    condition     = var.az_count >= 2 && var.az_count <= 3
    error_message = "Use 2 or 3 AZs."
  }
}

variable "public_subnet_cidrs" {
  description = "One CIDR per AZ for public subnets (ALB + ECS tasks)."
  type        = list(string)
  default     = ["10.40.0.0/20", "10.40.16.0/20"]
}

variable "private_subnet_cidrs" {
  description = "One CIDR per AZ for isolated private subnets (RDS + Redis)."
  type        = list(string)
  default     = ["10.40.128.0/20", "10.40.144.0/20"]
}

variable "api_port" {
  description = "Container port the API listens on."
  type        = number
  default     = 8000
}

variable "web_port" {
  description = "Container port the frontend listens on."
  type        = number
  default     = 3000
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default     = {}
}
