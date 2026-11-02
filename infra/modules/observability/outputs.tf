output "sns_topic_arn" {
  description = "SNS topic for all alarms (add extra subscribers in the console)."
  value       = aws_sns_topic.alerts.arn
}
