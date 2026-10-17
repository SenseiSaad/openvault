"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { platformApi, type PlatformAgency } from "@/features/platform/api";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ApiError } from "@/lib/api/error";
import { formatDate } from "@/lib/utils";

const PUBLIC_ID = /^[0-9a-f-]{8,}$/i;

export default function PlatformAgencyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [statusChange, setStatusChange] = useState<string | null>(null);

  const agency = useQuery({
    queryKey: ["platform", "agencies", id],
    queryFn: () => platformApi.agency(id),
    enabled: PUBLIC_ID.test(id),
    retry: false
  });

  const setStatus = useMutation({
    mutationFn: (status: string) => platformApi.setAgencyStatus(id, status),
    onSuccess: async () => {
      toast.success("Agency status updated.");
      setStatusChange(null);
      await queryClient.invalidateQueries({ queryKey: ["platform", "agencies"] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "The status change could not be saved.")
  });

  if (!PUBLIC_ID.test(id)) {
    return <EmptyState title="Agency not found" description="No agency matches that reference." />;
  }

  if (agency.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (agency.isError) {
    const notFound = agency.error instanceof ApiError && agency.error.status === 404;
    return (
      <EmptyState
        title={notFound ? "Agency not found" : "Agency unavailable"}
        description={agency.error instanceof ApiError ? agency.error.message : "Please try again later."}
        action={
          <Button variant="outline" asChild>
            <Link href="/platform/agencies">Back to agencies</Link>
          </Button>
        }
      />
    );
  }

  const data: PlatformAgency = agency.data;

  return (
    <div>
      <PageHeader
        title={data.name}
        description={`Public ID: ${data.slug ?? data.uuid}`}
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link href="/platform/agencies">
                <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back
              </Link>
            </Button>
            {data.status !== "suspended" ? (
              <Button variant="destructive" onClick={() => setStatusChange("suspended")}>
                Suspend agency
              </Button>
            ) : (
              <Button onClick={() => setStatusChange("active")}>Reactivate agency</Button>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={data.status} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{data.member_count ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Created</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{formatDate(data.created_at)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="entitlements">
        <TabsList>
          <TabsTrigger value="entitlements">Entitlements</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>
        <TabsContent value="entitlements">
          <EmptyState
            title="Entitlement list"
            description="Agency-scoped entitlements load here once the platform entitlement endpoint is verified (IB-5)."
          />
        </TabsContent>
        <TabsContent value="members">
          <EmptyState title="Member list" description="Agency member management lives in the agency portal; counts appear above." />
        </TabsContent>
        <TabsContent value="orders">
          <EmptyState title="Order history" description="Agency order history appears here once the platform order endpoint is verified (IB-5)." />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={Boolean(statusChange)}
        onOpenChange={(open) => !open && setStatusChange(null)}
        title={statusChange === "suspended" ? "Suspend this agency?" : "Reactivate this agency?"}
        description={
          statusChange === "suspended"
            ? `All members of ${data.name} will immediately lose access. Data is retained; the agency can be reactivated at any time.`
            : `${data.name} and its members will regain full access.`
        }
        confirmLabel={statusChange === "suspended" ? "Suspend" : "Reactivate"}
        destructive={statusChange === "suspended"}
        loading={setStatus.isPending}
        onConfirm={() => statusChange && setStatus.mutateAsync(statusChange)}
      />
    </div>
  );
}
