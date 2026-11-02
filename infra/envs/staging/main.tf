# OpenVault PRODUCTION root. Remote state in the bootstrap bucket with locking.
# Nothing here applies without the protected `terraform-apply` GitHub
# environment (or an explicit local apply).
terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "openvault"
      Env       = "staging"
      Owner     = var.owner
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  name_prefix = "openvault-stg"
  tags        = { Project = "openvault", Env = "staging", Owner = var.owner }
  domain      = var.domain # e.g. v2.example.com
}

module "network" {
  source = "../../modules/network"

  name_prefix          = local.name_prefix
  vpc_cidr             = "10.40.0.0/16"
  public_subnet_cidrs  = ["10.40.0.0/20", "10.40.16.0/20"]
  private_subnet_cidrs = ["10.40.128.0/20", "10.40.144.0/20"]
  tags                 = local.tags
}

module "data" {
  source = "../../modules/data"

  name_prefix                 = local.name_prefix
  account_suffix              = "prod"
  private_subnet_ids          = module.network.private_subnet_ids
  rds_sg_id                   = module.network.security_groups.rds
  redis_sg_id                 = module.network.security_groups.redis
  db_instance_class           = "db.t4g.medium"
  db_allocated_storage_gb     = 25
  db_max_allocated_storage_gb = 200
  db_multi_az                 = false
  db_backup_retention_days    = 14
  db_deletion_protection      = true
  db_skip_final_snapshot      = false
  cors_allowed_origins        = ["https://${local.domain}"]
  access_logs_bucket_id       = module.network.access_logs_bucket_id
  backup_retention_days       = 90
  force_destroy_buckets       = true
  tags                        = local.tags
}

module "registry" {
  source = "../../modules/registry"

  name_prefix  = local.name_prefix
  repositories = ["api", "web"]
  tags         = local.tags
}

module "dns_tls" {
  source = "../../modules/dns_tls"

  name_prefix  = local.name_prefix
  domain       = local.domain
  alb_dns_name = module.ecs.alb_dns_name
  alb_zone_id  = module.ecs.alb_zone_id
  tags         = local.tags
}

module "ecs" {
  source = "../../modules/ecs"

  name_prefix = local.name_prefix
  env         = "staging"

  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  alb_sg_id         = module.network.security_groups.alb
  api_sg_id         = module.network.security_groups.api
  web_sg_id         = module.network.security_groups.web
  worker_sg_id      = module.network.security_groups.worker

  api_image             = "${module.registry.repository_urls["api"]}:${var.initial_image_tag}"
  web_image             = "${module.registry.repository_urls["web"]}:${var.initial_image_tag}"
  certificate_arn       = module.dns_tls.certificate_arn
  access_logs_bucket_id = module.network.access_logs_bucket_id

  api_desired_count    = 1
  api_min_capacity     = 1
  api_max_capacity     = 3
  worker_desired_count = 1
  web_desired_count    = 1
  log_retention_days   = 90
  container_insights   = false

  documents_bucket_arn = module.data.documents_bucket_arn
  backups_bucket_arn   = module.data.backups_bucket_arn
  backups_bucket_name  = module.data.backups_bucket
  bedrock_model_arns   = var.bedrock_model_arns

  app_environment = merge(var.app_environment, {
    ALLOWED_HOSTS              = "${local.domain},localhost,127.0.0.1"
    CORS_ALLOWED_ORIGINS       = "https://${local.domain}"
    CSRF_TRUSTED_ORIGINS       = "https://${local.domain}"
    PUBLIC_BASE_URL            = "https://${local.domain}"
    COOKIE_SECURE              = "true"
    ENVIRONMENT                = "production"
    REQUIRE_EMAIL_VERIFICATION = "true"
    TRUSTED_PROXY_COUNT        = "1"
    LLM_PROVIDER               = "bedrock"
    BEDROCK_REGION             = var.region
    EMBED_PROVIDER             = "bedrock"
    EMBED_DIM                  = "1024"
    LOG_FORMAT                 = "json"
    CACHE_URL                  = "redis://${module.data.redis_endpoint}:6379/1"
    CELERY_BROKER_URL          = "redis://${module.data.redis_endpoint}:6379/0"
    DEFAULT_FROM_EMAIL         = "OpenVault <no-reply@${local.domain}>"
    EMAIL_HOST                 = "email-smtp.${var.region}.amazonaws.com"
    EMAIL_PORT                 = "587"
    EMAIL_USE_TLS              = "true"
    DATA_DIR                   = "/app/data"
    MEDIA_ROOT                 = "/app/media"
    AWS_STORAGE_BUCKET_NAME    = module.data.documents_bucket
    AWS_S3_REGION_NAME         = var.region
    ATTENDANCE_QR_REQUIRED     = "true"
  })

  app_secrets = [
    for name, ssm_name in var.app_secrets : {
      name    = name
      ssm_arn = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/${ssm_name}"
    }
  ]

  tags = local.tags
}

module "ses" {
  source = "../../modules/ses"

  mail_domain     = local.domain
  route53_zone_id = module.dns_tls.zone_id
  dmarc_record    = var.dmarc_record
}

module "observability" {
  source = "../../modules/observability"

  name_prefix              = local.name_prefix
  alert_email              = var.alert_email
  api_log_group_name       = module.ecs.api_log_group
  alb_arn_suffix           = module.ecs.alb_arn_suffix
  cluster_name             = module.ecs.cluster_name
  service_desired_counts   = { api = 1, web = 1, worker = 1 }
  db_instance_identifier   = "${local.name_prefix}-postgres"
  budget_monthly_limit_usd = var.budget_monthly_limit_usd
  tags                     = local.tags
}

module "iam_oidc" {
  source = "../../modules/iam_oidc"

  name_prefix      = local.name_prefix
  allowed_subjects = var.oidc_allowed_subjects
  tags             = local.tags
}

module "model_host" {
  source = "../../modules/model_host"

  enable_model_host    = var.enable_model_host
  name_prefix          = local.name_prefix
  subnet_id            = module.network.public_subnet_ids[0]
  model_host_sg_id     = module.network.security_groups.model_host
  enable_cost_schedule = var.model_host_cost_schedule
  tags                 = local.tags
}
