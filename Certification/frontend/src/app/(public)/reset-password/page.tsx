"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldAlert, KeyRound, Check, ArrowRight } from "lucide-react";
import { authApi } from "@/features/auth/api";
import { ApiError } from "@/lib/api/error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageSuspenseFallback } from "@/components/common/page-suspense-fallback";

const schema = z
  .object({
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[a-z]/, "Include at least one lowercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirm: z.string()
  })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: "Passwords do not match"
  });

type FormValues = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });

  const passwordVal = watch("password") || "";
  const hasMinLength = passwordVal.length >= 12;
  const hasUpper = /[A-Z]/.test(passwordVal);
  const hasLower = /[a-z]/.test(passwordVal);
  const hasNumber = /[0-9]/.test(passwordVal);

  if (!token) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] flex-1 items-center justify-center px-4 py-16">
        <Alert variant="destructive" className="max-w-md shadow-card">
          <ShieldAlert aria-hidden="true" className="h-4 w-4" />
          <AlertTitle>Reset link is incomplete</AlertTitle>
          <AlertDescription>
            This page requires a valid reset token. Request a new password reset email.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      await authApi.confirmPasswordReset({ token, new_password: values.password });
      router.replace("/login?reset=true");
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400 || error.status === 422) {
          setFormError(
            error.fieldErrors.new_password ??
              error.fieldErrors.token ??
              "This reset link is invalid or has expired. Please request a new one."
          );
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError("Unable to reset your password right now. Please try again.");
      }
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md border-border/80 shadow-card">
        <CardHeader className="space-y-2 pb-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-subtle mb-1">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Set New Password
          </CardTitle>
          <CardDescription className="text-xs">
            Create a secure password meeting federal agency security compliance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {formError && <FormMessage tone="error">{formError}</FormMessage>}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold">New password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                autoFocus
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
              />
              {errors.password && <FormMessage tone="error">{errors.password.message}</FormMessage>}
            </div>

            <div className="rounded-lg border border-border/70 bg-secondary/30 p-3 space-y-1 text-[11px] text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Security requirements:</p>
              <div className="flex items-center gap-1.5">
                <Check className={`h-3 w-3 ${hasMinLength ? "text-emerald-600" : "text-muted-foreground/50"}`} />
                <span>At least 12 characters</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className={`h-3 w-3 ${hasUpper ? "text-emerald-600" : "text-muted-foreground/50"}`} />
                <span>Uppercase letter (A-Z)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className={`h-3 w-3 ${hasLower ? "text-emerald-600" : "text-muted-foreground/50"}`} />
                <span>Lowercase letter (a-z)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className={`h-3 w-3 ${hasNumber ? "text-emerald-600" : "text-muted-foreground/50"}`} />
                <span>At least one number (0-9)</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs font-semibold">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirm)}
                {...register("confirm")}
              />
              {errors.confirm && <FormMessage tone="error">{errors.confirm.message}</FormMessage>}
            </div>

            <Button type="submit" className="w-full font-semibold shadow-sm" disabled={isSubmitting}>
              {isSubmitting ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t border-border/60 pt-4 text-xs">
          <Link href="/forgot-password" className="text-primary underline-offset-4 hover:underline">
            Request a new reset link
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<PageSuspenseFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
