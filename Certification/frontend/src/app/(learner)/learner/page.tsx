"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  GraduationCap,
  ClipboardCheck,
  Award,
  ArrowRight,
  Sparkles,
  Flame,
  CheckCircle2,
  Clock
} from "lucide-react";
import { useSession } from "@/features/auth/session-context";
import { displayName } from "@/features/auth/types";
import { api } from "@/lib/api/client";
import { featureFlags } from "@/config/feature-flags";
import { IntegrationPending } from "@/components/common/integration-boundaries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { CourseCard } from "@/components/learning/course-card";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger-container";

/** GET /api/me/enrollments — INTEGRATION-UNVERIFIED (IB-4). */
interface Enrollment {
  uuid: string;
  course?: { uuid?: string; slug?: string; title: string };
  status?: string;
  progress_percent?: number;
  due_at?: string;
}

/** Local hook — pages may only export default (Next.js page contract). */
function useEnrollments(enabled: boolean) {
  return useQuery({
    queryKey: ["learner", "enrollments"],
    queryFn: ({ signal }) => api.get<{ items?: Enrollment[] }>("/api/me/enrollments", { signal }),
    enabled,
    retry: false
  });
}

export default function LearnerDashboardPage() {
  const { user } = useSession();
  const learningEnabled = featureFlags.learnerLearning;
  const enrollments = useEnrollments(learningEnabled);
  const items = enrollments.data?.items ?? [];

  const completedCount = items.filter((item) => (item.progress_percent ?? 0) >= 100).length;
  const overallProgress = items.length > 0
    ? Math.round(
        items.reduce((acc, curr) => acc + (curr.progress_percent ?? 0), 0) / items.length
      )
    : 0;

  return (
    <div className="space-y-6">
      <WelcomeBanner
        title={`Welcome, ${displayName(user) || "Learner"}`}
        description="Track your agency training obligations, complete course modules, and download official credentials."
        badge="Learner Space"
        action={
          <Button asChild className="gap-2 shadow-sm">
            <Link href="/learner/learning">
              <BookOpen className="h-4 w-4" /> My Learning Path
            </Link>
          </Button>
        }
      />

      {/* Progress Milestone Hero Card */}
      <Card className="border-border/80 shadow-card bg-gradient-to-r from-card via-card to-accent/20">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Overall Curriculum Progress
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  {completedCount} of {items.length || 0} Complete
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Progress syncs securely to federal training records upon each completed module.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="font-heading text-2xl font-bold tabular-nums text-foreground">
                  {overallProgress}%
                </div>
                <div className="text-[11px] text-muted-foreground">Completion Rate</div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Progress value={overallProgress} className="h-2.5" />
          </div>
        </CardContent>
      </Card>

      {/* Main Grid: Assigned Courses & Certificates */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Assigned Courses (2 Columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" /> Assigned Training
            </h2>
            {items.length > 0 && (
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link href="/learner/learning">View all courses</Link>
              </Button>
            )}
          </div>

          {learningEnabled ? (
            <>
              {enrollments.isPending && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="h-48 rounded-xl border border-border/80 bg-secondary/50 animate-pulse" />
                  <div className="h-48 rounded-xl border border-border/80 bg-secondary/50 animate-pulse" />
                </div>
              )}

              {enrollments.isError && (
                <IntegrationPending
                  feature="Assigned training"
                  backendRequirement="GET /api/me/enrollments (IB-4)."
                />
              )}

              {enrollments.data && items.length === 0 && (
                <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
                  <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                  <p className="font-semibold text-foreground">No assigned courses currently</p>
                  <p className="text-xs mt-1">When your agency administrator assigns training to your seat, it appears here immediately.</p>
                </Card>
              )}

              {items.length > 0 && (
                <StaggerContainer className="grid gap-4 sm:grid-cols-2">
                  {items.map((enrollment) => (
                    <StaggerItem key={enrollment.uuid}>
                      <CourseCard
                        id={enrollment.uuid}
                        title={enrollment.course?.title ?? "Course Module"}
                        progressPercent={enrollment.progress_percent ?? 0}
                        status={enrollment.status}
                        dueAt={enrollment.due_at}
                        href={`/learner/learning/${enrollment.course?.uuid ?? enrollment.course?.slug ?? enrollment.uuid}/player`}
                      />
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              )}
            </>
          ) : (
            <IntegrationPending
              feature="Enrollment and assigned training"
              backendRequirement="Enrollment endpoints under /api/me/enrollments (IB-4). This card activates automatically once the backend ships."
            />
          )}
        </div>

        {/* Right Sidebar: Certificates & Resources */}
        <div className="space-y-6">
          <Card className="border-border/80 shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Award className="h-4 w-4 text-amber-500" /> Certificates & Credentials
              </CardTitle>
              <CardDescription className="text-xs">
                Verified certificates upon course assessment completion.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {featureFlags.learnerCertificates ? (
                <Button asChild size="sm" variant="outline" className="w-full gap-2">
                  <Link href="/learner/certificates">
                    View Certificate Vault <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : (
                <IntegrationPending
                  feature="Certificates"
                  backendRequirement="Certificate generation and download endpoints (IB-4)."
                />
              )}
            </CardContent>
          </Card>

          {/* Collapsible Getting Started Guide */}
          <Card className="border-border/80 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <GraduationCap className="h-4 w-4 text-primary" /> Training Guide
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full text-xs">
                <AccordionItem value="step-1">
                  <AccordionTrigger className="text-xs font-medium py-2.5">
                    1. Seat Assignment
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground">
                    Your agency administrator allocates courses to your official seat. No individual billing or credit card is required.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="step-2">
                  <AccordionTrigger className="text-xs font-medium py-2.5">
                    2. Progress Synchronization
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground">
                    Work through lessons at your own pace. Video playback, quiz checkpoints, and lesson completion save automatically.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="step-3">
                  <AccordionTrigger className="text-xs font-medium py-2.5">
                    3. Accredited Certification
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground">
                    Achieve passing marks on final assessments to earn downloadable, tamper-verifiable certificates for compliance audits.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
