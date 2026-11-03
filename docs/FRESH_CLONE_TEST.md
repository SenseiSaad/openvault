# Fresh-clone test record

**Date:** 2026-11-03  
**Branch commit tested:** `e3c0340` (`infra`, before this report was added)  
**AWS apply/spend:** none

## Procedure

The `infra` branch had no upstream configured, so the clone was made from the
local branch rather than the hosted URL:

```bash
git clone --no-hardlinks --branch infra /home/saad/Desktop/OpenVault \
  /tmp/opencode/openvault-fresh-item7-20261103
```

In that empty clone, I followed the README setup through preflight using a fake
config (`us-east-1`, `invalid.test`, `owner/repository`) and placeholder-only
secret values. A no-op `session-manager-plugin` stub was put first on `PATH` so
the preflight could reach the credentials check; AWS credential environment
variables were removed and `AWS_EC2_METADATA_DISABLED=true`. Preflight passed
tool/config/env-file checks, then stopped with the expected clear error:

> AWS credentials are unavailable or cannot call sts:GetCallerIdentity.

This is the intended boundary before any account-backed plan/apply. No Terraform
apply, ECR push, or AWS resource operation was run.

The fresh clone then ran:

* `terraform init -backend=false` + `terraform validate` for bootstrap, every
  Terraform module, staging, and production — **pass**.
* `tflint --recursive --format compact` — **pass**.
* Checkov per root — bootstrap **43 passed / 0 failed / 0 skipped**; staging
  **198 passed / 0 failed / 1 skipped**; production **198 passed / 0 failed /
  1 skipped**.
* `find infra -name '*.tfstate*' -o -name '*.tfplan'` — no state or plan files.

The first cold provider download exceeded the shell time limit in this network
environment. Re-running with a shared Terraform plugin cache populated on this
host completed all roots. `scripts/bootstrap.sh` now creates/uses the user's
`~/.terraform.d/plugin-cache` during its full pipeline so downloads are reused
across config roots. Cold-download duration on a new network remains
**UNVERIFIED**.

## Issues found and fixes made

| Fresh-clone issue | Fix |
|---|---|
| State bucket, backend region, sample domain/email, and region defaults were embedded in Terraform/workflows. | Backends are partial and configured from ignored `deploy.config`; target tfvars/backend files are generated; static account/domain/region/email scan is clean in `infra/` and `.github/`. |
| The old env checker required `DATABASE_URL` before RDS existed and asked for non-secret Terraform values absent from the template. | `check_env.sh` now has preflight/runtime phases; DATABASE_URL is deferred until the RDS output exists. |
| Terraform could start ECS tasks before the first ECR images existed, and ECR was needed to push them. | Base apply creates ECR and task definitions/services at desired count zero; the image push follows; migrations and seed run before the services are enabled. |
| Staging used to own/reference an OIDC provider created by production, blocking staging-first deployment. | One provider and shared build/plan/apply roles now live in bootstrap; environment stacks create only their scoped deploy role. |
| The previous GitHub setup script left values for manual UI entry and used incomplete status-check names. | `setup_github.sh` reads Terraform outputs, uses `gh` to set variables/secrets and reviewer environments, and protects `main` with the CI gate. The exact check-run label is still **UNVERIFIED** until the first hosted Actions run. |
| The old smoke test checked only health and optional login, not a document/answer path. | The smoke script now covers signup, verification or the staging-only bypass, login, upload/index, cited streamed answer, cleanup, and logout. Both bypass and verification modes passed against a local HTTP mock; real ECS behavior is **UNVERIFIED**. |
| Staging S3 buckets were force-destroyed by Terraform and there was no guarded destroy path. | `destroy.sh` requires typed confirmation, snapshots RDS, requires an explicit S3/ECR empty flag, and blocks production without an extra flag. |
| `seed_demo` wrote files to container-local disk, which would disappear after an ECS task stopped. | Demo document creation now uses the storage abstraction so staging documents persist in S3. |
| Attendance tests assumed the first weekday of the month was “today”; they failed once the calendar advanced. | Tests freeze their test date to the first business day so absence expectations are deterministic. |

## Remaining fresh-clone gaps / UNVERIFIED

* The README clone URL names the hosted repository, but `infra` has not been
  pushed/upstreamed. A real hosted `git clone --branch infra` was therefore not
  possible in this test; the local branch clone was used instead.
* The real `session-manager-plugin` is not installed in this environment; only
  its preflight presence check was stubbed for the fake-credential test. Install
  and verify it before real admin/MFA setup.
* No account-backed ACM delegation, SES sending, Bedrock access, ECS task,
  RDS snapshot, or production smoke test can be verified without the missing
  AWS/domain inputs.
* The requested LICENSE still needs the owner’s choice. No license was guessed
  or added.
