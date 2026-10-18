"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  MailCheck,
  Armchair,
  ReceiptText,
  UserPlus,
  BookOpen,
  Award,
  GraduationCap,
  Target,
  CheckCircle2
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { agencyApi, useAgencyOverview, useAgencyScope } from "@/features/agency/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/dashboard/stat-card";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger-container";
import { FadeIn } from "@/components/motion/fade-in";
import { formatDateTime } from "@/lib/utils";

/** Agency operations overview — every number and activity entry comes from the backend. */
export default function AgencyOverviewPage() {
  const { agency, agencyId } = useAgencyScope();
  const overview = useAgencyOverview();

  const reports = useQuery({
    queryKey: ["agency", agencyId, "reports"],
    queryFn: () => agencyApi.reportsOverview(agencyId as string),
    enabled: Boolean(agencyId)
  });
  const learners = useQuery({
    queryKey: ["agency", agencyId, "report-learners"],
    queryFn: () => agencyApi.reportsLearners(agencyId as string),
    enabled: Boolean(agencyId)
  });
  const audit = useQuery({
    queryKey: ["agency", agencyId, "audit"],
    queryFn: () => agencyApi.auditLog(agencyId as string, 6),
    enabled: Boolean(agencyId)
  });

  const quickActionItems = [
    {
      title: "Invite Member",
      description: "Send invitation link to an agency colleague",
      href: "/agency/invitations",
      icon: UserPlus
    },
    {
      title: "Directory Roster",
      description: "Inspect active staff and assigned roles",
      href: "/agency/members",
      icon: Users
    },
    {
      title: "Procure Training",
      description: "Purchase certified curriculum entitlements",
      href: "/agency/catalogue",
      icon: BookOpen
    },
    {
      title: "Seat Assignments",
      description: "Allocate and release course seat licenses",
      href: "/agency/seats",
      icon: Armchair
    }
  ];

  const activities = (audit.data?.items ?? []).map((entry) => ({
    id: entry.id,
    title: entry.action
      .replace(/[._]/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase()),
    description: `${entry.subjectType.replace(/_/g, " ")} · ${entry.actorType}`,
    timestamp: formatDateTime(entry.occurredAt),
    type: entry.action.startsWith("seat") ? ("success" as const) : ("info" as const)
  }));

  const report = reports.data;
  const teamRows = (learners.data?.items ?? []).slice(0, 6);

  return (
    <div className="space-y-6">
      <WelcomeBanner
        title={agency?.name ? `Welcome back, ${agency.name}` : "Agency Operations Command"}
        description="Monitor staff certifications, manage seat allocations, and procure accredited government training."
        agencyName={agency?.name}
        badge="Agency Administration"
        action={
          <Button asChild className="gap-2 shadow-sm">
            <Link href="/agency/invitations">
              <UserPlus className="h-4 w-4" /> Invite Staff
            </Link>
          </Button>
        }
      />

      {overview.isError ? (
        <EmptyState
          title="Overview unavailable"
          description="The agency summary could not be loaded. Please verify your connection or try again later."
        />
      ) : (
        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StaggerItem>
            <StatCard
              label="Staff Members"
              value={overview.data?.members}
              isLoading={overview.isPending}
              href="/agency/members"
              icon={Users}
              variant="indigo"
              description="Active agency accounts"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Pending Invitations"
              value={overview.data?.pending_invitations}
              isLoading={overview.isPending}
              href="/agency/invitations"
              icon={MailCheck}
              variant="amber"
              description="Awaiting account activation"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Available Seats"
              value={overview.data?.seats_available}
              isLoading={overview.isPending}
              href="/agency/seats"
              icon={Armchair}
              variant="emerald"
              description="Unassigned course licenses"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Recent Orders"
              value={overview.data?.recent_orders}
              isLoading={overview.isPending}
              href="/agency/orders"
              icon={ReceiptText}
              variant="sky"
              description="Procurement transactions (30 days)"
            />
          </StaggerItem>
        </StaggerContainer>
      )}

      {/* Real program health from the reporting API */}
      <FadeIn delay={0.2}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Target aria-hidden="true" className="h-4 w-4" /> Completion rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {report?.enrollments.completionPercent === null || report?.enrollments.completionPercent === undefined
                  ? "—"
                  : `${report.enrollments.completionPercent}%`}
              </p>
              <p className="text-xs text-muted-foreground">
                {report ? `${report.enrollments.completed} of ${report.enrollments.total} enrollments` : "Loading…"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <GraduationCap aria-hidden="true" className="h-4 w-4" /> Assessment pass rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {report?.assessments.passRatePercent === null || report?.assessments.passRatePercent === undefined
                  ? "—"
                  : `${report.assessments.passRatePercent}%`}
              </p>
              <p className="text-xs text-muted-foreground">
                {report ? `${report.assessments.passed} passed / ${report.assessments.graded} graded` : "Loading…"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> Average score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">
                {report?.assessments.averageScorePercent === null ||
                report?.assessments.averageScorePercent === undefined
                  ? "—"
                  : `${report.assessments.averageScorePercent}%`}
              </p>
              <p className="text-xs text-muted-foreground">Across graded attempts</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Award aria-hidden="true" className="h-4 w-4" /> Certificates issued
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{report?.certificates.issued ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                {report ? `${report.certificates.revoked} revoked` : "Loading…"}
              </p>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      <FadeIn delay={0.3} className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Team progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {teamRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No learner enrollments yet.</p>
              ) : (
                teamRows.map((row) => (
                  <div key={`${row.email}-${row.courseTitle}`} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium">
                        {row.learnerName} · {row.courseTitle}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {row.progressPercent}%
                        </span>
                        <StatusBadge status={row.enrollmentStatus} />
                      </div>
                    </div>
                    <Progress value={row.progressPercent} className="h-1.5" />
                  </div>
                ))
              )}
              <div className="pt-1">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/agency/reports">View full report</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
          <QuickActions items={quickActionItems} />
        </div>
        <div>
          {activities.length > 0 ? (
            <ActivityTimeline items={activities} />
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recent activity</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">No audit activity yet.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </FadeIn>
    </div>
  );
}
