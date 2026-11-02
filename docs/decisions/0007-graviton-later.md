# ADR 0007 — x86_64 first, Graviton later

**Status:** accepted (revisit after launch)

## Context

Fargate Graviton (ARM64) is cheaper, but the images must be built multi-arch
and all native dependencies must support arm64. The current Docker builds target
`linux/amd64` explicitly.

## Decision

Launch on **x86_64** to match the tested image path. Revisit Graviton after the
first stable month, when there is a real cost baseline and time to test native
wheels (psycopg, OCR, etc.) on arm64.

## Consequences

* Slightly higher Fargate cost at launch.
* No silent architecture mismatch between CI and ECS.
* Moving to Graviton requires a multi-arch build, ECS runtime platform change,
  and a load test. Do not flip it as a cost shortcut.
