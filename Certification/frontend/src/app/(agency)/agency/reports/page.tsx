"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { agencyApi, useAgencyScope } from "@/features/agency/api";
import { formatDate } from "@/lib/utils";

/** Agency learner report with server-generated CSV/PDF exports. */
export default function AgencyReportsPage() {
  const { agencyId } = useAgencyScope();
  const report = useQuery({
    queryKey: ["agency", agencyId, "report-learners"],
    queryFn: () => agencyApi.reportsLearners(agencyId as string),
    enabled: Boolean(agencyId),
    retry: false
  });

  const csvUrl = agencyId ? `/api/agencies/${agencyId}/reports/learners.csv` : "#";
  const pdfUrl = agencyId ? `/api/agencies/${agencyId}/reports/learners.pdf` : "#";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team report"
        description="Per-learner progress, assessment scores and completion dates. Exports are generated server-side."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <a href={csvUrl} download>
                <Download aria-hidden="true" className="h-4 w-4" /> CSV
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <a href={pdfUrl} download>
                <FileText aria-hidden="true" className="h-4 w-4" /> PDF
              </a>
            </Button>
          </div>
        }
      />

      {report.isPending ? (
        <Spinner label="Loading team report" />
      ) : report.isError ? (
        <EmptyState title="Report unavailable" description="The team report could not be loaded." />
      ) : (report.data?.items ?? []).length === 0 ? (
        <EmptyState
          title="No enrollments yet"
          description="Learner progress appears here once seats are assigned and courses are started."
        />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Learner progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(report.data?.items ?? []).map((row) => (
              <div key={`${row.email}-${row.courseTitle}`} className="space-y-1 border-b border-border/60 pb-3 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{row.learnerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.email} · {row.courseTitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="tabular-nums">{row.progressPercent}%</span>
                    <StatusBadge status={row.enrollmentStatus} />
                  </div>
                </div>
                <Progress value={row.progressPercent} className="h-1.5" />
                <p className="text-xs text-muted-foreground">
                  Best assessment: {row.bestScorePercent === null ? "—" : `${row.bestScorePercent}%`} ·
                  Assessments passed: {row.assessmentsPassed}/{row.assessmentsTotal} ·
                  Assigned: {formatDate(row.assignedAt)}
                  {row.completedAt ? ` · Completed: ${formatDate(row.completedAt)}` : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
