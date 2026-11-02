# Security notes

## Reporting

This is a solo-operated repository. If you find a vulnerability, do not open a
public issue with a working exploit or secret. Contact the repository owner
privately and include a minimal reproduction.

## Secret policy

* No real values in git. `.env`, `.env.*`, `*.tfvars`, Terraform state, dumps,
  and `backups/` are gitignored.
* Application secrets are SSM **SecureString** parameters under
  `/openvault/<env>/`; the ECS execution role can read only that prefix.
* `.env.production.example` and `infra/secrets-manifest.yaml` are **names only**.
  `scripts/check_env.sh` / `push_env_to_ssm.sh` never print values.
* gitleaks runs in CI on the **current tree** and locally via pre-commit. It is
  not a substitute for rotating a leaked credential.

## Historical finding (action required before selling/making public again)

A real `backend/.env` existed in old commits and gitleaks reports a
`GEMINI_API_KEY` in the history. The current tree does not contain that file,
and CI scans with `--no-git` because the finding predates the new stack.

**Before making the repository public again or transferring it:**

1. Revoke/rotate the Gemini key and any other credential that was ever in
   `backend/.env` (inspect the old values privately; do not paste them into an
   issue).
2. Rotate `SECRET_KEY` and `LLM_KEY_ENCRYPTION_KEY` if they were ever reused in
   production (rotating the encryption key invalidates stored BYO provider
   keys, so plan that).
3. Decide whether to purge history (`git filter-repo` / BFG) and force-push.
   That is a destructive operation; do it deliberately and tell collaborators.
4. Re-run a full-history gitleaks scan after the rewrite and only then re-enable
   public access.

The new stack's `.env` values are not in the repository, but history is shared.

## Controls in the new stack

* HttpOnly/Secure cookies; same-origin web+API; CSRF/CORS explicit.
* S3 public access blocked, TLS-only policy, SSE-KMS, versioning.
* RDS forced SSL and encryption at rest; master password in Secrets Manager.
* ECS task role for Bedrock; exact model ARNs; no platform API key.
* Least-privilege GitHub OIDC roles; protected production environment; no
  static AWS keys.
* SSRF protections and tests in the backend; upload size/type limits; audit
  log for downloads/shares.
* CloudWatch alarms for 5xx, unhealthy targets, ECS no-datapoints, RDS
  CPU/storage/connections, Bedrock errors, and token spend.

## Gaps / non-goals

* No WAF/Shield Advanced, no multi-region DR, single-AZ RDS/Redis.
* No Container Insights; ECS alarm is coarse.
* No automated secret rotation yet; rotate on a calendar and after any
  suspected exposure.
* The historical history finding above is **not** fixed by the new stack.
