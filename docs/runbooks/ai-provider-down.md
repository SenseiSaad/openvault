# Runbook — Bedrock / AI provider down

**Symptom:** users get “model is not reachable” / “Model error”; the
`openvault-prod-bedrock-errors` alarm fires; `/api/llm-status` reports
`online: false`. Retrieval still returns sources; answers degrade.

## 1. Confirm scope

```bash
aws logs filter-log-events --log-group-name /openvault/prod/api \
  --filter-pattern '{ $.event = "llm_error" }' --limit 20
aws cloudwatch describe-alarms --alarm-name-prefix openvault-prod-bedrock
```

* `AccessDeniedException` / “model not enabled” → Bedrock model access or the
  inference-profile ARN is wrong.
* `ThrottlingException` → quota; check Service Quotas for Bedrock in
  `ap-south-1` and the per-company rate limits.
* `Credentials` / `No credentials` → the ECS task role or task definition lost
  its role; check `openvault-prod-ecs-api` task role.
* Timeouts → AWS Health Dashboard / provider status; open an AWS case.

Run the one-off check inside a task (or as a one-off ECS task):

```bash
aws ecs execute-command --cluster openvault-prod-cluster --task <api-task-arn> \
  --container api --interactive --command "python manage.py check_bedrock"
```

It prints a clear “model access / inference profile” message and exits nonzero.

## 2. Fastest mitigations

1. **BYO-key tenants are unaffected** — only the platform default provider is
   down.
2. **Bedrock model access:** AWS console → Bedrock → Model access → request or
   enable Claude Haiku 4.5 for `ap-south-1`; confirm the `in.` inference
   profile ARN matches `BEDROCK_MODEL` and the Terraform `bedrock_model_arns`.
3. **Quota:** request a Service Quotas increase; temporarily lower per-user ask
   limits or switch the platform default to a cheaper model only after checking
   answer quality. A provider change is a Terraform env change + deploy, not a
   runtime secret edit.
4. **Task role:** confirm `bedrock:InvokeModel` and
   `InvokeModelWithResponseStream` are allowed only on the configured ARNs.
   Do not add a broad `*` resource or a stored API key as a shortcut.

## 3. Embeddings degraded

If chat works but indexes have no vectors, retrieval silently falls back to
keyword search:

1. `python manage.py check_embeddings` (exit 0 required).
2. `python manage.py reindex_embeddings` (safe to re-run; fills missing vectors).
3. Re-check; large corpora should run while the worker is otherwise idle.

## 4. After recovery

* `/api/llm-status` online; run one `/api/ask` per tenant type.
* Confirm `bedrock-tokens-daily` and budget alarms are not still alarming.
* Write down the cause (quota vs access vs outage) — it changes the next action.
