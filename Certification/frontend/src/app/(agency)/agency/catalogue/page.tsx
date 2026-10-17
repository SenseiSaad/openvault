"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BookOpen, ShoppingCart, Award } from "lucide-react";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { IntegrationPending } from "@/components/common/integration-boundaries";
import { StatusBadge } from "@/components/common/status-badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { featureFlags } from "@/config/feature-flags";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger-container";

interface StoreProduct {
  id?: number;
  uuid?: string;
  slug?: string;
  name: string;
  description?: string;
  price_cents?: number;
  status?: string;
}

/** Agency view of the public catalogue — GET /api/store/products (verified endpoint). */
export default function AgencyCataloguePage() {
  const products = useQuery({
    queryKey: ["store", "products", 1],
    queryFn: ({ signal }) =>
      api.get<{ items?: StoreProduct[]; pages?: number; total?: number }>("/api/store/products", {
        query: { page: 1, page_size: 24 },
        signal
      }),
    staleTime: 60_000
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procure Training Catalogue"
        description="Official certified courses available for agency purchase. Purchased entitlements become assignable seats on your roster."
      />

      {products.isPending && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-64 rounded-xl border border-border/80 bg-secondary/50 animate-pulse" />
          ))}
        </div>
      )}

      {products.isError && (
        <EmptyState
          title="Catalogue unavailable"
          description={products.error instanceof ApiError ? products.error.message : "Please try again shortly."}
        />
      )}

      {products.data && (products.data.items ?? []).length === 0 && (
        <EmptyState icon={BookOpen} title="No products listed yet" />
      )}

      {products.data && (products.data.items ?? []).length > 0 && (
        <StaggerContainer className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Training products">
          {(products.data.items ?? []).map((product, index) => {
            const publicId = product.uuid ?? product.slug; // public id only — never product.id
            return (
              <StaggerItem key={product.uuid ?? product.slug ?? product.id ?? `product-${index}`}>
                <Card className="group flex h-full flex-col overflow-hidden border-border/80 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
                  <div className="relative h-28 bg-gradient-to-br from-primary/95 to-indigo-900 p-4 text-white overflow-hidden">
                    <div className="absolute right-0 top-0 -mr-6 -mt-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
                    <div className="relative flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-md">
                        <Award className="h-3 w-3" /> Certified Track
                      </span>
                      {product.status && <StatusBadge status={product.status} />}
                    </div>
                  </div>

                  <CardHeader className="p-5 pb-2">
                    <CardTitle className="font-heading text-lg font-bold tracking-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                      {product.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 text-xs leading-relaxed mt-1">
                      {product.description || "Comprehensive accredited training curriculum for agency staff."}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="mt-auto p-5 pt-2">
                    <div className="rounded-lg bg-secondary/60 p-3 border border-border/60 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">Per-Seat Entitlement</span>
                      <span className="font-heading font-bold text-base text-foreground tabular-nums">
                        {formatCurrency(product.price_cents)}
                      </span>
                    </div>
                  </CardContent>

                  <CardFooter className="border-t border-border/60 p-4">
                    {featureFlags.storeCheckout && publicId ? (
                      <Button asChild className="w-full gap-2 shadow-sm font-semibold">
                        <Link href={`/agency/checkout/${publicId}`}>
                          <ShoppingCart aria-hidden="true" className="h-4 w-4" /> Purchase Seats
                        </Link>
                      </Button>
                    ) : (
                      <Button className="w-full gap-2 font-semibold" disabled aria-describedby="checkout-disabled-note">
                        <ShoppingCart aria-hidden="true" className="h-4 w-4" /> Purchase Seats
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      )}

      {!featureFlags.storeCheckout && (
        <div className="mt-6">
          <span id="checkout-disabled-note" className="sr-only">
            Checkout is not yet available.
          </span>
          <IntegrationPending
            feature="Checkout and purchase flow"
            backendRequirement="Order creation and payment endpoints under /api (IB-3). Until verified, purchasing stays disabled and no order data is simulated."
          />
        </div>
      )}
    </div>
  );
}
