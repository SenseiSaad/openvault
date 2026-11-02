# Alert rules (CloudWatch → SNS email)

Terraform creates these in `infra/modules/observability`. Confirm the SNS email
subscription after the first apply; an unconfirmed subscription receives
nothing. Each rule names the runbook to open.

| Alarm | Trigger | Severity | Runbook |
|---|---|---|---|
| `openvault-prod-alb-5xx` | target 5xx > 10 in 5 min | Critical | `bad-deploy-rollback.md`, then `database-down.md` |
| `openvault-prod-alb-unhealthy-targets` | any unhealthy api/web target for 2×30s | Critical | `service-not-starting.md` |
| `openvault-prod-ecs-<svc>-below-desired` | no CPU datapoints (no running task) for 10 min | Critical | `service-not-starting.md` |
| `openvault-prod-bedrock-errors` | ≥5 `llm_error` JSON lines in 5 min | High | `ai-provider-down.md` |
| `openvault-prod-bedrock-tokens-daily` | input+output tokens > daily budget | Medium | Check for runaway asks/leaked credentials; `docs/COST.md` |
| `openvault-prod-rds-cpu` | RDS CPU >80% for 10 min | High | `database-down.md` |
| `openvault-prod-rds-storage` | free storage <5 GB | High | `database-down.md`; increase gp3 / archive old data |
| `openvault-prod-rds-connections` | connections >120 | High | `database-down.md` |
| AWS Budgets | actual spend > $20/$35/$50/$100 (prod), $10/$15 (staging) | Medium | Check Billing/Cost Explorer; `docs/COST.md` |

## Wiring notes

* **Uptime monitor:** point an external monitor at
  `https://<new-subdomain>/api/health` (2 failures = page). `/api/health/live`
  is the cheap liveness probe; use it for a container/host check.
* **Backup freshness:** CloudWatch cannot see “no object” directly. Add a
  synthetic check or a small Lambda/EventBridge rule that fails if
  `s3://<backups>/backups/postgres/` has no object in 26h. The backup ECS task
  itself only alarms on task failure if you add a failed-task alarm — do that
  before launch.
* **SES:** enable SES bounce/complaint notifications to an SNS topic and watch
  the reputation dashboard. A bounce spike can pause sending; open
  `ai-provider-down.md` only for AI, not email — use the SES console for
  suppression list and verified identities.
* **Certificate expiry:** ACM auto-renews validated certificates, but the
  Route 53 validation record must stay in place. Add an external TLS-expiry
  check (30/14/7 days) for the public hostname.
* **Test every alert once.** Kill a task, stop the DB briefly, or publish a
  synthetic `llm_error` line in staging and confirm the email arrives. An alert
  you have never seen fire is a rumor.
