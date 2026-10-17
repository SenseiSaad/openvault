"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { AgencyOrder } from "@/features/agency/api";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Order detail. Route parameter is a PUBLIC uuid — internal ids are never used in URLs. */
export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isPublicId = UUID_PATTERN.test(id) || /^[a-z0-9-]{3,64}$/i.test(id);

  const order = useQuery({
    queryKey: ["agency", "orders", id],
    queryFn: ({ signal }) => api.get<AgencyOrder>(`/api/orders/${id}`, { signal }),
    enabled: isPublicId,
    retry: false
  });

  if (!isPublicId) {
    return (
      <EmptyState
        title="Order not found"
        description="We could not find an order with that reference."
        action={
          <Button variant="outline" asChild>
            <Link href="/agency/orders">Back to orders</Link>
          </Button>
        }
      />
    );
  }

  if (order.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (order.isError) {
    const notFound = order.error instanceof ApiError && order.error.status === 404;
    return (
      <EmptyState
        title={notFound ? "Order not found" : "Order unavailable"}
        description={
          notFound
            ? "This order does not exist or your agency does not have access to it."
            : order.error instanceof ApiError
              ? order.error.message
              : "Please try again later."
        }
        action={
          <Button variant="outline" asChild>
            <Link href="/agency/orders">Back to orders</Link>
          </Button>
        }
      />
    );
  }

  const data = order.data;

  return (
    <div>
      <PageHeader
        title={`Order ${data.number ?? data.uuid.slice(0, 8)}`}
        description={`Placed ${formatDateTime(data.created_at)}`}
        actions={
          <Button variant="ghost" asChild>
            <Link href="/agency/orders">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <caption className="sr-only">Order line items</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Seats</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.items ?? []).map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.product?.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(item.unit_price_cents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={data.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Order reference</span>
              <span className="font-mono text-xs">{data.uuid}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="font-medium">Total</span>
              <span className="text-lg font-semibold tabular-nums">{formatCurrency(data.total_cents)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
