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
