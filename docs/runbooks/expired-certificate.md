# Runbook — Expired TLS certificate

**Symptom:** browsers reject the site; `curl` shows certificate verify failed.

With ACM + DNS validation this should never happen (ACM auto-renews). If it does:

1. **Check the certificate status** (ACM console or
   `aws acm describe-certificate --certificate-arn <arn>`). If status is
   `EXPIRED` or `VALIDATION_TIMED_OUT`:
2. **Root cause is almost always DNS**: the CNAME validation record was removed
   from the hosted zone, or the zone was deleted/moved.
3. Re-request the certificate (Terraform: `terraform apply` re-creates
   `aws_acm_certificate` + validation records in `modules/dns_tls`), confirm the
   CNAME record exists in Route 53, wait for `ISSUED`.
4. ALB listener re-attaches the new cert automatically via Terraform.

**Prevention:** the Terraform-managed validation records are part of state —
never delete them by hand. Route 53 alarms are not built-in; rely on the
external uptime monitor (alerts.md rule 1) which will fire within a minute of
cert failure.
