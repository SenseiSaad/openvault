# ADR 0010 — Single-node Redis at launch

**Status:** accepted (revisit with paying tenants)

## Context

ElastiCache Multi-AZ roughly doubles the Redis cost. Redis holds cache,
rate-limit counters, and Celery queues — important but recoverable.

## Decision

One `cache.t4g.micro` replication group with at-rest encryption and snapshots.
Do not claim Redis durability; treat queued work as retryable.

## Consequences

* A node/AZ failure drops rate-limit windows and in-flight Celery tasks.
* API requests may still succeed without cache/rate limits; background work
  must be idempotent.
* Upgrade to Multi-AZ when a Redis outage would cost more than the extra
  ~$12/mo.
