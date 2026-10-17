"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, useListParams } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { useAgencyScope } from "@/features/agency/api";
import { api } from "@/lib/api/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Paginated } from "@/lib/api/types";
import type { AgencyOrder } from "@/features/agency/api";

/** Order history — INTEGRATION-UNVERIFIED (IB-2): verify /api/agencies/{id}/orders. */
export default function OrdersPage() {
  const router = useRouter();
  const listParams = useListParams();
  const { agencyId } = useAgencyScope();

  const orders = useQuery({
    queryKey: ["agency", agencyId, "orders", listParams],
    queryFn: ({ signal }) =>
      api.get<Paginated<AgencyOrder>>(`/api/agencies/${agencyId}/orders`, {
        query: { page: listParams.page, page_size: listParams.pageSize, q: listParams.q },
        signal
      }),
    enabled: Boolean(agencyId)
  });

  return (
    <div>
      <PageHeader title="Order history" description="Purchases made by your agency, newest first." />
      <DataTable<AgencyOrder>
        data={orders.data}
        isLoading={orders.isPending}
        error={orders.error instanceof Error ? orders.error : null}
        caption="Agency orders"
        rowKey={(order) => order.uuid}
        emptyTitle="No orders yet"
        emptyDescription="When your agency purchases training seats, orders appear here with their status."
        searchable
        searchPlaceholder="Search orders"
        onRowClick={(order) => router.push(`/agency/orders/${order.uuid}`)}
        columns={[
          {
            id: "number",
            header: "Order",
            render: (order) => <span className="font-medium">{order.number ?? order.uuid.slice(0, 8)}</span>
          },
          { id: "date", header: "Date", render: (order) => formatDate(order.created_at) },
          { id: "status", header: "Status", render: (order) => <StatusBadge status={order.status} /> },
          {
            id: "total",
            header: "Total",
            className: "text-right",
            render: (order) => <span className="tabular-nums">{formatCurrency(order.total_cents)}</span>
          }
        ]}
      />
    </div>
  );
}
