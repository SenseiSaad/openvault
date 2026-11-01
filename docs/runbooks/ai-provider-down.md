# Runbook — AI provider down

**Symptom:** users get "The 'bedrock' model is not reachable… (Retrieved N
relevant document passages.)"; Sentry shows provider timeouts/5xx; `/api/llm-status`
reports `online: false`.

Retrieval still works when the chat provider is down — users see sources but
no answer. Embedding-provider outages are quieter (see "silent mode" below).

## 1. Confirm scope

```bash
curl -s https://<api-host>/api/llm-status   # needs an auth cookie
docker compose -f docker-compose.prod.yml logs api --tail 100 | grep -iE "bedrock|gemini|timeout|error"
```

* 403/Throttling from the provider → quota or key issue, not an outage.
* Connection timeouts from the box → network/endpoint issue.
* Provider status page (AWS Health Dashboard / Google status) → real outage.

## 2. Fastest mitigation: switch provider

The provider is runtime config, not code. Two switches:

* **Per-company BYO key tenants** are unaffected (their key, their provider) —
  only the shared platform default needs attention.
* **Platform default**: set `LLM_PROVIDER` (+ the matching key env, e.g.
  `GEMINI_API_KEY`) in `.env` / compose, then
  `docker compose -f docker-compose.prod.yml up -d api worker`.

Model quality differs between providers — a cheaper fallback is fine for an
outage window; say so in the status notice if answers change tone.

## 3. Silent mode: embeddings degraded, chat fine

If `check_embeddings` (or a Sentry warning about missing vectors) shows chunks
being indexed WITHOUT vectors, retrieval quietly degrades to keyword-only:

1. Fix the embedding provider (same switch as above).
2. Backfill: `python manage.py reindex_embeddings` (safe to re-run; only fills
   missing vectors). Big corpora: run in a `screen`/worker window.
3. Verify: `python manage.py check_embeddings` must exit 0.

## 4. After recovery

* Re-check `/api/llm-status` (`online: true`).
* Spot-check one `/api/ask` per tenant type (platform default + BYO company).
* If Bedrock throttling was the cause, review per-company ask limits and the
  provider quota in the AWS console; the app's 20/min per-user ask rate limit
  is usually the smaller lever.
