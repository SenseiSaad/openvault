"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { platformApi, type PlatformAgency } from "@/features/platform/api";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, useListParams } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDate } from "@/lib/utils";

/** Agency directory. Rows link by PUBLIC uuid only (IB-1 applies platform-wide). */
export default function PlatformAgenciesPage() {
  const router = useRouter();
  const listParams = useListParams();

  const agencies = useQuery({
    queryKey: ["platform", "agencies", listParams],
    queryFn: () => platformApi.agencies({ ...listParams })
  });

  return (
    <div>
      <PageHeader title="Agencies" description="All agencies on the platform, with status and seat usage." />
      <DataTable<PlatformAgency>
        data={agencies.data}
        isLoading={agencies.isPending}
        error={agencies.error instanceof Error ? agencies.error : null}
        caption="Platform agencies"
        rowKey={(agency) => agency.uuid}
        emptyTitle="No agencies yet"
        searchable
        searchPlaceholder="Search agencies by name or slug"
        onRowClick={(agency) => router.push(`/platform/agencies/${agency.uuid}`)}
        columns={[
          { id: "name", header: "Agency", render: (agency) => <span className="font-medium">{agency.name}</span> },
          { id: "slug", header: "Public ID", render: (agency) => <span className="font-mono text-xs">{agency.slug ?? agency.uuid}</span> },
          { id: "status", header: "Status", render: (agency) => <StatusBadge status={agency.status} /> },
          { id: "members", header: "Members", className: "text-right", render: (agency) => <span className="tabular-nums">{agency.member_count ?? "—"}</span> },
          { id: "seats", header: "Seats used", className: "text-right", render: (agency) => <span className="tabular-nums">{agency.seats_used ?? "—"}</span> },
          { id: "created", header: "Created", render: (agency) => formatDate(agency.created_at) }
        ]}
      />
    </div>
  );
}
