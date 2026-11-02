# Runbook — ECS service not starting / failing health checks

**Symptom:** `aws ecs wait services-stable` times out; tasks cycle
`PROVISIONING -> PENDING -> STOPPED`; ALB target group shows unhealthy.

## 1. Read the stopped-task reason (90% of cases)

```bash
aws ecs describe-tasks --cluster openvault-prod --tasks <task-arn> \
  --query 'tasks[0].[lastStatus,stopCode,stoppedReason,containers[0].[name,exitCode,reason]]'
```

| stopCode / reason | Cause | Fix |
|---|---|---|
| `EssentialContainerExited` exit 1, logs show `SECRET_KEY required` | Missing SSM parameter | Push via `scripts/push_env_to_ssm.sh` |
| TaskRole error in logs | SSM parameter exists but task role can't read it | Check role policy path `/openvault/<env>/*` |
| `CannotPullContainer` | Image tag doesn't exist in ECR | Verify the tag pushed by CI (`deploy.yml`) |
| `ResourceInitializationError: unable to pull secrets` | Execution role can't read SSM | Check execution role SSM policy |
| Health check fails in ALB but container is running | DB unreachable / storage probe failing | See `database-down.md`; verify the RDS security group allows the task SG on 5432 |

## 2. Logs

```bash
aws logs tail /openvault/prod/api --since 15m --follow
```

## 3. Break-glass exec (audited via CloudTrail)

```bash
aws ecs execute-command --cluster openvault-prod --task <arn> \
  --container api --interactive --command "/bin/sh"
```

Requires ECS Exec enabled (it is, in the task definition) and your IAM user
having `ecs:ExecuteCommand`.
