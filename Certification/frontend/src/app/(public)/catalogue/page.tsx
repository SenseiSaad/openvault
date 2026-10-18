"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { agencyApi } from "@/features/agency/api";
import { ApiError } from "@/lib/api/error";
import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/common/status-badge";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { PageSuspenseFallback } from "@/components/common/page-suspense-fallback";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ShieldCheck, ChevronLeft, ChevronRight, Award } from "lucide-react";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger-container";

/**
 * Public training catalogue — GET /api/store/products (VERIFIED endpoint).
 * Response shape is modeled defensively; unknown fields are ignored.
 */
interface StoreProduct {
  id?: number;
  uuid?: string;
  slug?: string;
  name: string;
  description?: string;
  price_cents?: number;
  status?: string;
}

function CatalogueContent() {
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const products = useQuery({
    queryKey: ["store", "products", page],
    queryFn: () => agencyApi.storeProducts(),
    staleTime: 60_000
  });

  return (
    <div className="container max-w-7xl py-10 px-4 sm:px-6">
      <PageHeader
        title="Accredited Training Catalogue"
        description="Certified civil service and government training products available for agency procurement. Speak with your department administrator to request seat assignment."
      />

      {products.isPending && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Spinner label="Loading training products" />
          <p className="text-xs text-muted-foreground">Connecting to product store...</p>
        </div>
      )}

      {products.isError && (
        <EmptyState
          title="The catalogue could not be loaded"
          description={
            products.error instanceof ApiError && products.error.status < 500
              ? products.error.message
              : "The training catalogue is temporarily unavailable. Please try again shortly."
          }
        />
      )}

      {products.data && (products.data.items ?? []).length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No training products are currently listed"
          description="New certifications are added regularly. Please check back soon."
        />
      )}

      {products.data && (products.data.items ?? []).length > 0 && (
        <>
          <StaggerContainer className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(products.data.items ?? []).map((product, index) => (
              <StaggerItem key={product.slug ?? product.uuid ?? `product-${index}`}>
                <Card className="group flex h-full flex-col overflow-hidden border-border/80 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
                  {/* Decorative Header */}
                  <div className="relative h-28 bg-gradient-to-br from-primary/95 to-indigo-900 p-4 text-white overflow-hidden">
                    <div className="absolute right-0 top-0 -mr-6 -mt-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
                    <div className="relative flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-md">
                        <Award className="h-3 w-3" /> Certified Curriculum
                      </span>
                      {product.status && <StatusBadge status={product.status} />}
                    </div>
                  </div>

                  <CardHeader className="p-5 pb-2">
                    <CardTitle className="font-heading text-lg font-bold tracking-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                      {product.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-3 text-xs leading-relaxed mt-1">
                      {product.description || "Comprehensive accredited training curriculum for civil service professionals."}
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

                  <CardFooter className="border-t border-border/60 p-4 text-[11px] text-muted-foreground">
                    Purchased exclusively by agency administrators via seat allocation order.
                  </CardFooter>
                </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>

          {(products.data.pages ?? 1) > 1 && (
            <nav aria-label="Catalogue pages" className="mt-10 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                asChild={page > 1}
                className="gap-1 text-xs"
              >
                {page > 1 ? (
                  <a href={`/catalogue?page=${page - 1}`}>
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </a>
                ) : (
                  <span>
                    <ChevronLeft className="h-3.5 w-3.5" /> Previous
                  </span>
                )}
              </Button>

              {Array.from({ length: products.data.pages ?? 1 }).map((_, index) => (
                <Button
                  key={index}
                  asChild
                  variant={index + 1 === page ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0 text-xs font-semibold"
                >
                  <a href={`/catalogue?page=${index + 1}`} aria-current={index + 1 === page ? "page" : undefined}>
                    {index + 1}
                  </a>
                </Button>
              ))}

              <Button
                variant="outline"
                size="sm"
                disabled={page >= (products.data.pages ?? 1)}
                asChild={page < (products.data.pages ?? 1)}
                className="gap-1 text-xs"
              >
                {page < (products.data.pages ?? 1) ? (
                  <a href={`/catalogue?page=${page + 1}`}>
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span>
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

export default function CataloguePage() {
  return (
    <Suspense fallback={<PageSuspenseFallback />}>
      <CatalogueContent />
    </Suspense>
  );
}
