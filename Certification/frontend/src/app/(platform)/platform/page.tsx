"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  BookOpen,
  Tags,
  ShieldAlert,
  DollarSign,
  Users,
  GraduationCap,
  Award
} from "lucide-react";
import { platformApi } from "@/features/platform/api";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/dashboard/stat-card";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger-container";
import { FadeIn } from "@/components/motion/fade-in";
import { formatCurrency } from "@/lib/utils";

/** Platform overview — all values come from the reporting/stats APIs. */
export default function PlatformOverviewPage() {
  const stats = useQuery({ queryKey: ["platform", "stats"], queryFn: () => platformApi.stats(), retry: false });
  const report = useQuery({
    queryKey: ["platform", "report-overview"],
    queryFn: () => platformApi.reportsOverview(),
    retry: false
  });
  const completions = useQuery({
    queryKey: ["platform", "completions"],
    queryFn: () => platformApi.reportsCompletions(),
    retry: false
  });
  const assessments = useQuery({
    queryKey: ["platform", "assessment-report"],
    queryFn: () => platformApi.reportsAssessments(),
    retry: false
  });

  const platformActions = [
    {
      title: "Agency Directory",
      description: "Manage registered government agency accounts and quotas",
      href: "/platform/agencies",
      icon: Building2
    },
    {
      title: "Catalog Publishing",
      description: "Publish accredited courses, manage versions and modules",
      href: "/platform/catalog",
      icon: BookOpen
    },
    {
      title: "Products & Pricing",
      description: "Configure per-seat entitlement rates and availability",
      href: "/platform/products",
      icon: Tags
    },
    {
      title: "Audit & Compliance Log",
      description: "Inspect immutable security logs and authentication events",
      href: "/platform/audit",
      icon: ShieldAlert
    }
  ];

  return (
    <div className="space-y-6">
      <WelcomeBanner
        title="Fleet Platform Command"
        description="Oversee government agency tenants, master training course versions, and system compliance."
        badge="Platform Operations"
        action={
          <Button asChild className="gap-2 shadow-sm">
            <Link href="/platform/agencies">
              <Building2 className="h-4 w-4" /> Manage Agencies
            </Link>
          </Button>
        }
      />

      {stats.isError ? (
        <EmptyState title="Statistics unavailable" description="Platform statistics could not be loaded." />
      ) : (
        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StaggerItem>
            <StatCard
              label="Total Agencies"
              value={stats.data?.agencies_total}
              isLoading={stats.isPending}
              href="/platform/agencies"
              icon={Building2}
              variant="indigo"
              description="Registered tenant organizations"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Active Tenants"
              value={stats.data?.agencies_active}
              isLoading={stats.isPending}
              href="/platform/agencies"
              icon={Users}
              variant="emerald"
              description="Healthy operating state"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Published Courses"
              value={stats.data?.courses_published}
              isLoading={stats.isPending}
              href="/platform/catalog"
              icon={BookOpen}
              variant="sky"
              description="Active accredited curricula"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Products"
              value={stats.data?.products_total}
              isLoading={stats.isPending}
              href="/platform/products"
              icon={Tags}
              variant="amber"
              description="Sellable catalogue products"
            />
          </StaggerItem>
        </StaggerContainer>
      )}

      <FadeIn delay={0.2}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <DollarSign aria-hidden="true" className="h-4 w-4" /> Paid revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {report.data ? formatCurrency(report.data.revenue_cents) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {report.data ? `${report.data.paid_orders} paid orders` : "Loading…"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <GraduationCap aria-hidden="true" className="h-4 w-4" /> Enrollment completion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {report.data?.enrollments.completion_percent === null ||
                report.data?.enrollments.completion_percent === undefined
                  ? "—"
                  : `${report.data.enrollments.completion_percent}%`}
              </p>
              <p className="text-xs text-muted-foreground">
                {report.data
                  ? `${report.data.enrollments.completed} of ${report.data.enrollments.total} enrollments`
                  : "Loading…"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Award aria-hidden="true" className="h-4 w-4" /> Assessment pass rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {report.data?.assessments.pass_rate_percent === null ||
                report.data?.assessments.pass_rate_percent === undefined
                  ? "—"
                  : `${report.data.assessments.pass_rate_percent}%`}
              </p>
              <p className="text-xs text-muted-foreground">
                {report.data
                  ? `${report.data.assessments.passed} passed / ${report.data.assessments.graded} graded`
                  : "Loading…"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Award aria-hidden="true" className="h-4 w-4" /> Certificates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{report.data?.certificates.issued ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                {report.data ? `${report.data.certificates.revoked} revoked` : "Loading…"}
              </p>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      <FadeIn delay={0.3} className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Course completion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(completions.data?.items ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No enrollments yet.</p>
              ) : (
                (completions.data?.items ?? []).slice(0, 8).map((row) => (
                  <div key={row.courseTitle} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium">{row.courseTitle}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {row.completed} / {row.enrollments}
                      </span>
                    </div>
                    <Progress value={row.completionPercent ?? 0} className="h-1.5" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <QuickActions items={platformActions} />
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Assessment pass rates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(assessments.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No assessment attempts yet.</p>
            ) : (
              (assessments.data?.items ?? []).slice(0, 8).map((row) => (
                <div key={row.assessmentTitle} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{row.assessmentTitle}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {row.passRatePercent === null ? "—" : `${row.passRatePercent}%`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.passed}/{row.graded} passed · avg {row.averageScorePercent ?? "—"}%
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
