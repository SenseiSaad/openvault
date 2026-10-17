"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api";
import { ApiError } from "@/lib/api/error";
import { dashboardForRole } from "@/features/auth/dashboard-for-role";
import { type CurrentUser } from "@/features/auth/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageSuspenseFallback } from "@/components/common/page-suspense-fallback";
import { MailCheck, ShieldAlert, UserCheck, UserPlus, ArrowRight } from "lucide-react";

const schema = z
  .object({
    first_name: z.string().min(1, "First name is required").max(80),
    last_name: z.string().min(1, "Last name is required").max(80),
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[a-z]/, "Include at least one lowercase letter")
      .regex(/[0-9]/, "Include at least one number")
  });
type FormValues = z.infer<typeof schema>;

type Outcome =
  | { kind: "created"; user: CurrentUser | null; message: string }
  | { kind: "existing"; message: string; email?: string }
  | { kind: "error"; message: string };

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<PageSuspenseFallback />}>
      <AcceptInvitationForm />
    </Suspense>
  );
}

function AcceptInvitationForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = searchParams.get("token") ?? "";
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { first_name: "", last_name: "", password: "" } });

  if (!token) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] flex-1 items-center justify-center px-4 py-16">
        <Card className="max-w-md border-border/80 shadow-card text-center">
          <CardHeader className="space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-1">
              <MailCheck aria-hidden="true" className="h-6 w-6" />
            </div>
            <CardTitle className="font-heading text-xl font-bold">No invitation found</CardTitle>
            <CardDescription className="text-xs">
              This page is reached through the secure link in your agency invitation email. If you were forwarded here, ask your agency administrator to issue an invitation.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center border-t border-border/60 pt-4">
            <Button variant="outline" asChild className="gap-2">
              <Link href="/login">Go to sign in</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const onSubmit = async (values: FormValues) => {
    setOutcome(null);
    try {
      const result = await authApi.acceptInvitation({
        token,
        password: values.password,
        first_name: values.first_name,
        last_name: values.last_name
      });
      const user = (result as { user?: CurrentUser }).user;
      if (user) {
        queryClient.setQueryData(["auth", "me"], user);
        router.replace(dashboardForRole(user.roles ?? ["learner"]));
      } else {
        setOutcome({
          kind: "existing",
          email: (result as { email?: string }).email,
          message:
            (result as { message?: string }).message ??
            "This email is already associated with an account. The invitation has been linked — sign in to continue."
        });
      }
    } catch (error) {
      if (error instanceof ApiError) {
        const message =
          error.status === 404 || error.status === 409 || error.status === 410
            ? "This invitation is no longer valid. It may have expired, been revoked, or already been used. Contact your agency administrator for a new invitation."
            : Object.keys(error.fieldErrors).length > 0
              ? (error.fieldErrors.password ?? error.fieldErrors.token ?? error.message)
              : error.message;
        setOutcome({ kind: "error", message });
      } else {
        setOutcome({ kind: "error", message: "Unable to process the invitation right now. Please try again." });
      }
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md border-border/80 shadow-card">
        <CardHeader className="space-y-2 pb-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-subtle mb-1">
            <UserPlus className="h-6 w-6" />
          </div>
          <CardTitle className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Activate Your Workspace
          </CardTitle>
          <CardDescription className="text-xs">
            Complete your civil service profile to join your agency training portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {outcome?.kind === "existing" && (
            <Alert className="border-primary/20 bg-primary/5">
              <UserCheck aria-hidden="true" className="h-4 w-4 text-primary" />
              <AlertTitle>Account already exists</AlertTitle>
              <AlertDescription className="text-xs">
                {outcome.message}
                {outcome.email && (
                  <span className="block mt-1 font-semibold text-foreground">Signed in as: {outcome.email}</span>
                )}
              </AlertDescription>
            </Alert>
          )}
          {outcome?.kind === "error" && (
            <Alert variant="destructive">
              <ShieldAlert aria-hidden="true" className="h-4 w-4" />
              <AlertTitle>Invitation cannot be accepted</AlertTitle>
              <AlertDescription className="text-xs">{outcome.message}</AlertDescription>
            </Alert>
          )}
          {outcome?.kind === "existing" ? (
            <Button asChild className="w-full">
              <Link href="/login">Sign in</Link>
            </Button>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="first_name" className="text-xs font-semibold">First name</Label>
                  <Input
                    id="first_name"
                    autoComplete="given-name"
                    aria-invalid={Boolean(errors.first_name)}
                    {...register("first_name")}
                  />
                  {errors.first_name && <FormMessage tone="error">{errors.first_name.message}</FormMessage>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last_name" className="text-xs font-semibold">Last name</Label>
                  <Input
                    id="last_name"
                    autoComplete="family-name"
                    aria-invalid={Boolean(errors.last_name)}
                    {...register("last_name")}
                  />
                  {errors.last_name && <FormMessage tone="error">{errors.last_name.message}</FormMessage>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold">Create password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby="password-hint"
                  {...register("password")}
                />
                <p id="password-hint" className="text-xs text-muted-foreground">
                  At least 12 characters with uppercase, lowercase and a number.
                </p>
                {errors.password && <FormMessage tone="error">{errors.password.message}</FormMessage>}
              </div>
              <Button type="submit" className="w-full font-semibold shadow-sm" disabled={isSubmitting}>
                {isSubmitting ? "Activating…" : "Activate account"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
