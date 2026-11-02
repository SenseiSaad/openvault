# Runbook — Cost alarm / budget threshold fired

**Symptom:** AWS Budgets email ($20/$35/$50/$100 thresholds) or the Bedrock
daily-token alarm fired.

## 1. Find the driver (5 minutes)

* **Bedrock token alarm** (`openvault-*-bedrock-tokens-daily`): check the
  CloudWatch metric `OpenVault/App → LLMOutputTokens` for a spike. Drill into
  CloudWatch Logs Insights on `/openvault/prod/api`:
  `fields company_id, model, output_tokens | filter event = "llm_usage"`
  — a single company runaway or a leaked key shows up immediately. The app's
  20/min per-user ask limit and plan caps (25k/mo Enterprise max) bound this.
* **Budget alarm (infra)**: Cost Explorer → group by service, day-over-day.
  Common culprits: NAT/egress surprises (none in this design), RDS storage
  autoscaling, forgotten staging environment (destroy it:
  `terraform destroy` in `infra/envs/staging`).

## 2. Contain

* Suspect key: rotate `SECRET_KEY` and any BYO keys (SSM), review CloudTrail
  for unusual `bedrock:Invoke*` from unexpected principals.
* Genuine growth: update `daily_output_token_budget` and the budget in
  `modules/observability` (variables), then price accordingly (docs/COST.md).
