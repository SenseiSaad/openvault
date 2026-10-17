"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KeyRound, ArrowLeft, MailCheck, GraduationCap } from "lucide-react";
import { authApi } from "@/features/auth/api";
import { ApiError } from "@/lib/api/error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";

const schema = z.object({ email: z.string().min(1, "Email is required").email("Enter a valid email address") });
type FormValues = z.infer<typeof schema>;

/**
 * Always appears successful regardless of whether the account exists — the
 * backend decides; the UI must never disclose account existence.
 */
export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      await authApi.requestPasswordReset(values);
      setSent(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        setFormError("Too many requests. Please wait a moment and try again.");
      } else {
        // Validation errors are shown; anything else still ends in the neutral sent state.
        if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
          setFormError(error.fieldErrors.email ?? "Please review the highlighted fields.");
        } else {
          setSent(true);
        }
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
            Reset your password
          </CardTitle>
          <CardDescription className="text-xs">
            Enter the verified work email address associated with your agency account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center" role="status">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-2">
                <MailCheck className="h-5 w-5" />
              </div>
              <FormMessage tone="success">
                If an account exists for that address, we have sent password reset instructions. Check your inbox and spam folder.
              </FormMessage>
              <Button variant="outline" asChild className="w-full gap-2">
                <Link href="/login">
                  <ArrowLeft className="h-4 w-4" /> Back to sign in
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              {formError && <FormMessage tone="error">{formError}</FormMessage>}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="name@agency.gov"
                  aria-invalid={Boolean(errors.email)}
                  {...register("email")}
                />
                {errors.email && <FormMessage tone="error">{errors.email.message}</FormMessage>}
              </div>
              <Button type="submit" className="w-full font-semibold shadow-sm" disabled={isSubmitting}>
                {isSubmitting ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="justify-center border-t border-border/60 pt-4 text-xs">
          <Link href="/login" className="flex items-center gap-1.5 text-primary underline-offset-4 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
