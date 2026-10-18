"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { platformApi, type PlatformEntitlement } from "@/features/platform/api";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, useListParams } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ApiError } from "@/lib/api/error";

/**
 * Entitlement controls across agencies. Seat counts are immutable by schema design
 * (existing grants cannot be resized); additional seats are bought as a new order.
 * Revocation is the supported platform action here.
 */
export default function PlatformEntitlementsPage() {
  const listParams = useListParams();
  const queryClient = useQueryClient();
  const [revokeTarget, setRevokeTarget] = useState<PlatformEntitlement | null>(null);

  const entitlements = useQuery({
    queryKey: ["platform", "entitlements", listParams],
    queryFn: () => platformApi.entitlements({ ...listParams })
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["platform", "entitlements"] });

  const revoke = useMutation({
    mutationFn: (uuid: string) => platformApi.updateEntitlement(uuid, { status: "revoked" }),
    onSuccess: async () => {
      toast.success("Entitlement revoked.");
      setRevokeTarget(null);
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "The entitlement could not be revoked.")
  });

  return (
    <div>
      <PageHeader
        title="Entitlements"
        description="Seat grants issued to agencies. Seat counts are fixed at purchase; additional seats are bought as a new order."
      />

      <DataTable<PlatformEntitlement>
        data={entitlements.data}
        isLoading={entitlements.isPending}
        error={entitlements.error instanceof Error ? entitlements.error : null}
        caption="Platform entitlements"
        rowKey={(entitlement) => entitlement.uuid}
        emptyTitle="No entitlements yet"
        searchable
        searchPlaceholder="Search by agency or product"
        columns={[
          { id: "agency", header: "Agency", render: (e) => <span className="font-medium">{e.agency?.name ?? "—"}</span> },
          { id: "product", header: "Product", render: (e) => e.product?.name ?? "—" },
          {
            id: "seats",
            header: "Seats used / granted",
            className: "text-right",
            render: (e) => (
              <span className="tabular-nums">
                {e.seats_used ?? "—"} / {e.seats_granted}
              </span>
            )
          },
          { id: "status", header: "Status", render: (e) => <StatusBadge status={e.status} /> },
          {
            id: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "text-right",
            render: (e) =>
              e.status !== "revoked" ? (
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => setRevokeTarget(e)}>
                  Revoke
                </Button>
              ) : null
          }
        ]}
      />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke this entitlement?"
        description={`Members of ${revokeTarget?.agency?.name ?? "this agency"} will lose access to ${revokeTarget?.product?.name ?? "this product"}. This is reversible by issuing a new entitlement.`}
        confirmLabel="Revoke entitlement"
        destructive
        loading={revoke.isPending}
        onConfirm={() => revokeTarget && revoke.mutateAsync(revokeTarget.uuid)}
      />
    </div>
  );
}
