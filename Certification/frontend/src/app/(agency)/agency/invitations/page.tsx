"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MailCheck, Upload, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { IntegrationPending } from "@/components/common/integration-boundaries";
import { StatusBadge } from "@/components/common/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { FormMessage } from "@/components/ui/form-message";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { agencyApi, agencyKeys, useAgencyScope, type AgencyInvitation } from "@/features/agency/api";
import { ApiError } from "@/lib/api/error";
import { formatDateTime } from "@/lib/utils";
import { featureFlags } from "@/config/feature-flags";

const inviteSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  first_name: z.string().max(80, "Name is too long"),
  last_name: z.string().max(80, "Name is too long"),
  role: z.enum(["agency_admin", "learner"], { message: "Choose a role" })
});
type InviteForm = z.infer<typeof inviteSchema>;

function InvitationTable({
  invitations,
  isLoading,
  onRevoke,
  revoking
}: {
  invitations: AgencyInvitation[] | undefined;
  isLoading: boolean;
  onRevoke: (invitation: AgencyInvitation) => void;
  revoking: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (!invitations || invitations.length === 0) {
    return <EmptyState icon={MailCheck} title="No invitations in this state" description="Invitations you send will appear here with their current status." />;
  }
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <caption className="sr-only">Agency invitations</caption>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((invitation) => (
            <TableRow key={invitation.uuid}>
              <TableCell className="font-medium">{invitation.email}</TableCell>
              <TableCell className="capitalize">{invitation.role?.replace(/_/g, " ")}</TableCell>
              <TableCell>
                <StatusBadge status={invitation.status} />
              </TableCell>
              <TableCell>{formatDateTime(invitation.invited_at)}</TableCell>
              <TableCell>{formatDateTime(invitation.expires_at)}</TableCell>
              <TableCell className="text-right">
                {invitation.status === "pending" && (
                  <Button variant="outline" size="sm" onClick={() => onRevoke(invitation)} disabled={revoking}>
                    Revoke
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function InvitationsPage() {
  const { agencyId } = useAgencyScope();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<AgencyInvitation | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const pending = useQuery({
    queryKey: agencyKeys.invitations(agencyId, "pending"),
    queryFn: () => agencyApi.invitations(agencyId as string, "pending"),
    enabled: Boolean(agencyId)
  });
  const revoked = useQuery({
    queryKey: agencyKeys.invitations(agencyId, "revoked"),
    queryFn: () => agencyApi.invitations(agencyId as string, "revoked"),
    enabled: Boolean(agencyId)
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["agency", agencyId, "invitations"] });
    void queryClient.invalidateQueries({ queryKey: ["agency", agencyId, "overview"] });
  };

  const invite = useMutation({
    mutationFn: (payload: InviteForm) =>
      agencyApi.invite(agencyId as string, {
        email: payload.email,
        first_name: payload.first_name || undefined,
        last_name: payload.last_name || undefined,
        role: payload.role
      }),
    onSuccess: () => {
      toast.success("Invitation sent.", { description: "The member will receive an email with an acceptance link." });
      setInviteOpen(false);
      invalidate();
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "The invitation could not be sent. Please try again.");
    }
  });

  const revoke = useMutation({
    mutationFn: (invitationUuid: string) => agencyApi.revokeInvitation(agencyId as string, invitationUuid),
    onSuccess: () => {
      toast.success("Invitation revoked.");
      setRevokeTarget(null);
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "The invitation could not be revoked.");
    }
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", first_name: "", last_name: "", role: "learner" }
  });

  const role = watch("role");

  const submitInvite = async (values: InviteForm) => {
    setFormError(null);
    await invite.mutateAsync(values);
    reset();
  };

  return (
    <div>
      <PageHeader
        title="Invitations"
        description="Invite colleagues and track pending or revoked invitations."
        actions={
          <>
            <Button variant="outline" disabled>
              <Upload aria-hidden="true" className="h-4 w-4" /> Bulk CSV invite
            </Button>
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus aria-hidden="true" className="h-4 w-4" /> Invite member
            </Button>
          </>
        }
      />

      {!featureFlags.bulkInvitations && (
        <div className="mb-4">
          <IntegrationPending
            feature="Bulk CSV invitation"
            backendRequirement="POST /api/agencies/{publicId}/invitations/bulk accepting a CSV upload. Tracked in docs/INTEGRATION_BLOCKERS.md (IB-3)."
          />
        </div>
      )}

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.data?.items?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="revoked">Revoked ({revoked.data?.items?.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <InvitationTable
            invitations={pending.data?.items}
            isLoading={pending.isPending}
            onRevoke={setRevokeTarget}
            revoking={revoke.isPending}
          />
        </TabsContent>
        <TabsContent value="revoked">
          <InvitationTable invitations={revoked.data?.items} isLoading={revoked.isPending} onRevoke={setRevokeTarget} revoking={revoke.isPending} />
        </TabsContent>
      </Tabs>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { if (!open) { setInviteOpen(false); setFormError(null); reset(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a member</DialogTitle>
            <DialogDescription>
              They will receive an email invitation. Accounts are created only through invitations.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(submitInvite)} noValidate className="space-y-4">
            {formError && <FormMessage tone="error">{formError}</FormMessage>}
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Work email</Label>
              <Input id="invite-email" type="email" autoComplete="off" aria-invalid={Boolean(errors.email)} {...register("email")} />
              {errors.email && <FormMessage tone="error">{errors.email.message}</FormMessage>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-first-name">First name</Label>
                <Input id="invite-first-name" {...register("first_name")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-last-name">Last name</Label>
                <Input id="invite-last-name" {...register("last_name")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label id="invite-role-label" htmlFor="invite-role">Agency role</Label>
              <Select
                value={role}
                onValueChange={(value) => setValue("role", value as InviteForm["role"], { shouldValidate: true })}
              >
                <SelectTrigger id="invite-role" aria-labelledby="invite-role-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="learner">Learner</SelectItem>
                  <SelectItem value="agency_admin">Agency administrator</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && <FormMessage tone="error">{errors.role.message}</FormMessage>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? "Sending…" : "Send invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke this invitation?"
        description={`The invitation link sent to ${revokeTarget?.email} will stop working immediately. Send a new invitation to restore access.`}
        confirmLabel="Revoke invitation"
        destructive
        loading={revoke.isPending}
        onConfirm={() => revokeTarget && revoke.mutateAsync(revokeTarget.uuid)}
      />
    </div>
  );
}
