"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, ShieldCheck, Mail, Briefcase } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/ui/form-message";
import { Spinner } from "@/components/ui/spinner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

/** GET/PATCH /api/me/profile — INTEGRATION-UNVERIFIED (IB-2). */
interface Profile {
  email: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
}

const schema = z.object({
  first_name: z.string().max(80).optional(),
  last_name: z.string().max(80).optional(),
  job_title: z.string().max(120).optional()
});
type ProfileForm = z.infer<typeof schema>;

export default function LearnerProfilePage() {
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ["learner", "profile"],
    queryFn: ({ signal }) => api.get<Profile>("/api/me/profile", { signal }),
    retry: false
  });

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ProfileForm>({
    resolver: zodResolver(schema),
    values: {
      first_name: profile.data?.first_name ?? "",
      last_name: profile.data?.last_name ?? "",
      job_title: profile.data?.job_title ?? ""
    }
  });

  const save = useMutation({
    mutationFn: (values: ProfileForm) => api.patch("/api/me/profile", values),
    onSuccess: async () => {
      toast.success("Profile updated successfully.");
      await queryClient.invalidateQueries({ queryKey: ["learner", "profile"] });
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "The profile could not be saved.")
  });

  const initials = `${profile.data?.first_name?.[0] ?? ""}${profile.data?.last_name?.[0] ?? ""}`.toUpperCase() || "U";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal Profile & Credentials"
        description="Verify your identity details. These determine how your legal name appears on issued certificates and official rosters."
      />

      {profile.isPending && (
        <div className="flex justify-center py-16">
          <Spinner label="Loading profile" />
        </div>
      )}

      {profile.isError && (
        <EmptyState
          title="Profile unavailable"
          description={profile.error instanceof ApiError ? profile.error.message : "Please try again later."}
        />
      )}

      {profile.data && (
        <div className="grid gap-6 md:grid-cols-3 max-w-4xl">
          {/* Identity Snapshot Card */}
          <Card className="border-border/80 shadow-card md:col-span-1 h-fit">
            <CardHeader className="text-center pb-2">
              <Avatar className="mx-auto h-20 w-20 shadow-md ring-4 ring-primary/10">
                <AvatarFallback className="bg-primary/10 text-primary font-heading font-bold text-xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <CardTitle className="font-heading text-lg font-bold mt-3">
                {profile.data.first_name || profile.data.last_name
                  ? `${profile.data.first_name ?? ""} ${profile.data.last_name ?? ""}`.trim()
                  : "Government Learner"}
              </CardTitle>
              <CardDescription className="text-xs">
                {profile.data.job_title || "Agency Staff Member"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 text-xs space-y-2 border-t border-border/60">
              <div className="flex items-center gap-2 text-muted-foreground pt-2">
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate">{profile.data.email}</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-600">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Agency Verified Account</span>
              </div>
            </CardContent>
          </Card>

          {/* Edit Form Card */}
          <Card className="border-border/80 shadow-card md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Account Information</CardTitle>
              <CardDescription className="text-xs">
                Official sign-in email is managed and provisioned by your agency administrator.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleSubmit((values) => save.mutateAsync(values))}
                noValidate
                className="space-y-4"
                aria-busy={save.isPending}
              >
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
                  <Label htmlFor="job_title" className="text-xs font-semibold">Job title or division (optional)</Label>
                  <Input
                    id="job_title"
                    placeholder="e.g. Senior Security Analyst"
                    aria-invalid={Boolean(errors.job_title)}
                    {...register("job_title")}
                  />
                  {errors.job_title && <FormMessage tone="error">{errors.job_title.message}</FormMessage>}
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={save.isPending} className="gap-2 shadow-sm">
                    {save.isPending ? "Saving changes…" : "Save Changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
