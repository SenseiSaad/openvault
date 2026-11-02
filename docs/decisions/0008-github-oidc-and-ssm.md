# ADR 0008 — GitHub OIDC + SSM SecureString, no static secrets

**Status:** accepted

## Context

The repository is public today and may be sold. Static AWS keys in GitHub
secrets are a long-lived liability, and committing `.env` values is worse.

## Decision

* GitHub Actions assumes AWS roles via **OIDC**, restricted to this repo and
  specific refs/environments.
* Separate roles: build (ECR push), deploy (ECS/update/logs/backup target),
  plan (read-only), apply (PowerUser + project-scoped IAM, protected
  environment).
* Application secrets are **SSM SecureString** under `/openvault/<env>/`; the
  ECS execution role reads only that path.
* `.env.production.example` contains names and comments only; real files are
  gitignored. `scripts/check_env.sh` and `push_env_to_ssm.sh` never print values.
* gitleaks runs on the current tree in CI. Historical commits are documented
  separately because rewriting history is a user decision.

## Consequences

* No AWS access keys in GitHub.
* The first Terraform apply must be local/admin to create the OIDC roles.
* Rotating a secret is an SSM update + new task deployment, not a code change.
* A leaked historical secret still requires revocation and, if the repo was
  public, history cleanup. See the final report.
