# ADR 0001 — ECS Fargate over a single EC2 host

**Status:** accepted (new stack; live site unaffected)

## Context

The live site uses a single EC2 host with Docker Compose. That is cheap to
start, but it couples deploys, TLS, Postgres, Redis, and disk to one machine.
The new stack needs independent API/worker/web releases, a managed database,
and a repeatable GitHub pipeline.

## Decision

Use **ECS Fargate** for `api`, `worker`, and `web`, one cluster per environment,
behind one ALB. Use RDS and ElastiCache for state. Do not manage EC2 instances
for the application.

## Consequences

* No host patching, AMI rotation, or SSH for normal operation.
* Per-task CPU/memory and an ALB health check make rollback straightforward.
* Fargate costs more per compute-hour than a reserved EC2 host; the launch shape
  is ~$42/mo for the three tasks (see `docs/COST.md`).
* Debugging uses ECS Exec and CloudWatch Logs, not a long-lived bastion.
* No Docker socket, no host-level cron; the nightly backup is an EventBridge →
  ECS task.
