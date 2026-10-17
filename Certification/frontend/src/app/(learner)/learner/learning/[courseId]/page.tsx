"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { IntegrationPending } from "@/components/common/integration-boundaries";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { featureFlags } from "@/config/feature-flags";

interface Enrollment {
  uuid: string;
  course?: { uuid?: string; slug?: string; title: string; description?: string };
  status?: string;
  progress_percent?: number;
}

const PUBLIC_ID = /^[0-9a-f-]{8,}$/i;

/** Course overview. Route param is a public uuid/slug only. */
export default function CourseOverviewPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);

  if (!PUBLIC_ID.test(courseId)) {
    return <EmptyState title="Course not found" description="No course matches that reference." />;
  }

  const enrollment = useQuery({
    queryKey: ["learner", "enrollment", courseId],
    queryFn: ({ signal }) => api.get<Enrollment>(`/api/me/enrollments/${courseId}`, { signal }),
    enabled: featureFlags.learnerLearning,
    retry: false
  });

  return (
    <div>
      <PageHeader
        title="Course overview"
        actions={
          <Button variant="ghost" asChild>
            <Link href="/learner/learning">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to My learning
            </Link>
          </Button>
        }
      />

      {!featureFlags.learnerLearning && (
        <IntegrationPending
          feature="Course pages and the player"
          backendRequirement="Enrollment and lesson endpoints (IB-4)."
        />
      )}

      {featureFlags.learnerLearning && enrollment.isPending && (
        <div className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {featureFlags.learnerLearning && enrollment.isError && (
        <EmptyState
          title="Course unavailable"
          description={
            enrollment.error instanceof ApiError && enrollment.error.status === 404
              ? "This course is not in your assigned learning."
              : enrollment.error instanceof ApiError
                ? enrollment.error.message
                : "Please try again later."
          }
        />
      )}

      {featureFlags.learnerLearning && enrollment.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{enrollment.data.course?.title ?? "Course"}</CardTitle>
            {enrollment.data.status && <StatusBadge status={enrollment.data.status} />}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {enrollment.data.course?.description ?? "Course details are provided inside the player."}
            </p>
            <Button asChild>
              <Link href={`/learner/learning/${courseId}/player`}>Open course player</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
