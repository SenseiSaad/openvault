"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { platformApi, type PlatformEntitlement } from "@/features/platform/api";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, useListParams } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/ui/form-message";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ApiError } from "@/lib/api/error";

/** Entitlement controls across agencies. INTEGRATION-UNVERIFIED (IB-5). */
export default function PlatformEntitlementsPage() {
  const listParams = useListParams();
  const queryClient = useQueryClient();
  const [adjustTarget, setAdjustTarget] = useState<PlatformEntitlement | null>(null);
  const [seatsDraft, setSeatsDraft] = useState("");
  const [seatsError, setSeatsError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PlatformEntitlement | null>(null);

  const entitlements = useQuery({
    queryKey: ["platform", "entitlements", listParams],
    queryFn: () => platformApi.entitlements({ ...listParams })
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["platform", "entitlements"] });

  const adjust = useMutation({
    mutationFn: (input: { uuid: string; seats: number }) =>
      platformApi.updateEntitlement(input.uuid, { seats_granted: input.seats }),
    onSuccess: async () => {
      toast.success("Entitlement seats updated.");
      setAdjustTarget(null);
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "The change could not be saved.")
  });

  const revoke = useMutation({
    mutationFn: (uuid: string) => platformApi.updateEntitlement(uuid, { status: "revoked" }),
    onSuccess: async () => {
      toast.success("Entitlement revoked.");
      setRevokeTarget(null);
      await invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "The entitlement could not be revoked.")
  });

  const saveSeats = () => {
    if (!adjustTarget) return;
    const seats = Number(seatsDraft);
    if (!Number.isInteger(seats) || seats < 1) {
      setSeatsError("Enter a whole number of seats (at least 1).");
      return;
    }
    setSeatsError(null);
    adjust.mutate({ uuid: adjustTarget.uuid, seats });
  };

  return (
    <div>
      <PageHeader title="Entitlements" description="Seat grants issued to agencies across the platform." />

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
            render: (e) => (
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAdjustTarget(e);
                    setSeatsDraft(String(e.seats_granted));
                    setSeatsError(null);
                  }}
                >
                  Adjust seats
                </Button>
                {e.status !== "revoked" && (
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => setRevokeTarget(e)}>
                    Revoke
                  </Button>
                )}
              </div>
            )
          }
        ]}
      />

      <Dialog open={Boolean(adjustTarget)} onOpenChange={(open) => !open && setAdjustTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust seats</DialogTitle>
            <DialogDescription>
              {adjustTarget?.agency?.name} — {adjustTarget?.product?.name}. Reducing below current usage will fail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="seats-granted">Seats granted</Label>
            <Input
              id="seats-granted"
              type="number"
              min="1"
              step="1"
              value={seatsDraft}
              onChange={(event) => setSeatsDraft(event.target.value)}
              aria-invalid={Boolean(seatsError)}
            />
            {seatsError && <FormMessage tone="error">{seatsError}</FormMessage>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustTarget(null)}>
              Cancel
            </Button>
            <Button onClick={saveSeats} disabled={adjust.isPending}>
              {adjust.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
