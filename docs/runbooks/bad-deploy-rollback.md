# Runbook — Bad deploy / rollback

**Symptom:** 5xx spike, unhealthy targets, failed task startup, or a regression
within minutes of a deploy.

## 1. Confirm it is the deploy

```bash
aws ecs describe-services --cluster openvault-prod-cluster \
  --services api web worker \
  --query 'services[].{name:serviceName,desired:desiredCount,running:runningCount,deployments:deployments[].{status:status,rollout:rolloutState,taskDef:taskDefinition}}'
aws elbv2 describe-target-health --target-group-arn <api-tg-arn>
```

ECS deployment circuit breaker is enabled with rollback. A task that fails ALB
health checks is replaced automatically; if the whole deployment fails, ECS
rolls back to the previous task definition. Verify the deployment status before
doing anything manual.

## 2. Roll back through GitHub (preferred)

Actions → **Rollback** → Run workflow:

* environment: `production` (requires the protected-environment approval)
* image_tag: the previous commit SHA (images are immutable and retained 30 deep)

The workflow redeploys the existing ECR image with `SKIP_MIGRATE=1`, updates
api/worker/web, waits for stability, and runs the smoke test. It does **not**
reverse database migrations.

## 3. Roll back from the CLI (break-glass)

```bash
aws ecs update-service --cluster openvault-prod-cluster --service api \
  --task-definition openvault-prod-api:<previous-revision>
aws ecs update-service --cluster openvault-prod-cluster --service worker \
  --task-definition openvault-prod-worker:<previous-revision>
aws ecs update-service --cluster openvault-prod-cluster --service web \
  --task-definition openvault-prod-web:<previous-revision>
aws ecs wait services-stable --cluster openvault-prod-cluster --services api worker web
```

Or use the same deploy script with the old tag after configuring ECR/ECS env:
`./scripts/deploy_ecs.sh prod <old-sha>` (set `SKIP_MIGRATE=1`).

## 4. Database schema

Migrations run in the one-off `migrate` task **before** service updates. They
are forward-only in practice; a rolled-back image can be older than the schema.
Rules:

* Additive migrations (new nullable columns/tables) are safe for one release.
* Never rename/drop a column in the same release that stops writing it.
* Do not hand-reverse a data migration. If the schema change is destructive and
  the old image cannot run, restore the database per `restore.md` and accept
  the RPO.

## 5. Verify

* `aws ecs wait services-stable` returns.
* `curl -fsS https://<host>/api/health` → 200 with `db` and `storage` true.
* Run `BASE_URL=... REQUIRE_AUTH_SMOKE=1 ./scripts/smoke_test.sh`.
* Check CloudWatch `/openvault/prod/api` for new tracebacks and the
  `openvault-prod-llm-errors` alarm is OK.
