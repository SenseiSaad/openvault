# OpenVault documentation

## New AWS stack (this branch)

| Document | Use |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | ECS/Fargate network, data, security, request flow, failure domains. |
| [`DEPLOY.md`](DEPLOY.md) | First apply, DNS/SES/Bedrock, SSM secrets, GitHub OIDC, normal delivery, rollback. |
| [`COST.md`](COST.md) | List-price infrastructure and Bedrock estimates, budget alarms, cost levers. |
| [`INTERVIEW_NOTES.md`](INTERVIEW_NOTES.md) | Defensible architecture answers and the honest “not verified” list. |
| [`SECURITY.md`](SECURITY.md) | Secret policy, historical history finding, controls and gaps. |
| [`decisions/`](decisions/) | ADRs: Fargate, same-origin, no NAT, migration task, Bedrock role, OIDC, backups, Redis. |
| [`runbooks/restore.md`](runbooks/restore.md) | RDS PITR + logical restore, measured local drill, RPO/RTO. |
| [`runbooks/bad-deploy-rollback.md`](runbooks/bad-deploy-rollback.md) | Bad deploy, circuit breaker, manual rollback, schema rules. |
| [`runbooks/service-not-starting.md`](runbooks/service-not-starting.md) | ECS task/image/secret/health-check failures. |
| [`runbooks/database-down.md`](runbooks/database-down.md) | RDS outage triage and recovery. |
| [`runbooks/ai-provider-down.md`](runbooks/ai-provider-down.md) | Bedrock access/quota/outage, embeddings, provider switch. |
| [`runbooks/alerts.md`](runbooks/alerts.md) | Alarm → runbook map and alert-testing notes. |
| [`runbooks/disk-full.md`](runbooks/disk-full.md) | Fargate/S3/RDS/CloudWatch storage pressure. |
| [`runbooks/accidental-deletion.md`](runbooks/accidental-deletion.md) | S3 versions + database row recovery. |
| [`loadtest-results.md`](loadtest-results.md) | Local k6 numbers and how to run a staging test safely. |
| [`FINAL_REPORT.md`](FINAL_REPORT.md) | Section 8 handoff: what is verified, what is not, costs, inputs, risks, commands. |

## Legacy live deployment (do not modify)

| Document | Use |
|---|---|
| [`aws/README.md`](aws/README.md) | Legacy AWS/Amplify + Render notes (kept for the live site). |
| [`aws/bedrock.md`](aws/bedrock.md) | Bedrock provider setup. |
| [`deployment/amplify-render-cloudflare.md`](deployment/amplify-render-cloudflare.md) | Legacy deployment runbook. |

The root [`README.md`](../README.md) remains the project overview and local
setup guide.
