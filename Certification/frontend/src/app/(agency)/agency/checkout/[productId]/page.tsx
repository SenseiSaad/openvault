"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, ShoppingCart, ShieldCheck, CheckCircle2 } from "lucide-react";
import { agencyApi, agencyKeys, useAgencyScope } from "@/features/agency/api";
import { featureFlags } from "@/config/feature-flags";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { IntegrationPending } from "@/components/common/integration-boundaries";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FormMessage } from "@/components/ui/form-message";
import { ApiError } from "@/lib/api/error";
import { formatCurrency } from "@/lib/utils";

/** Public product id: uuid or slug — never an internal numeric id. */
const PUBLIC_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[a-z0-9-]{3,64}$/i;

const checkoutSchema = z.object({
  quantity: z.coerce
    .number({ invalid_type_error: "Enter a number of seats" })
    .int("Enter a whole number of seats")
    .min(1, "At least 1 seat is required")
    .max(1000, "For orders above 1000 seats, contact sales"),
  paymentMethod: z.enum(["card", "invoice"], { message: "Choose a payment method" })
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

export default function CheckoutPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { agencyId } = useAgencyScope();
  const isPublicId = PUBLIC_ID.test(productId);

  const product = useQuery({
    queryKey: ["store", "product", productId],
    queryFn: ({ signal }) => agencyApi.storeProduct(productId, signal),
    enabled: isPublicId && featureFlags.storeCheckout,
    retry: false
  });

  const placeOrder = useMutation({
    mutationFn: (payload: { priceId: string; quantity: number; paymentMethod: "card" | "invoice" }) =>
      agencyApi.createOrder({
        agencyId: agencyId as string,
        priceId: payload.priceId,
        quantity: payload.quantity,
        paymentMethod: payload.paymentMethod
      }),
    onSuccess: async (result) => {
      toast.success("Order placed. Seats become assignable once fulfilment completes.");
      await queryClient.invalidateQueries({ queryKey: agencyKeys.orders(null, { page: 1 }) });
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      router.replace(result.order?.uuid ? `/agency/orders/${result.order.uuid}` : "/agency/orders");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "The order could not be placed.")
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { quantity: 1, paymentMethod: "card" }
  });

  if (!featureFlags.storeCheckout) {
    return (
      <div className="space-y-4">
        <PageHeader title="Purchase seats" description="Checkout for catalogue products." />
        <IntegrationPending
          feature="Checkout and purchase flow"
          backendRequirement="Order creation endpoints under /api (IB-3). This page is only linked from the catalogue while the storeCheckout flag is enabled; no order data is simulated."
        />
        <div>
          <Button variant="outline" asChild>
            <Link href="/agency/catalogue">Back to catalogue</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!isPublicId) {
    return (
      <EmptyState
        title="Product not found"
        description="We could not find a product with that reference."
        action={
          <Button variant="outline" asChild>
            <Link href="/agency/catalogue">Back to catalogue</Link>
          </Button>
        }
      />
    );
  }

  if (product.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (product.isError) {
    const notFound = product.error instanceof ApiError && product.error.status === 404;
    return (
      <EmptyState
        title={notFound ? "Product not found" : "Product unavailable"}
        description={product.error instanceof ApiError ? product.error.message : "Please try again later."}
        action={
          <Button variant="outline" asChild>
            <Link href="/agency/catalogue">Back to catalogue</Link>
          </Button>
        }
      />
    );
  }

  const data = product.data;
  const price =
    data.prices?.find((p) => p.billingPeriod === "annual" && p.isActive) ??
    data.prices?.find((p) => p.isActive) ??
    data.prices?.[0];
  const unitPrice = price?.unitAmountMinor ?? data.price_cents ?? 0;
  const quantity = Number(watch("quantity")) || 0;
  const totalCents = unitPrice * quantity;
  const paymentMethod = watch("paymentMethod");

  const onSubmit = (values: CheckoutForm) => {
    if (!price) {
      toast.error("This product has no active price yet. Contact the platform administrator.");
      return;
    }
    placeOrder.mutate({
      priceId: price.id,
      quantity: values.quantity,
      paymentMethod: values.paymentMethod
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procure Training Seats"
        description={`Order certified seats for ${data.name}. Entitlements are credited immediately to your agency roster pool upon fulfillment.`}
        actions={
          <Button variant="ghost" size="sm" asChild className="gap-1.5 text-xs">
            <Link href="/agency/catalogue">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to catalogue
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3 max-w-5xl">
        {/* Order Details Form */}
        <Card className="lg:col-span-2 border-border/80 shadow-card">
          <CardHeader>
            <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-1">
              <ShieldCheck className="h-4 w-4" /> Official Procurement Order
            </div>
            <CardTitle className="font-heading text-xl font-bold">{data.name}</CardTitle>
            <CardDescription className="text-xs leading-relaxed mt-1">
              {data.description || "Certified government training curriculum aligned with national standards."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-xs font-semibold">Number of Staff Seats</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    max={1000}
                    step={1}
                    inputMode="numeric"
                    className="max-w-36 text-base font-bold tabular-nums"
                    aria-invalid={Boolean(errors.quantity)}
                    aria-describedby={errors.quantity ? "quantity-error" : "quantity-hint"}
                    {...register("quantity")}
                  />
                  <span className="text-xs text-muted-foreground">seats requested</span>
                </div>
                {errors.quantity ? (
                  <span id="quantity-error">
                    <FormMessage tone="error">{errors.quantity.message}</FormMessage>
                  </span>
                ) : (
                  <p id="quantity-hint" className="text-xs text-muted-foreground">
                    One seat entitlement per agency staff member. Seats can be reassigned flexibly as personnel rotate.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-method" className="text-xs font-semibold">Payment method</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) => setValue("paymentMethod", value as "card" | "invoice")}
                >
                  <SelectTrigger id="payment-method" className="max-w-72">
                    <SelectValue placeholder="Choose a payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Government purchase card (Stripe Checkout)</SelectItem>
                    <SelectItem value="invoice">Invoice / purchase order</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Card orders open Stripe Checkout. Invoice orders are emailed to your billing contact
                  and access is granted when the invoice is paid.
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-secondary/30 p-4 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Procurement Guarantee
                </div>
                <p>
                  Invoicing and billing follow your agency purchase contract or pre-authorized government purchase card agreement.
                </p>
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting || placeOrder.isPending}
                className="gap-2 w-full sm:w-auto font-semibold shadow-md"
              >
                <ShoppingCart aria-hidden="true" className="h-4 w-4" />
                {placeOrder.isPending ? "Placing Order…" : `Confirm Order — ${formatCurrency(totalCents)}`}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Live Calculation Summary */}
        <Card className="border-border/80 shadow-card h-fit">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Order Calculation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Selected Item</span>
              <span className="font-medium text-foreground truncate max-w-36">{data.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Unit Rate</span>
              <span className="font-semibold tabular-nums text-foreground">{formatCurrency(unitPrice)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Seat Count</span>
              <span className="font-bold tabular-nums text-foreground">{quantity || "—"}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border/80 pt-3">
              <span className="font-semibold text-foreground text-sm">Total Amount</span>
              <span className="font-heading text-xl font-bold tabular-nums text-primary">
                {formatCurrency(totalCents)}
              </span>
            </div>
          </CardContent>
          <CardFooter className="border-t border-border/60 text-[11px] text-muted-foreground bg-secondary/20 p-4 rounded-b-xl">
            Applicable tax exemptions applied automatically for verified government agencies.
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
