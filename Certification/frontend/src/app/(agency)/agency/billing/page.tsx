"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, CreditCard, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { agencyApi, agencyKeys, useAgencyScope } from "@/features/agency/api";
import { formatDate } from "@/lib/utils";

/**
 * Billing — INTEGRATION-UNVERIFIED (IB-2). If the backend exposes a hosted
 * billing portal URL it is opened in a new tab; otherwise the screen states
 * plainly that billing integration is pending. No payment data is faked.
 */
export default function BillingPage() {
  const { agencyId } = useAgencyScope();
  const billing = useQuery({
    queryKey: agencyKeys.billing(agencyId),
    queryFn: () => agencyApi.billing(agencyId as string),
    enabled: Boolean(agencyId),
    retry: false
  });

  return (
    <div>
      <PageHeader title="Billing" description="Subscription status, renewals and the hosted billing portal." />

      {billing.isPending && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      )}

      {billing.isError && (
        <EmptyState
          title="Billing information unavailable"
          description="Billing details could not be loaded for your agency. Contact your platform representative if this persists."
        />
      )}

      {billing.data && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CalendarClock aria-hidden="true" className="h-4 w-4" /> Subscription & renewals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                {billing.data.subscription_status ? (
                  <StatusBadge status={billing.data.subscription_status} />
                ) : (
                  <span>—</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Next renewal</span>
                <span>{formatDate(billing.data.renews_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Payment method</span>
                <span>{billing.data.payment_method ?? "—"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CreditCard aria-hidden="true" className="h-4 w-4" /> Billing portal
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {billing.data.billing_portal_url ? (
                <>
                  <p className="mb-3 text-muted-foreground">
                    Invoices, payment methods and billing contact details are managed in the secure billing portal.
                  </p>
                  <Button asChild>
                    <a href={billing.data.billing_portal_url} target="_blank" rel="noopener noreferrer">
                      Open billing portal <ExternalLink aria-hidden="true" className="h-4 w-4" />
                    </a>
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Your platform has not yet connected a hosted billing portal. When it is connected, invoices and
                  payment methods will be managed here.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
