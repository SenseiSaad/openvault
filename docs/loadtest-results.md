# Load test results — 2026-11-01

Environment: local Docker host, gunicorn **2 workers × 4 threads**, SQLite,
~1,000-chunk corpus (50 docs), chat provider = `LLM_PROVIDER=fake` (150 ms
simulated model latency + ~2.2 s token stream, no real model spend), k6 v1.4.0.
The numbers measure **OpenVault's own pipeline** (retrieval + streaming +
worker threading); real-model TTFB adds the provider's first-token latency on
top.

Scripts: `loadtests/ask.js` (streaming asks, ramp 5→15 VUs), `loadtests/browse.js`
(authenticated reads at 10 VUs). Rerun with:

```bash
SQLITE_PATH=/tmp/ov-load.sqlite3 python manage.py migrate
SQLITE_PATH=/tmp/ov-load.sqlite3 python manage.py seed_loadtest
SQLITE_PATH=/tmp/ov-load.sqlite3 LLM_PROVIDER=fake gunicorn config.wsgi:application \
  -b 127.0.0.1:8001 --workers 2 --threads 4
k6 run -e BASE=http://127.0.0.1:8001 loadtests/ask.js
```

## Numbers to quote

| Metric | 1 user | 5–15 concurrent | Notes |
|---|---|---|---|
| Ask TTFB (first NDJSON line ≈ sources event) | **15 ms median** | 172 ms median, p95 7.9 s @15 VU | = retrieval cost; the model adds its own first-token latency |
| Ask full streamed duration | 2.76 s median | 3.3 s median, p95 11.5 s @15 VU | dominated by the (simulated) token stream |
| Error rate | 0% | **0.00%** over 176 streamed asks | zero 5xx, zero dropped streams |
| Browse endpoints (me/usage/documents 200-row page) @10 VU | — | 100% checks, p95 < 1.5 s | threshold met with headroom |
| Ask throughput | ~0.4/s | ~1.45/s sustained | streaming holds a thread per answer |

## Reading

* At the launch profile (5–7 concurrent users) the stack holds 0% errors with
  TTFB well under a second — before the real model adds ~1–2 s.
* Degradation at 15 concurrent streamed asks is thread saturation (2 workers ×
  4 threads = 8 concurrent answers; the 8th+ request queues). That matches the
  design limit and is the number to scale on (more workers, or move streaming
  to an async worker).
* The plan-quota gate was validated incidentally: a run against the Free plan
  402'd every ask after the 50-ask monthly limit — enforcement works under
  load.

---

## What this does and does not prove (updated 2026-11-02)

The numbers above are from a **local Docker host** with gunicorn and SQLite.
They are useful for comparing our own retrieval/streaming code, but they are
**not** an ECS/RDS/ElastiCache benchmark. Do not quote them as AWS capacity.
The AWS launch shape is one API task at **0.5 vCPU / 1 GB** (2 gunicorn
workers × 4 threads) with RDS `db.t4g.medium` and one Redis node.

### Run the same test against staging (optional, avoid Bedrock spend)

1. Seed a load-test tenant once, from an API task:
   ```bash
   aws ecs execute-command --cluster openvault-stg-cluster \
     --task <api-task-arn> --container api --interactive \
     --command "python manage.py seed_loadtest"
   ```
2. **Do not run `ask.js` against a real Bedrock model** unless you accept the
   token bill. For a pipeline-only run, temporarily set `LLM_PROVIDER=fake`
   in the staging Terraform `app_environment`, apply, and deploy; restore
   `bedrock` afterwards. The fake provider is for load tests only.
3. From a machine with internet access:
   ```bash
   BASE=https://<staging-host> USER=load@openvault.test PASS='<seed password>' \
     k6 run loadtests/ask.js
   BASE=https://<staging-host> USER=load@openvault.test PASS='<seed password>' \
     k6 run loadtests/browse.js
   ```
4. Record p95 TTFB, p95 full-stream, error rate, and whether the API ECS
   service scaled (target: CPU >60% for 3 minutes). If it did not scale, check
   the `api_min_capacity`/`api_max_capacity` target and the ALB request count.

### Launch interpretation

* At 5–15 concurrent streamed answers, the local result was 0% errors and
  p95 full-stream ~11.5 s with a simulated stream. A real model adds its own
  first-token latency.
* The API autoscaling policy is CPU target 60%, min 1 / max 3 in prod. That is
  a starting point, not a capacity plan; watch `ECS CPUUtilization` for two
  weeks and adjust. Worker is fixed at 1 with `--concurrency=2`; queue length
  is the signal to change it, not CPU.
* If `/api/ask` p95 exceeds 30 s (the k6 threshold) with a real model, check
  Bedrock latency first (`ai-provider-down.md`), then API CPU, then retrieval
  (`AskLog.latency_ms`).
