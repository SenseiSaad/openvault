"use client";

import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { IntegrationPending } from "@/components/common/integration-boundaries";
import { featureFlags } from "@/config/feature-flags";

/**
 * Operational & audit-status views. Behind featureFlags.platformAuditLog
 * (IB-5): no audit-log endpoints exist in the backend yet, so the default
 * view states this plainly instead of fabricating entries.
 */
export default function PlatformAuditPage() {
  return (
    <div>
      <PageHeader
        title="Audit & operations"
        description="Operational status and the platform audit trail (who changed what, when, and from where)."
      />
      {featureFlags.platformAuditLog ? (
        // Enabled path: rendered once GET /api/platform/audit-log is verified.
        <p className="text-sm text-muted-foreground">Audit entries appear here once connected.</p>
      ) : (
        <IntegrationPending
          feature="Operational and audit-status views"
          backendRequirement="GET /api/platform/audit-log with server-side pagination and filtering (IB-5). This view activates automatically when the endpoint ships; no synthetic audit entries are shown."
        />
      )}
      <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
        <ScrollText aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Every state-changing request already sends an <code className="mx-1 font-mono">X-Request-Id</code> header from
        this frontend, so audit correlation only requires the backend to persist it.
      </p>
    </div>
  );
}
