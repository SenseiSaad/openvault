# Optional single-host Ollama (enable_model_host = false by default).
# The path to a self-hosted open-source model later — see ADR 0003.
# One EC2 instance in a public subnet (no NAT in this VPC), Docker + Ollama via
# user_data, reachable ONLY from the api/worker security groups on 11434,
# no SSH (SSM Session Manager only), IMDSv2 required, encrypted EBS, and an
# optional night/weekend stop schedule to kill idle cost.
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
  enabled     = var.enable_model_host
  common_tags = merge(var.tags, { Layer = "model_host" })
}

data "aws_ami" "al2023_arm64" {
  count = local.enabled ? 1 : 0

  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-kernel-6.1-arm64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_iam_role" "ssm" {
  count = local.enabled ? 1 : 0

  name = "${var.name_prefix}-model-host-ssm"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  count = local.enabled ? 1 : 0

  role       = aws_iam_role.ssm[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "this" {
  count = local.enabled ? 1 : 0

  name = "${var.name_prefix}-model-host-profile"
  role = aws_iam_role.ssm[0].name
}

resource "aws_launch_template" "this" {
  count = local.enabled ? 1 : 0

  name_prefix   = "${var.name_prefix}-model-host-"
  image_id      = data.aws_ami.al2023_arm64[0].id
  instance_type = var.instance_type

  iam_instance_profile {
    arn = aws_iam_instance_profile.this[0].arn
  }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size = var.root_volume_gb
      volume_type = "gp3"
      encrypted   = true
    }
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required" # IMDSv2 only
  }

  network_interfaces {
    security_groups = [var.model_host_sg_id]
    subnet_id       = var.subnet_id
  }

  # Docker + Ollama. Model pulls happen over the internet via the public
  # subnet (no NAT in this VPC) — see docs/decisions/0004.
  user_data = base64encode(<<-USERDATA
    #!/bin/bash
    dnf install -y docker
    systemctl enable --now docker
    docker run -d --name ollama --restart unless-stopped \
      -p 127.0.0.1:11434:11434 \
      -v /opt/ollama:/root/.ollama \
      ollama/ollama:latest
    USERDATA
  )

  tags = merge(local.common_tags, { Name = "${var.name_prefix}-model-host" })
}

resource "aws_autoscaling_group" "this" {
  count = local.enabled ? 1 : 0

  name                = "${var.name_prefix}-model-host"
  min_size            = var.min_size
  max_size            = var.min_size
  desired_capacity    = var.min_size
  vpc_zone_identifier = [var.subnet_id]

  launch_template {
    id      = aws_launch_template.this[0].id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${var.name_prefix}-model-host"
    propagate_at_launch = true
  }
}

# Optional cost schedule: stop nights, start mornings (disabled by default).
resource "aws_autoscaling_schedule" "night_stop" {
  count = local.enabled && var.enable_cost_schedule ? 1 : 0

  autoscaling_group_name = aws_autoscaling_group.this[0].name
  scheduled_action_name  = "${var.name_prefix}-model-host-night-stop"
  min_size               = 0
  max_size               = 0
  desired_capacity       = 0
  recurrence             = var.stop_cron
}

resource "aws_autoscaling_schedule" "morning_start" {
  count = local.enabled && var.enable_cost_schedule ? 1 : 0

  autoscaling_group_name = aws_autoscaling_group.this[0].name
  scheduled_action_name  = "${var.name_prefix}-model-host-morning-start"
  min_size               = 1
  max_size               = 1
  desired_capacity       = 1
  recurrence             = var.start_cron
}
