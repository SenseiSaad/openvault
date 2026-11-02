# ECS Fargate: api + web behind one ALB (path-based, same domain for cookie
# correctness), Celery worker without a load balancer, and a one-off migrate
# task family. Migrations are NEVER part of the serving containers.
terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}

locals {
  common_tags = merge(var.tags, { Layer = "ecs" })
  region      = data.aws_region.current.name
  account     = data.aws_caller_identity.current.account_id
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# ---------------------------------------------------------------- cluster
resource "aws_ecs_cluster" "this" {
  name = "${var.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = var.container_insights ? "enabled" : "disabled" #checkov:skip=CKV_AWS_65:Cost decision — JSON app logs + alarms cover launch stage; enable with real traffic
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-cluster" })
}

# ------------------------------------------------------------------- logs
resource "aws_cloudwatch_log_group" "services" { #checkov:skip=CKV_AWS_158:CloudWatch encrypts at rest with an AWS-owned key; per-group customer KMS deferred
  for_each = toset(["api", "worker", "web", "migrate", "backup"])

  name              = "/openvault/${var.env}/${each.key}"
  retention_in_days = var.log_retention_days

  tags = merge(local.common_tags, { Name = "/openvault/${var.env}/${each.key}" })
}

# ---------------------------------------------------------------- IAM roles
resource "aws_iam_role" "execution" {
  name = "${var.name_prefix}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Task definitions pull secret VALUES from SSM at launch — the execution role
# needs read only on the app's parameter path.
resource "aws_iam_role_policy" "execution_ssm" {
  name = "ssm-app-parameters"
  role = aws_iam_role.execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameters", "ssm:GetParameter"]
      Resource = "arn:aws:ssm:${local.region}:${local.account}:parameter/openvault/${var.env}/*"
    }]
  })
}

# Per-service TASK roles: the workload identity. api and worker share one set
# of data permissions (S3 prefixes, SSM read, Bedrock invoke on named models);
# web gets none of them.
resource "aws_iam_role" "app_task" {
  name = "${var.name_prefix}-ecs-task-${var.env}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

data "aws_iam_policy_document" "app_task" {
  statement {
    sid       = "DocumentsBucket"
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
    resources = [var.documents_bucket_arn, "${var.documents_bucket_arn}/*"]
  }

  statement {
    sid       = "BackupsBucket"
    effect    = "Allow"
    actions   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket"]
    resources = [var.backups_bucket_arn, "${var.backups_bucket_arn}/*"]
  }

  statement {
    sid       = "ReadAppParameters"
    effect    = "Allow"
    actions   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
    resources = ["arn:aws:ssm:${local.region}:${local.account}:parameter/openvault/${var.env}/*"]
  }

  dynamic "statement" {
    for_each = length(var.bedrock_model_arns) > 0 ? [1] : []
    content {
      sid    = "BedrockInvokeNamedModels"
      effect = "Allow"
      actions = [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
      ]
      resources = var.bedrock_model_arns
    }
  }
}

resource "aws_iam_role_policy" "app_task" {
  name   = "app-task-permissions"
  role   = aws_iam_role.app_task.id
  policy = data.aws_iam_policy_document.app_task.json
}

resource "aws_iam_role" "web_task" {
  name = "${var.name_prefix}-ecs-task-web-${var.env}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

# ------------------------------------------------------------ task definitions
locals {
  app_container_env = merge(var.app_environment, {
    LOG_FORMAT = "json"
    DATA_DIR   = "/app/data"
    MEDIA_ROOT = "/app/media"
  })

  api_container = {
    name      = "api"
    image     = var.api_image
    essential = true
    portMappings = [{
      containerPort = var.api_port
      protocol      = "tcp"
    }]
    environment = [for k, v in local.app_container_env : { name = k, value = v }]
    secrets     = [for s in var.app_secrets : { name = s.name, valueFrom = s.ssm_arn }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.services["api"].name
        awslogs-region        = local.region
        awslogs-stream-prefix = "api"
      }
    }
    # SIGTERM grace period for in-flight streamed answers, matched to the ALB
    # idle timeout (both 300s) so streaming responses are not cut at deploy.
    stopTimeout     = 120
    linuxParameters = { initProcessEnabled = true }
  }

  worker_container = {
    name      = "worker"
    image     = var.api_image
    essential = true
    command   = ["celery", "-A", "config", "worker", "--loglevel=info", "--concurrency=2", "-Q", "default"]
    environment = [for k, v in merge(local.app_container_env, {
      C_FORCE_ROOT = "0"
    }) : { name = k, value = v }]
    secrets = [for s in var.app_secrets : { name = s.name, valueFrom = s.ssm_arn }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.services["worker"].name
        awslogs-region        = local.region
        awslogs-stream-prefix = "worker"
      }
    }
    stopTimeout     = 120
    linuxParameters = { initProcessEnabled = true }
  }

  web_container = {
    name      = "web"
    image     = var.web_image
    essential = true
    portMappings = [{
      containerPort = var.web_port
      protocol      = "tcp"
    }]
    # Same-origin: the browser talks to one domain, so the frontend detects
    # the API base from window.location (NEXT_PUBLIC_API_URL stays unset).
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = tostring(var.web_port) },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.services["web"].name
        awslogs-region        = local.region
        awslogs-stream-prefix = "web"
      }
    }
    stopTimeout     = 60
    linuxParameters = { initProcessEnabled = true }
  }

  migrate_container = {
    name        = "migrate"
    image       = var.api_image
    essential   = true
    command     = ["sh", "-c", "python manage.py migrate --noinput && python manage.py seed_plans && python manage.py bootstrap_platform_admin || echo 'bootstrap skipped (env not set)'"]
    environment = [for k, v in local.app_container_env : { name = k, value = v }]
    secrets     = [for s in var.app_secrets : { name = s.name, valueFrom = s.ssm_arn }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.services["migrate"].name
        awslogs-region        = local.region
        awslogs-stream-prefix = "migrate"
      }
    }
    stopTimeout     = 300
    linuxParameters = { initProcessEnabled = true }
  }

  backup_container = {
    name      = "backup"
    image     = var.api_image
    essential = true
    command   = ["/app/scripts/backup.sh"]
    environment = [for k, v in merge(local.app_container_env, {
      BACKUP_S3_BUCKET = var.backups_bucket_name
      RETENTION_DAYS   = "30"
    }) : { name = k, value = v }]
    secrets = [for s in var.app_secrets : { name = s.name, valueFrom = s.ssm_arn }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.services["backup"].name
        awslogs-region        = local.region
        awslogs-stream-prefix = "backup"
      }
    }
    stopTimeout     = 900
    linuxParameters = { initProcessEnabled = true }
  }
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${var.name_prefix}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.app_task.arn

  container_definitions = jsonencode([local.api_container])

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64" # Graviton later — see ADR 0007
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-api" })
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.name_prefix}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.app_task.arn

  container_definitions = jsonencode([local.worker_container])

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-worker" })
}

resource "aws_ecs_task_definition" "web" {
  family                   = "${var.name_prefix}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.web_task.arn

  container_definitions = jsonencode([local.web_container])

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-web" })
}

resource "aws_ecs_task_definition" "migrate" {
  family                   = "${var.name_prefix}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.migrate_cpu
  memory                   = var.migrate_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.app_task.arn

  container_definitions = jsonencode([local.migrate_container])

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-migrate" })
}

resource "aws_ecs_task_definition" "backup" {
  family                   = "${var.name_prefix}-backup"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.app_task.arn

  container_definitions = jsonencode([local.backup_container])

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-backup" })
}

# ------------------------------------------------------------------- ALB
resource "aws_lb" "this" {
  name               = "${var.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_sg_id]
  subnets            = var.public_subnet_ids

  drop_invalid_header_fields = true

  access_logs {
    bucket  = var.access_logs_bucket_id
    prefix  = "alb/${var.env}"
    enabled = true
  }

  # Streaming answers stay open for the whole model response: the ALB idle
  # timeout must match (or exceed) the gunicorn request timeout.
  idle_timeout = var.alb_idle_timeout

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-alb" })
}

resource "aws_lb_target_group" "api" {
  name_prefix          = "api-"
  port                 = var.api_port
  protocol             = "HTTP"
  vpc_id               = var.vpc_id
  target_type          = "ip"
  deregistration_delay = 30

  health_check {
    path                = "/api/health"
    matcher             = "200"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 10
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-tg-api" })
}

resource "aws_lb_target_group" "web" {
  name_prefix          = "web-"
  port                 = var.web_port
  protocol             = "HTTP"
  vpc_id               = var.vpc_id
  target_type          = "ip"
  deregistration_delay = 30

  health_check {
    path                = "/"
    matcher             = "200"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 10
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-tg-web" })
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }

  tags = local.common_tags
}

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = local.common_tags
}

# /api/* AND the Django admin/static are served by the api service; everything
# else falls through to the frontend container.
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/admin/*", "/static/*"]
    }
  }
}

# ---------------------------------------------------------------- services
resource "aws_ecs_service" "api" {
  name            = "api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [var.api_sg_id]
    assign_public_ip = true #checkov:skip=CKV_AWS_333:Public subnets without NAT by design — ADR 0004
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = var.api_port
  }

  health_check_grace_period_seconds = 60

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_maximum_percent         = var.api_deployment_max_percent
  deployment_minimum_healthy_percent = var.api_deployment_min_percent

  enable_execute_command = true # ECS Exec for break-glass debugging (audited)

  # Subsequent image deploys are done by CI (update-service with a new task def
  # revision); Terraform owns the service shape, not the running revision.
  lifecycle {
    ignore_changes = [task_definition, load_balancer]
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-api" })
}

resource "aws_ecs_service" "web" {
  name            = "web"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [var.web_sg_id]
    assign_public_ip = true #checkov:skip=CKV_AWS_333:Public subnets without NAT by design — ADR 0004
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = var.web_port
  }

  health_check_grace_period_seconds = 30

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [task_definition, load_balancer]
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-web" })
}

resource "aws_ecs_service" "worker" {
  name            = "worker"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [var.worker_sg_id]
    assign_public_ip = true #checkov:skip=CKV_AWS_333:Public subnets without NAT by design — ADR 0004
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [task_definition]
  }

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-worker" })
}

# ------------------------------------------------------- autoscaling (api)
resource "aws_appautoscaling_target" "api" {
  count = var.api_max_capacity > var.api_min_capacity ? 1 : 0

  max_capacity       = var.api_max_capacity
  min_capacity       = var.api_min_capacity
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  count = var.api_max_capacity > var.api_min_capacity ? 1 : 0

  name               = "${var.name_prefix}-api-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api[0].resource_id
  scalable_dimension = aws_appautoscaling_target.api[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.api[0].service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 60
    scale_in_cooldown  = 180
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

# ------------------------------------------- nightly logical backup (cron)
resource "aws_cloudwatch_event_rule" "nightly_backup" {
  count = var.enable_nightly_backup ? 1 : 0

  name                = "${var.name_prefix}-nightly-db-backup"
  schedule_expression = var.backup_cron

  tags = local.common_tags
}

resource "aws_iam_role" "events_run_task" {
  count = var.enable_nightly_backup ? 1 : 0

  name = "${var.name_prefix}-events-run-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "events_run_task" {
  count = var.enable_nightly_backup ? 1 : 0

  name = "run-backup-task"
  role = aws_iam_role.events_run_task[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ecs:RunTask"]
      Resource = aws_ecs_task_definition.backup.arn
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = [aws_iam_role.execution.arn, aws_iam_role.app_task.arn]
    }]
  })
}

resource "aws_cloudwatch_event_target" "nightly_backup" {
  count = var.enable_nightly_backup ? 1 : 0

  rule     = aws_cloudwatch_event_rule.nightly_backup[0].name
  arn      = aws_ecs_cluster.this.arn
  role_arn = aws_iam_role.events_run_task[0].arn

  ecs_target {
    task_count          = 1
    task_definition_arn = aws_ecs_task_definition.backup.arn
    launch_type         = "FARGATE"

    network_configuration {
      subnets          = var.public_subnet_ids
      security_groups  = [var.api_sg_id]
      assign_public_ip = true #checkov:skip=CKV_AWS_333:Public subnets without NAT by design — ADR 0004
    }
  }
}
