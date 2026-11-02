# Runbook — ECS service not starting

**Symptom:** `openvault-prod-ecs-<svc>-below-desired` or ALB unhealthy-targets
alarm; a deployment is stuck; tasks stop immediately.

## 1. Find the stopped task

```bash
aws ecs list-tasks --cluster openvault-prod-cluster --service-name api --desired-status STOPPED
aws ecs describe-tasks --cluster openvault-prod-cluster --tasks <task-arn> \
  --query 'tasks[0].{stoppedReason:stoppedReason,containers:containers[].{name:name,exit:exitCode,reason:reason}}'
```

Common causes:

| Cause | Evidence | Fix |
|---|---|---|
| Image/tag missing | `CannotPullContainerError` | Confirm ECR image tag SHA exists; roll back to previous tag. |
| SSM secret missing | `ResourceInitializationError` / secret not found | Push the SSM parameter (`scripts/push_env_to_ssm.sh`) and ensure the execution role can read it. |
| Migration not run | API exits with `relation does not exist` | Run the deploy (one-off `migrate` task) before updating services. |
| Health check failing | ALB target unhealthy, task running | Check `/openvault/prod/api`; `/api/health` needs DB + S3. |
| CPU/memory too small | OOMKilled / task stopped | Raise task size; check memory metric. |
| Security group | task cannot reach RDS/Redis/S3 | Re-apply Terraform; SGs are managed. |

## 2. Logs

```bash
aws logs tail /openvault/prod/api --follow
aws logs tail /openvault/prod/migrate --since 30m
```

The migrate task is one-off; its logs are the first place to look after a
failed deploy.

## 3. Recover

* If the task definition is bad: deploy the previous SHA via the **Rollback**
  workflow (it skips migrations).
* If a secret is missing: push it, then force a new deployment
  (`aws ecs update-service --force-new-deployment`).
* If the cluster/service is missing: run the **Terraform apply** workflow for
  that environment, then the **Deploy** workflow.

## 4. Verify

* `aws ecs wait services-stable`.
* `/api/health` 200; `scripts/smoke_test.sh` passes.
* The ECS alarm returns to OK and the ALB target group shows healthy targets.
