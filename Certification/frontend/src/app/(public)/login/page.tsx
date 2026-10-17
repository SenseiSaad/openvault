"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api";
import { ApiError } from "@/lib/api/error";
import { dashboardForRole } from "@/features/auth/dashboard-for-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageSuspenseFallback } from "@/components/common/page-suspense-fallback";
import {
  ShieldAlert,
  AlertTriangle,
  GraduationCap,
  ShieldCheck,
  Lock,
  ArrowRight,
  CheckCircle2
} from "lucide-react";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required")
});

type LoginForm = z.infer<typeof loginSchema>;

function safeNextParam(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "";
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const nextPath = safeNextParam(searchParams.get("next"));
  const expired = searchParams.get("expired") === "true";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema), mode: "onSubmit" });

  // Already signed in? Go straight to the role dashboard.
  useEffect(() => {
    const me = queryClient.getQueryData<{ roles?: string[] }>(["auth", "me"]);
    if (me?.roles?.length) {
      router.replace(nextPath || dashboardForRole(me.roles as never));
    }
  }, [queryClient, router, nextPath]);

  const onSubmit = async (values: LoginForm) => {
    setFormError(null);
    try {
      const result = await authApi.login(values);
      const roles = result.user?.roles;
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      const me = await queryClient.fetchQuery({
        queryKey: ["auth", "me"],
        queryFn: ({ signal }) => authApi.me(signal),
        staleTime: Infinity
      });
      const target = nextPath || dashboardForRole(me.roles ?? (roles as never) ?? ["learner"]);
      router.replace(target);
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(
          error.status === 401
            ? "The email address or password is incorrect."
            : error.fieldErrors.password ?? error.fieldErrors.email ?? error.message
        );
      } else {
        setFormError("Unable to sign in right now. Please try again.");
      }
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl lg:grid-cols-2">
        {/* Left Branding Showcase Panel */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-indigo-900 to-slate-950 p-10 text-white lg:flex">
          <div className="absolute right-0 top-0 -mr-20 -mt-20 h-80 w-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

          <div className="relative">
            <Link href="/" className="inline-flex items-center gap-2.5 text-white">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md shadow-sm">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <span className="font-heading text-lg font-bold tracking-tight">
                Certification Academy
              </span>
            </Link>
          </div>

          <div className="relative my-auto space-y-6 py-12">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <ShieldCheck className="h-3.5 w-3.5" />
              Federal Accreditation Standard
            </div>

            <h2 className="font-heading text-3xl font-extrabold tracking-tight leading-tight text-white">
              Enterprise training & certification for civil service.
            </h2>

            <p className="text-sm text-white/80 leading-relaxed">
              Serving federal agencies, military branches, and state departments with auditable compliance tracking, verified completions, and multi-tenant management.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-white/90">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>NIST 800-53 & FISMA compliant session security</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/90">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Instant seat entitlement and automated rosters</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/90">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Verifiable digital credentials & exportable transcripts</span>
              </div>
            </div>
          </div>

          <div className="relative text-xs text-white/60">
            Official U.S. Government Training Platform
          </div>
        </div>

        {/* Right Form Card */}
        <div className="flex flex-col justify-center p-6 sm:p-10">
          <div className="mx-auto w-full max-w-sm space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 lg:hidden mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <span className="font-heading font-bold text-sm">Certification Academy</span>
              </div>

              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Sign in
              </h1>
              <p className="text-xs text-muted-foreground">
                Enter your work email and password to access your portal.
              </p>
            </div>

            {expired && (
              <Alert variant="warning">
                <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                <AlertTitle>Session expired</AlertTitle>
                <AlertDescription>Your session ended. Please sign in again to continue.</AlertDescription>
              </Alert>
            )}

            {formError && (
              <Alert variant="destructive">
                <ShieldAlert aria-hidden="true" className="h-4 w-4" />
                <AlertTitle>Sign-in failed</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="name@agency.gov"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  {...register("email")}
                />
                {errors.email && (
                  <span id="email-error">
                    <FormMessage tone="error">{errors.email.message}</FormMessage>
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  {...register("password")}
                />
                {errors.password && (
                  <span id="password-error">
                    <FormMessage tone="error">{errors.password.message}</FormMessage>
                  </span>
                )}
              </div>

              <Button type="submit" className="w-full font-semibold shadow-sm" disabled={isSubmitting}>
                {isSubmitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <div className="pt-4 border-t border-border/70 text-center space-y-2 text-xs text-muted-foreground">
              <p>
                Have an invitation token?{" "}
                <Link href="/accept-invitation" className="font-semibold text-primary underline-offset-4 hover:underline">
                  Accept invitation here
                </Link>
              </p>
              <p className="text-[11px] text-muted-foreground/80">
                Accounts are managed by your agency administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageSuspenseFallback />}>
      <LoginForm />
    </Suspense>
  );
}
