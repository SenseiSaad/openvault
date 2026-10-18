"use client";

import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, useListParams } from "@/components/common/data-table";
import { IntegrationPending } from "@/components/common/integration-boundaries";
import { Badge } from "@/components/ui/badge";
import { featureFlags } from "@/config/feature-flags";
import { platformApi, type AuditEntry } from "@/features/platform/api";
import { formatDateTime } from "@/lib/utils";

/**
 * Operational & audit-status view. Reads the append-only, hash-chained platform audit log
 * with server-side pagination and action filtering (`?q=` is treated as an action prefix).
 */
export default function PlatformAuditPage() {
  const listParams = useListParams();
  const audit = useQuery({
    queryKey: ["platform", "audit", listParams],
    queryFn: () => platformApi.auditLog({ ...listParams }),
    enabled: featureFlags.platformAuditLog
  });

  return (
    <div>
      <PageHeader
        title="Audit & operations"
        description="Immutable platform audit trail — who changed what, when, and in which agency."
      />

      {!featureFlags.platformAuditLog ? (
        <IntegrationPending
          feature="Operational and audit-status views"
          backendRequirement="GET /api/platform/audit-log with server-side pagination and filtering."
        />
      ) : (
        <DataTable<AuditEntry>
          data={audit.data}
          isLoading={audit.isPending}
          error={audit.error instanceof Error ? audit.error : null}
          caption="Platform audit log"
          rowKey={(entry) => entry.id}
          emptyTitle="No audit entries"
          emptyDescription="State-changing actions appear here after the audit worker appends them to the chain."
          searchable
          searchPlaceholder="Filter by action prefix (e.g. assessment. or certificate.)"
          columns={[
            {
              id: "time",
              header: "When",
              render: (entry) => <span className="whitespace-nowrap text-xs">{formatDateTime(entry.occurredAt)}</span>
            },
            {
              id: "action",
              header: "Action",
              render: (entry) => <span className="font-mono text-xs">{entry.action}</span>
            },
            {
              id: "actor",
              header: "Actor",
              render: (entry) => <Badge variant="neutral">{entry.actorType}</Badge>
            },
            {
              id: "subject",
              header: "Subject",
              render: (entry) => (
                <span className="text-xs">
                  {entry.subjectType}
                  {entry.subjectPublicId ? (
                    <span className="ml-1 font-mono text-muted-foreground">
                      {entry.subjectPublicId.slice(0, 8)}…
                    </span>
                  ) : null}
                </span>
              )
            },
            {
              id: "agency",
              header: "Agency",
              render: (entry) => <span className="text-xs">{entry.agency?.name ?? "Platform"}</span>
            }
          ]}
        />
      )}

      <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
        <ScrollText aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Audit events are append-only and hash-chained; the worker appends queued events from the
        transactional outbox. Every state-changing request also carries an X-Request-Id for correlation.
      </p>
    </div>
  );
}
