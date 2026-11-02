# Cost estimate — OpenVault on AWS (ap-south-1)

**These are list-price estimates, not a quote.** They were assembled from the
resource shapes in `infra/` (ECS Fargate, RDS, ElastiCache, ALB, S3, SES,
CloudWatch) and rounded. Confirm with the AWS Pricing Calculator and your
first invoice before promising a number to anyone. Bedrock usage is separate
because it scales with questions asked.

## Assumptions

- Region `ap-south-1` (Mumbai), on-demand pricing, no Savings Plans or credits.
- 730 hours/month.
- Production: 1 API task (0.5 vCPU / 1 GB), 1 worker (0.25 vCPU / 0.5 GB),
  1 web task (0.25 vCPU / 0.5 GB); Fargate public-subnet tasks (no NAT).
- Production RDS: `db.t4g.medium`, PostgreSQL 16, 25 GB gp3, single-AZ.
- Production ElastiCache: one `cache.t4g.micro` Redis node.
- One internet-facing ALB with a small amount of LCU traffic.
- 50 GB of documents/backups, 10 GB of CloudWatch logs ingested, 90-day log
  retention, one Route 53 hosted zone for a delegated subdomain.
- **Excludes:** Bedrock tokens, payment processing fees, support plan, domain
  registration, taxes, your time, and the retired Render/Amplify stack.

## Production (per month)

| Layer | Service / size | Est. USD/mo | Notes |
|---|---|---:|---|
| Compute | ECS Fargate: api 0.5 vCPU/1 GB, worker 0.25/0.5, web 0.25/0.5 | **~$42** | Fargate bills vCPU-hour + GB-hour. Worker is the first candidate for Spot. |
| Database | RDS `db.t4g.medium`, 25 GB gp3, single-AZ | **~$46** | Multi-AZ roughly doubles the instance charge when real customers arrive. |
| Cache | ElastiCache `cache.t4g.micro` | **~$12** | Rate-limit counters + Celery broker. |
| Edge | ALB + ACM certificate | **~$19** | ALB hourly + LCU; ACM is free. |
| Storage | S3 documents + backups | **~$2** | Versioning on; backups move to Standard-IA after 30 days. |
| Observability | CloudWatch logs, 6 alarms, SNS, 1 budget | **~$5** | 90-day retention; JSON logs. Budgets beyond the free two cost a few cents/day. |
| Email | SES | **~$1** | $0.10 per 1,000 emails; excludes dedicated IP. |
| DNS / registry | Route 53 zone + ECR storage | **~$2** | ECR lifecycle keeps 30 tagged images. |
| Egress | Data transfer out | **~$2** | Small at launch; grows with uploads/downloads outside AWS. |
| **Infra subtotal** | | **~$131/mo** | Add Bedrock below. |

A cheaper launch profile (single API task, `db.t4g.micro`, 14-day logs) lands
around **$95–$105/mo**. Do not run a second full environment unless you need it.

## Staging (per month, destroyable)

Staging uses the same modules with smaller inputs: `db.t4g.micro`, 20 GB,
single-AZ, one task per service, 14-day logs. Estimated **~$95–$110/mo** while
running. It is destroyed with the commands in `docs/DEPLOY.md`; RDS deletion
protection and the final snapshot are off, and S3 buckets are force-destroyable
**only in staging**.

## Bedrock (variable)

The app logs `input_tokens`, `output_tokens`, and `total_tokens` per AI call.
The CloudWatch metric filter `{ $.event = "llm_usage" }` aggregates them, and a
daily alarm fires at `daily_total_token_budget` (3M in prod, 500k in staging).
This is a **trend signal**: Bedrock streaming returns exact usage for Converse,
but some other providers do not report per-chunk usage.

| Model | Input / 1M tokens | Output / 1M tokens | Est. / 1,000 questions* |
|---|---:|---:|---:|
| Claude Haiku 4.5 (India `in.` profile) | ~$1.10 | ~$5.50 | **~$6.05** |
| Titan Text Embeddings V2 | ~$0.02 / 1M | n/a | ~$0.02 |

\*Assumes 3,000 input + 500 output tokens per question (retrieved passages,
history, system prompt, answer). At 1,500 input + 400 output the same model is
~$3.85/1,000. Measure with the metric filter after launch; do not quote this as
an invoice.

**Before claiming Bedrock pricing or privacy terms to customers:** re-read the
current AWS Bedrock pricing page, service terms, and data-processing FAQ. Do not
claim "prompts are never used for training" or "data never leaves India" unless
you have verified the current AWS terms and the `in.` inference profile's
routing at that time. Mark those claims **UNVERIFIED** until then.

## Break-even context

At ~$131/mo of infrastructure before Bedrock:

- $9 Starter (if that is the final price) needs ~15 paying companies.
- $15 Starter needs ~9 companies.
- $49 Business needs ~3 companies.
- $129 Enterprise needs ~1 company.

Payment processing, refunds, support, and taxes are **not** in those numbers.
If you use Stripe, add its per-transaction fee to the price or accept a lower
margin.

## Cheapest safe levers, in order

1. **Destroy staging when not testing** — saves ~$100/mo.
2. **Fargate Spot for the worker** (not the API) — ~70% off that task; retries
   make interruption acceptable for background indexing.
3. **Single-AZ RDS at launch** — already the default; enable Multi-AZ only when
   downtime would cost more than ~$46/mo.
4. **Graviton (ARM64) task definitions** — later; the image must be multi-arch
   first (ADR 0007).
5. **Shorter log retention in staging** (14d) and S3 lifecycle for backups.
6. **Use a cheaper chat model for Free tier** only after measuring answer
   quality; do not silently downgrade paid tenants.

## What is NOT included

- AWS Business/Enterprise support (~10% of spend or a minimum).
- Bedrock model-access requests, provisioned throughput, or custom models.
- A second region / disaster recovery.
- CloudFront, WAF, or Shield Advanced.
- Domain registration and email deliverability tooling.
- Engineering time and on-call.

## Verification after first deployment

Open **AWS Billing → Cost Explorer**, group by service, and compare the first
full month to this table. If a line is off by more than ~30%, update this file
and the Terraform inputs. Budget alarms are configured at $20/$35/$50/$100 in
prod and $10/$15 in staging; confirm the SNS email subscription after apply.
