# Runbook — SES bounce/complaint spike

**Symptom:** SES dashboard shows bounce rate > 5% or complaint rate > 0.1%;
AWS may throttle or suspend sending.

## 1. Identify the pattern

SES console → Reputation dashboard. Distinguish:
* **Hard bounces** (address doesn't exist) → bad addresses in your user list.
* **Complaints** (marked spam) → content or volume problem.

## 2. Immediate actions

* Stop re-sending to hard-bounced addresses: OpenVault sends only
  verification/reset/meeting emails — a spike means either fake sign-ups
  (check `AuditLog` for the source IP, consider the register rate limit) or a
  compromised mailbox provider.
* If complaints: pause sending (`aws ses put-account-sending-enabled
  --enabled false`) until you've reviewed recent email content.

## 3. Prevention

* Keep SPF + DKIM + DMARC records intact (Terraform `modules/ses`).
* Track bounce/complaint rates weekly; AWS suspends sending above ~10% bounce.
* All emails originate from `no-reply@` on the verified domain only.
