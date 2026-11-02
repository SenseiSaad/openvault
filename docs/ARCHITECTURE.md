# Architecture

OpenVault: multi-tenant RAG knowledge base. One AWS region (ap-south-1),
ECS Fargate, same domain for frontend + API so HttpOnly cookie sessions work.

```mermaid
flowchart LR
  U[Users] -->|HTTPS| R53[Route 53 subdomain zone]
  R53 --> ALB[Application Load Balancer + ACM]
  ALB -->|/api/* /admin/* /static/*| API[ECS Fargate: api\nDjango + gunicorn]
  ALB -->|default /| WEB[ECS Fargate: web\nNext.js standalone]
  API --> RDS[(RDS PostgreSQL 16\npgvector, private subnets)]
  API --> REDIS[(ElastiCache Redis\nprivate subnets)]
  WORKER[ECS Fargate: worker\nCelery] --> RDS
  WORKER --> REDIS
  API --> S3[S3 documents bucket\nversioned, tenant prefixes]
  WORKER --> S3
  API -->|IAM task role, no keys| BR[Amazon Bedrock\nClaude Haiku + Titan Embed\nIndia inference profile]
  API --> SES[SES via SMTP]
  CRON[EventBridge nightly] --> MIG[ECS run-task:\npg_dump to backups bucket]
  MIG --> BS3[S3 backups bucket]
```

## Request flow

1. Browser → Route 53 (subdomain zone delegated from the parent DNS) → ALB
   (TLS 1.3 via ACM) → path rules: `/api/*`, `/admin/*`, `/static/*` to the api
   service; everything else to the web service.
2. The api service (Django/gunicorn) authenticates via HttpOnly JWT cookies,
   enforces tenant isolation at the query layer (`company` FK everywhere),
   retrieves with hybrid BM25 + pgvector cosine (filtered by the caller's
   document ids), and streams the answer from Bedrock through Converse.
3. The worker (Celery + Redis) indexes documents: extract → chunk → embed
   (Titan v2, 1024 dims) → store chunks + vectors in Postgres.
4. AI calls authenticate with the **ECS task role** — no API keys anywhere.
   The task-role policy allows only the configured model/inference-profile ARNs.

## Data flow

* Documents: browser → presigned S3 PUT (or multipart through the api for
  small files) → S3 under `<company-slug>/…` → Celery task reads, extracts,
  chunks, embeds, writes `core_chunk` rows with `embedding_vec` (pgvector).
* Chat: question → retrieval (pgvector KNN over the caller's allowed document
  set, BM25 rerank on the shortlist) → prompt → Bedrock stream → NDJSON to the
  browser → AskLog row (per-company usage metering) + structured
  `llm_usage` log line (cost metric).

## Trust boundaries

| Boundary | Control |
|---|---|
| Internet → ALB | TLS 1.3, WAF-ready (add later), ALB SG only 80/443 |
| ALB → services | SG references only; api reachable only from the ALB SG |
| api/worker → data | RDS/Redis SGs accept only the app SGs; isolated private subnets |
| Tasks → AWS APIs | IAM task roles, least privilege: S3 prefixes, SSM `/openvault/<env>/*`, named Bedrock ARNs only |
| Tenant → tenant | Django query-layer isolation, tested by a 17-case isolation matrix; chunks carry `company` FK |
| Tenant admin → platform | BYO LLM `base_url` validated against private/metadata IPs (SSRF guard), https-only |
| CI → AWS | GitHub OIDC, trust limited to one repo + refs; separate deploy / plan / apply roles |

## Sizing reality

One api task (1 vCPU/2GB) + one web + one worker serves the launch profile
(5–7 concurrent users, 2 concurrent streamed answers). Autoscaling on CPU to 3
api tasks. The load-test numbers in `docs/loadtest-results.md` are the
reference.
