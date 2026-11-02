# Checkov exceptions

Run: `checkov -d infra --framework terraform --config-file .checkov.yml`

Every skipped check below is a DOCUMENTED DECISION, not an oversight. The
recurring themes:

| Theme | Checks | Decision |
|---|---|---|
| Public subnets, no NAT | CKV_AWS_130, CKV_AWS_333, CKV_AWS_382, CKV2_AWS_5 | ADR 0004 — tasks egress via IGW; RDS/Redis stay isolated. Revisit with the first customer security review. |
| AWS-managed encryption | CKV_AWS_158, CKV_AWS_145, CKV_AWS_119, CKV_AWS_118 | CloudWatch uses AWS-owned keys; S3/ECR use free AWS-managed KMS keys. Customer-managed KMS + rotation is a later hardening pass. |
| HA upgrades deferred | CKV_AWS_144, CKV_AWS_260, CKV_AWS_161, CKV_AWS_157, CKV_AWS_353 | Single-node/multi-AZ-off by design until real traffic — costs $55+/mo now for zero users. Trigger: first paying customer. |
| Logging niceties | CKV_AWS_18 (state/access-logs buckets), CKV2_AWS_62, CKV2_AWS_28 | The access-logs bucket cannot log to itself; event notifications have no consumers yet. |
| Checker limitations | CKV2_AWS_5, CKV_AWS_394, CKV_AWS_355/356, CKV2_AWS_61 | SG attachment graph flows through module variables; ARN wildcards are resolved per-environment into exact ARNs. |
