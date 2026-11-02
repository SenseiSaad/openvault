# Alarms, SNS topic, Bedrock cost metric filters, and AWS Budgets.
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
  common_tags   = merge(var.tags, { Layer = "observability" })
  alarm_actions = [aws_sns_topic.alerts.arn]
}

resource "aws_sns_topic" "alerts" {
  name = "${var.name_prefix}-alerts"

  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ------------------------------------------------------- Bedrock cost signal
# The app emits one JSON log line per AI call:
#   {"event": "llm_usage", "company_id": 3, "model": "bedrock:in.anthropic...",
#    "input_tokens": 1234, "output_tokens": 567}
# No prompt or document content is ever logged (see rag.stream_answer).
resource "aws_cloudwatch_log_metric_filter" "llm_output_tokens" {
  name           = "${var.name_prefix}-llm-output-tokens"
  log_group_name = var.api_log_group_name
  pattern        = "{ $.event = \"llm_usage\" }"

  metric_transformation {
    name          = "LLMOutputTokens"
    namespace     = "OpenVault/App"
    value         = "$.output_tokens"
    default_value = "0"
    unit          = "Count"
  }
}

resource "aws_cloudwatch_log_metric_filter" "llm_input_tokens" {
  name           = "${var.name_prefix}-llm-input-tokens"
  log_group_name = var.api_log_group_name
  pattern        = "{ $.event = \"llm_usage\" }"

  metric_transformation {
    name          = "LLMInputTokens"
    namespace     = "OpenVault/App"
    value         = "$.input_tokens"
    default_value = "0"
    unit          = "Count"
  }
}

resource "aws_cloudwatch_log_metric_filter" "llm_errors" {
  name           = "${var.name_prefix}-llm-errors"
  log_group_name = var.api_log_group_name
  pattern        = "{ $.event = \"llm_error\" }"

  metric_transformation {
    name          = "LLMErrors"
    namespace     = "OpenVault/App"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "llm_tokens_daily" {
  alarm_name          = "${var.name_prefix}-bedrock-tokens-daily"
  alarm_description   = "Daily Bedrock token spend guard (throttle cost runaway; see docs/COST.md)"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "LLMOutputTokens"
  namespace           = "OpenVault/App"
  period              = 86400
  statistic           = "Sum"
  threshold           = var.daily_output_token_budget
  treat_missing_data  = "notBreaching"

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "llm_errors" {
  alarm_name          = "${var.name_prefix}-bedrock-errors"
  alarm_description   = "LLM provider errors (throttling, model not enabled, auth)"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "LLMErrors"
  namespace           = "OpenVault/App"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  treat_missing_data  = "notBreaching"

  alarm_actions = local.alarm_actions

  tags = local.common_tags
}

# ------------------------------------------------------------- ALB alarms
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${var.name_prefix}-alb-5xx"
  alarm_description   = "ALB returning 5xx to users"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"
  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = local.alarm_actions

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts" {
  alarm_name          = "${var.name_prefix}-alb-unhealthy-targets"
  alarm_description   = "ALB has unhealthy targets (api or web)"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = local.alarm_actions

  tags = local.common_tags
}

# -------------------------------------------------------------- ECS alarms
resource "aws_cloudwatch_metric_alarm" "service_below_desired" {
  for_each = var.service_desired_counts

  alarm_name          = "${var.name_prefix}-ecs-${each.key}-below-desired"
  alarm_description   = "ECS service ${each.key} is running fewer tasks than desired"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "SampleCount"
  threshold           = 1
  treat_missing_data  = "breaching"
  dimensions = {
    ClusterName = var.cluster_name
    ServiceName = each.key
  }

  # SampleCount of CPUUtilization samples ~= running tasks; a stopped service
  # stops emitting -> breaching. Simpler and honest at this scale.
  alarm_actions = local.alarm_actions

  tags = local.common_tags
}

# -------------------------------------------------------------- RDS alarms
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.name_prefix}-rds-cpu"
  alarm_description   = "RDS CPU above 80% for 10 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  dimensions = {
    DBInstanceIdentifier = var.db_instance_identifier
  }

  alarm_actions = local.alarm_actions

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  alarm_name          = "${var.name_prefix}-rds-storage"
  alarm_description   = "RDS free storage below 5 GB"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 5000000000
  dimensions = {
    DBInstanceIdentifier = var.db_instance_identifier
  }

  alarm_actions = local.alarm_actions

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  alarm_name          = "${var.name_prefix}-rds-connections"
  alarm_description   = "RDS connections above 120 (approaching t-class limits)"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 120
  dimensions = {
    DBInstanceIdentifier = var.db_instance_identifier
  }

  alarm_actions = local.alarm_actions

  tags = local.common_tags
}

# --------------------------------------------------------------- budgets
resource "aws_budgets_budget" "total" {
  count = var.budget_monthly_limit_usd > 0 ? 1 : 0

  name         = "${var.name_prefix}-monthly-total"
  budget_type  = "COST"
  time_unit    = "MONTHLY"
  limit_amount = tostring(var.budget_monthly_limit_usd)
  limit_unit   = "USD"

  dynamic "notification" {
    for_each = { "50" = 50, "80" = 80, "100" = 100 }
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = var.alert_email != "" ? [var.alert_email] : []
    }
  }

  tags = local.common_tags
}
