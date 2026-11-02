# ADR 0004 — No NAT gateway; Fargate tasks in public subnets

**Status:** accepted (cost-driven; revisit for compliance)

## Context

ECS tasks need outbound internet access for Bedrock, SES, S3, and image pulls.
Private subnets require a NAT gateway (or VPC endpoints) per AZ. At launch,
two NAT gateways plus data processing would cost more than the compute.

## Decision

* ALB and ECS tasks run in **public subnets**; tasks get public IPs for egress.
* RDS and ElastiCache run in **private isolated subnets** with no internet route.
* Security groups allow only ALB → api/web and api/worker → RDS/Redis. There is
  no inbound rule to api/web except the ALB, and none to worker/RDS/Redis.
* No NAT gateway.

## Consequences

* Saves roughly **$35–$45/mo per AZ** at launch.
* Application tasks have public IPs; this is a deliberate trade-off, not an
  oversight. If a customer/compliance requirement forbids it, switch to private
  subnets + NAT or VPC endpoints and update this ADR.
* Image pulls and Bedrock calls use the internet gateway; there is no private
  link.
