"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Armchair } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { agencyApi, agencyKeys, useAgencyScope, memberName, type SeatAssignment } from "@/features/agency/api";
import { useAgencyMembers } from "@/features/agency/api";
import { ApiError } from "@/lib/api/error";
import { formatDate } from "@/lib/utils";

export default function SeatsPage() {
  const { agencyId } = useAgencyScope();
  const queryClient = useQueryClient();
  const [releaseTarget, setReleaseTarget] = useState<SeatAssignment | null>(null);
  const [reassignTarget, setReassignTarget] = useState<SeatAssignment | null>(null);
  const [reassignMember, setReassignMember] = useState<string>("");

  const entitlements = useQuery({
    queryKey: agencyKeys.entitlements(agencyId),
    queryFn: () => agencyApi.entitlements(agencyId as string),
    enabled: Boolean(agencyId)
  });
  const seats = useQuery({
    queryKey: agencyKeys.seats(agencyId),
    queryFn: () => agencyApi.seats(agencyId as string),
    enabled: Boolean(agencyId)
  });
  const members = useAgencyMembers({ page: 1, pageSize: 100 });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["agency", agencyId] });
  };

  const release = useMutation({
    mutationFn: (seatUuid: string) => agencyApi.releaseSeat(seatUuid),
    onSuccess: () => {
      toast.success("Seat released.", { description: "The seat is now available to assign to another member." });
      setReleaseTarget(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "The seat could not be released.")
  });

  const reassign = useMutation({
    mutationFn: (input: { seatUuid: string; memberUuid: string }) => agencyApi.reassignSeat(input.seatUuid, input.memberUuid),
    onSuccess: () => {
      toast.success("Seat reassigned.");
      setReassignTarget(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "The seat could not be reassigned.")
  });

  const assignedSeats = seats.data?.items ?? [];

  return (
    <div>
      <PageHeader title="Seats & entitlements" description="Purchased training entitlements and who they are assigned to." />

      {/* Entitlements */}
      <section aria-labelledby="entitlements-heading" className="mb-8">
        <h2 id="entitlements-heading" className="mb-3 text-lg font-semibold">
          Purchased entitlements
        </h2>
        {entitlements.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : entitlements.isError ? (
          <EmptyState title="Entitlements unavailable" description="Purchased entitlements could not be loaded." />
        ) : (entitlements.data?.items ?? []).length === 0 ? (
          <EmptyState
            icon={Armchair}
            title="No entitlements yet"
            description="Purchase seats for a training product from the catalogue to see them here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(entitlements.data?.items ?? []).map((entitlement) => {
              const available = entitlement.seats_total - entitlement.seats_assigned;
              return (
                <Card key={entitlement.uuid}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{entitlement.product?.name ?? "Training product"}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Seats assigned</span>
                      <span className="font-medium tabular-nums">
                        {entitlement.seats_assigned} / {entitlement.seats_total}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Available</span>
                      <span className="font-medium tabular-nums">{available}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <StatusBadge status={entitlement.status} />
                    </div>
                    {entitlement.expires_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Renews / expires</span>
                        <span>{formatDate(entitlement.expires_at)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Assigned seats */}
      <section aria-labelledby="seats-heading">
        <h2 id="seats-heading" className="mb-3 text-lg font-semibold">
          Assigned seats
        </h2>
        {seats.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : assignedSeats.length === 0 ? (
          <EmptyState title="No seats assigned" description="Seats you assign to members appear here and can be released or reassigned." />
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <caption className="sr-only">Assigned seats</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedSeats.map((seat) => (
                  <TableRow key={seat.uuid}>
                    <TableCell className="font-medium">
                      {seat.learner ? memberName(seat.learner) : "Unassigned"}
                    </TableCell>
                    <TableCell>{seat.entitlement?.product?.name ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={seat.status} />
                    </TableCell>
                    <TableCell>{formatDate(seat.assigned_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setReassignTarget(seat)}>
                          Reassign
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setReleaseTarget(seat)}>
                          Release
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(releaseTarget)}
        onOpenChange={(open) => !open && setReleaseTarget(null)}
        title="Release this seat?"
        description={
          releaseTarget?.learner
            ? `${memberName(releaseTarget.learner)} will lose access to ${releaseTarget.entitlement?.product?.name ?? "this training"}. Their progress history is retained. The seat returns to your available pool.`
            : "The seat will return to your available pool."
        }
        confirmLabel="Release seat"
        destructive
        loading={release.isPending}
        onConfirm={() => releaseTarget && release.mutateAsync(releaseTarget.uuid)}
      />

      <Dialog open={Boolean(reassignTarget)} onOpenChange={(open) => !open && setReassignTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign seat</DialogTitle>
            <DialogDescription>
              Choose a different member for the {reassignTarget?.entitlement?.product?.name ?? "selected"} seat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reassign-member">New member</Label>
            <Select value={reassignMember} onValueChange={setReassignMember}>
              <SelectTrigger id="reassign-member">
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {(members.data?.items ?? []).map((member) => (
                  <SelectItem key={member.uuid ?? member.email} value={member.uuid ?? member.email}>
                    {memberName(member)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={!reassignMember || reassign.isPending}
              onClick={() => reassignTarget && reassign.mutateAsync({ seatUuid: reassignTarget.uuid, memberUuid: reassignMember })}
            >
              {reassign.isPending ? "Reassigning…" : "Reassign seat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
