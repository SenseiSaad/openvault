"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, useListParams } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAgencyMembers, useUpdateMember, useAgencyScope, type AgencyMember } from "@/features/agency/api";
import { useSession } from "@/features/auth/session-context";
import { ApiError } from "@/lib/api/error";
import { formatDate } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";

const ROLES = ["agency_admin", "learner"];
const STATUSES = ["active", "suspended", "inactive"];

export default function MembersPage() {
  const listParams = useListParams();
  const { user } = useSession();
  const isPlatformAdmin = Boolean(
    user?.roles.includes("super_admin") || user?.roles.includes("training_manager")
  );
  const members = useAgencyMembers(listParams);
  const updateMember = useUpdateMember();
  const [roleDialog, setRoleDialog] = useState<AgencyMember | null>(null);
  const [nextRole, setNextRole] = useState<string>("learner");
  const [statusConfirm, setStatusConfirm] = useState<{ member: AgencyMember; status: string } | null>(null);

  const applyRole = async () => {
    if (!roleDialog) return;
    try {
      await updateMember.mutateAsync({ memberUuid: roleDialog.uuid as string, role: nextRole });
      toast.success("Member role updated.");
      setRoleDialog(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The role change could not be saved.");
    }
  };

  const applyStatus = async () => {
    if (!statusConfirm) return;
    try {
      await updateMember.mutateAsync({ memberUuid: statusConfirm.member.uuid as string, status: statusConfirm.status });
      toast.success("Member status updated.");
      setStatusConfirm(null);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The status change could not be saved.");
    }
  };

  return (
    <div>
      <PageHeader title="Member directory" description="Everyone with access to your agency workspace." />

      <DataTable<AgencyMember>
        data={members.data}
        isLoading={members.isPending}
        error={members.error instanceof Error ? members.error : null}
        caption="Agency members"
        rowKey={(member) => member.uuid ?? member.email}
        emptyTitle="No members yet"
        emptyDescription="Invite your first team member from the Invitations page."
        searchable
        searchPlaceholder="Search members by name or email"
        columns={[
          {
            id: "name",
            header: "Name",
            render: (member) => (
              <span className="font-medium">
                {[member.first_name, member.last_name].filter(Boolean).join(" ") || "—"}
              </span>
            )
          },
          { id: "email", header: "Email", render: (member) => member.email },
          {
            id: "role",
            header: "Agency role",
            render: (member) => <span className="capitalize">{member.role?.replace(/_/g, " ") ?? "—"}</span>
          },
          { id: "status", header: "Status", render: (member) => <StatusBadge status={member.status} /> },
          { id: "joined", header: "Joined", render: (member) => formatDate(member.joined_at) },
          {
            id: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "w-12 text-right",
            render: (member) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Actions for member ${member.email}`}>
                    <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Manage</DropdownMenuLabel>
                  {isPlatformAdmin && (
                    <DropdownMenuItem
                      onSelect={() => {
                        setRoleDialog(member);
                        setNextRole(member.role);
                      }}
                    >
                      Change role
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {member.status !== "suspended" && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => setStatusConfirm({ member, status: "suspended" })}
                    >
                      Suspend member
                    </DropdownMenuItem>
                  )}
                  {member.status === "suspended" && (
                    <DropdownMenuItem onSelect={() => setStatusConfirm({ member, status: "active" })}>
                      Reactivate member
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }
        ]}
      />

      <Dialog open={Boolean(roleDialog)} onOpenChange={(open) => !open && setRoleDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change agency role</DialogTitle>
            <DialogDescription>Applies immediately. The member may need to refresh to see new access.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="member-role">Role</Label>
            <Select value={nextRole} onValueChange={setNextRole}>
              <SelectTrigger id="member-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog(null)}>
              Cancel
            </Button>
            <Button onClick={applyRole} disabled={updateMember.isPending}>
              {updateMember.isPending ? "Saving…" : "Save role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(statusConfirm)}
        onOpenChange={(open) => !open && setStatusConfirm(null)}
        title={statusConfirm?.status === "suspended" ? "Suspend this member?" : "Reactivate this member?"}
        description={
          statusConfirm?.status === "suspended"
            ? `${statusConfirm.member.email} will immediately lose access to the agency workspace. Their seat assignments remain reserved until released.`
            : `${statusConfirm?.member.email} will regain access to the agency workspace.`
        }
        confirmLabel={statusConfirm?.status === "suspended" ? "Suspend" : "Reactivate"}
        destructive={statusConfirm?.status === "suspended"}
        loading={updateMember.isPending}
        onConfirm={applyStatus}
      />
    </div>
  );
}
