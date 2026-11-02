# Production checklist (new AWS stack)

This is a short index. The full procedure is [`DEPLOY.md`](DEPLOY.md); the
architecture is [`ARCHITECTURE.md`](ARCHITECTURE.md). The old EC2/Compose
checklist is superseded for the `infra/` stack; the live site is unchanged.

## Before the first apply

- [ ] AWS account and region `ap-south-1` confirmed; billing alarms enabled.
- [ ] A **new** subdomain chosen (e.g. `v2.example.com`), parent DNS access.
- [ ] Bedrock Claude Haiku 4.5 model access + `in.` inference-profile ARN;
      Titan embedding model ARN; `EMBED_DIM` checked.
- [ ] SES domain identity verified and **production access** requested; SMTP
      user credentials created.
- [ ] Alert email ready to confirm the SNS subscription.
- [ ] `terraform.tfvars` filled from the example (never committed).
- [ ] State bucket name is globally unique; backend config updated if not.

## First apply and secrets

- [ ] `infra/bootstrap` applied; state bucket + lock table exist.
- [ ] Zone created/delegated, `dig NS` shows Route 53, ACM validated.
- [ ] Full prod/staging apply succeeds; ECS services may be unhealthy until an
      image exists.
- [ ] RDS endpoint + managed password assembled into `DATABASE_URL`
      (`sslmode=require`).
- [ ] `scripts/check_env.sh` passes; `scripts/push_env_to_ssm.sh` pushes
      `/openvault/<env>/*` SecureStrings.
- [ ] Bootstrap `bootstrap` image pushed; first deploy runs migrations and
      services become healthy.
- [ ] `check_bedrock` succeeds from an API task.
- [ ] SNS email subscription confirmed; budget recipients confirmed.

## Delivery and operations

- [ ] `scripts/setup_github.sh` created staging/production environments
      (production requires review), protected `main`, protected `v*` tags.
- [ ] Repository variables set (`AWS_BUILD_ROLE_ARN`, deploy/plan/apply roles,
      domains, ECR, Bedrock ARNs, OIDC subjects).
- [ ] Environment secrets `SMOKE_TEST_EMAIL`/`SMOKE_TEST_PASSWORD` set.
- [ ] CI green: backend tests/coverage, frontend tests/build, Docker + Trivy,
      gitleaks, Terraform checks.
- [ ] Staging deploy green; production deploy approved and smoke-tested.
- [ ] Rollback drill performed at least once (staging is enough).
- [ ] Nightly backup task succeeds and a new object appears in S3.
- [ ] At least one real restore drill timed; record RTO in
      `runbooks/restore.md`.
- [ ] Every alarm tested once; external uptime/TLS checks configured.
- [ ] Bedrock token/cost alarms tested with a synthetic low threshold.
- [ ] Rotate/revoke the historical `backend/.env` secret found in old commits;
      decide whether to purge history before selling/making public again.
