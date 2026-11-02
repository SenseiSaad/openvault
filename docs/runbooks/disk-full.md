# Runbook — Disk/storage pressure

**Symptom:** `/api/health` 503 with `"storage": false`; uploads fail; Fargate
task stops with `OutOfMemory`/no space; RDS storage alarm; backup task fails.

OpenVault on ECS is mostly stateless: documents and generated forms go to S3
when `AWS_STORAGE_BUCKET_NAME` is set (it is in Terraform). The container's
20 GB ephemeral disk is only for code, `/tmp`, and temporary files.

## 1. Identify the layer

| Layer | Check | Fix |
|---|---|---|
| Fargate task disk | ECS task stopped reason, CloudWatch `/openvault/prod/api` for `No space left`; task ephemeral storage | Restart/redeploy; remove large temp writes; raise `ephemeral_storage` only if the app genuinely needs it |
| S3 documents | Bucket size/lifecycle; `storage: false` means the health probe could not write/read S3 | Check task role `s3:PutObject/GetObject`, bucket policy, KMS; S3 itself does not “fill up” |
| RDS | `openvault-prod-rds-storage` alarm, `FreeStorageSpace` | Increase gp3 / autoscaling; archive or delete old `AskLog` per retention policy |
| CloudWatch logs | Log group stored bytes | Lower retention (90d prod /14d staging) or reduce log volume; never log prompts/documents |
| ECR | Repository size | Lifecycle rule keeps 30 tagged images; prune untagged images if needed |

## 2. Safe reclaim

```bash
# Fargate: force new tasks (old ephemeral disk is discarded)
aws ecs update-service --cluster openvault-prod-cluster --service api --force-new-deployment

# ECR: list large images; lifecycle should already prune >30
aws ecr describe-images --repository-name openvault-prod-api \
  --query 'sort_by(imageDetails,&imageSizeInBytes)[-5:].[imageTags,imageSizeInBytes]'
```

Do **not** delete S3 objects under a tenant prefix by hand. Use lifecycle rules
or the application; S3 versioning is the recovery path for accidental deletes.

## 3. RDS storage

* Increase `db_allocated_storage_gb`/`db_max_allocated_storage_gb` in Terraform
  and apply (storage autoscaling is already enabled up to the max).
* `AskLog` is pruned at 90 days; verify the scheduled cleanup is running.
* If a long-running transaction/WAL is filling the disk, find it in RDS
  Performance Insights before resizing.

## 4. Verify

* `/api/health` → 200 with `"storage": true`.
* Upload one small document, download it, delete it; confirm audit rows.
* Backup task succeeds and a new object appears in S3.
