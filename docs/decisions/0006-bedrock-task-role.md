# ADR 0006 — Bedrock uses the ECS task role, not a stored API key

**Status:** accepted

## Context

The live Render deployment uses a platform Bedrock bearer token in environment
variables. A static key can leak in logs, dashboards, or a compromised build.

## Decision

* The ECS **task role** is the only Bedrock credential for the platform
  provider.
* IAM allows only `bedrock:InvokeModel` and
  `bedrock:InvokeModelWithResponseStream` on the exact configured model /
  inference-profile ARNs.
* `BEDROCK_API_KEY` is not set on ECS. BYO keys remain encrypted per tenant and
  are a separate feature.
* `python manage.py check_bedrock` is the fail-fast check.

## Consequences

* No long-lived AWS key to rotate in the app.
* Model access and the `in.` inference-profile ARN are account/region-specific
  and must be verified (`UNVERIFIED` until the account is connected).
* The task role cannot call arbitrary Bedrock models; adding a model is an
  explicit Terraform change.
