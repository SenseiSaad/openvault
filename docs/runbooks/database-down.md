# Runbook — Database down

**Symptom:** `/api/health` returns 503 with `"db": false`; API logs show
`OperationalError`/`psycopg2.OperationalError`; login and upload fail.

## 1. Triage (2 minutes)

```bash
aws rds describe-db-instances --db-instance-identifier openvault-prod-postgres \
  --query 'DBInstances[0].{status:DBInstanceStatus,class:DBInstanceClass,multiAZ:MultiAZ,endpoint:Endpoint.Address}'
aws cloudwatch get-metric-statistics --namespace AWS/RDS \
  --metric-name DatabaseConnections --dimensions Name=DBInstanceIdentifier,Value=openvault-prod-postgres \
  --start-time "$(date -u -d '30 minutes ago' +%FT%TZ)" --end-time "$(date -u +%FT%TZ)" \
  --period 300 --statistics Average
```

Check in order:

| Cause | Giveaway | Fix |
|---|---|---|
| RDS maintenance/failover | RDS event “failover” / status `rebooting` | Wait; single-AZ has a short outage. Multi-AZ is the upgrade. |
| Storage/CPU/connection exhaustion | `rds-storage`, `rds-cpu`, `rds-connections` alarms | Scale class/storage; find the leaked connection in API logs. |
| Security group / subnet change | connection timeout, RDS `Available` | Re-apply Terraform; check the RDS SG allows the api/worker SGs on 5432. |
| Bad migration | `relation does not exist` in `/openvault/prod/api` | Run `migrate` task; never hand-edit. |
| Credentials rotated | `password authentication failed` | Update SSM `DATABASE_URL`, then apply/deploy. |

## 2. Recover

* RDS restart: `aws rds reboot-db-instance --db-instance-identifier openvault-prod-postgres`
  (brief outage; do not do this repeatedly).
* If the instance is corrupted or lost, restore via RDS PITR per
  `restore.md`; do not restore over the only copy.
* API tasks reconnect automatically after RDS returns; no container restart is
  required. If connection pools remain bad, force a new deployment:
  `aws ecs update-service --cluster openvault-prod-cluster --service api --force-new-deployment`.

## 3. Verify

* `/api/health` → 200 with `"db": true`.
* `scripts/smoke_test.sh` with a real smoke account.
* CloudWatch `openvault-prod-rds-*` alarms return to OK.

## 4. Escalate

RDS is managed: open an AWS Support case if the instance is stuck in
`rebooting`/`incompatible-network` or PITR cannot create a new instance. Keep
the old instance until the restored one is verified.
