"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { platformApi, type PlatformProduct } from "@/features/platform/api";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, useListParams } from "@/components/common/data-table";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/ui/form-message";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/error";
import { formatCurrency } from "@/lib/utils";

/** Products & pricing. INTEGRATION-UNVERIFIED (IB-5). Price is entered in dollars, stored in cents. */
export default function PlatformProductsPage() {
  const listParams = useListParams();
  const queryClient = useQueryClient();
  const [priceTarget, setPriceTarget] = useState<PlatformProduct | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);

  const products = useQuery({
    queryKey: ["platform", "products", listParams],
    queryFn: () => platformApi.products({ ...listParams })
  });

  const update = useMutation({
    mutationFn: (payload: { productUuid: string; price_cents: number }) =>
      platformApi.updateProduct(payload.productUuid, { price_cents: payload.price_cents }),
    onSuccess: async () => {
      toast.success("Price updated.");
      setPriceTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["platform", "products"] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "The price could not be saved.")
  });

  const savePrice = () => {
    if (!priceTarget) return;
    const dollars = Number(priceDraft);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setPriceError("Enter a valid price greater than zero.");
      return;
    }
    setPriceError(null);
    update.mutate({ productUuid: priceTarget.uuid, price_cents: Math.round(dollars * 100) });
  };

  return (
    <div>
      <PageHeader title="Products & pricing" description="Catalog products offered to agencies, with per-seat pricing." />

      <DataTable<PlatformProduct>
        data={products.data}
        isLoading={products.isPending}
        error={products.error instanceof Error ? products.error : null}
        caption="Platform products"
        rowKey={(product) => product.uuid}
        emptyTitle="No products yet"
        searchable
        searchPlaceholder="Search products"
        columns={[
          { id: "name", header: "Product", render: (product) => <span className="font-medium">{product.name}</span> },
          { id: "status", header: "Status", render: (product) => <StatusBadge status={product.status} /> },
          {
            id: "price",
            header: "Per-seat price",
            className: "text-right",
            render: (product) => <span className="tabular-nums">{formatCurrency(product.price_cents)}</span>
          },
          {
            id: "actions",
            header: <span className="sr-only">Actions</span>,
            className: "text-right",
            render: (product) => (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPriceTarget(product);
                  setPriceDraft(((product.price_cents ?? 0) / 100).toFixed(2));
                  setPriceError(null);
                }}
              >
                Edit price
              </Button>
            )
          }
        ]}
      />

      <Dialog open={Boolean(priceTarget)} onOpenChange={(open) => !open && setPriceTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit price — {priceTarget?.name}</DialogTitle>
            <DialogDescription>Per-seat price in US dollars. Existing agency entitlements are unaffected.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="product-price">Price (USD)</Label>
            <Input
              id="product-price"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={priceDraft}
              onChange={(event) => setPriceDraft(event.target.value)}
              aria-invalid={Boolean(priceError)}
            />
            {priceError && <FormMessage tone="error">{priceError}</FormMessage>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceTarget(null)}>
              Cancel
            </Button>
            <Button onClick={savePrice} disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save price"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
