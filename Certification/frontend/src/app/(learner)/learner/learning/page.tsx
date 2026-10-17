"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, GraduationCap, CheckCircle2, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { IntegrationPending } from "@/components/common/integration-boundaries";
import { StatusBadge } from "@/components/common/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { featureFlags } from "@/config/feature-flags";
import { CourseCard } from "@/components/learning/course-card";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger-container";

interface Enrollment {
  uuid: string;
  course?: { uuid?: string; slug?: string; title: string };
  status?: string;
  progress_percent?: number;
  due_at?: string;
}

/** My learning. Gated on IB-4 (enrollment endpoints not yet in backend). */
export default function MyLearningPage() {
  const learning = useQuery({
    queryKey: ["learner", "enrollments"],
    queryFn: ({ signal }) => api.get<{ items?: Enrollment[] }>("/api/me/enrollments", { signal }),
    enabled: featureFlags.learnerLearning,
    retry: false
  });

  if (!featureFlags.learnerLearning) {
    return (
      <div className="space-y-4">
        <PageHeader title="My learning" description="Assigned courses and your progress." />
        <IntegrationPending
          feature="My learning and the course player"
          backendRequirement="Enrollment, lesson and progress endpoints under /api/me (IB-4). The UI is fully implemented behind this flag and activates when the backend ships — no simulated courses are shown."
        />
      </div>
    );
  }

  const items = learning.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Learning Curriculum"
        description="Access your assigned agency certification courses, track progress, and resume active lessons."
      />

      {learning.isPending && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-64 rounded-xl border border-border/80 bg-secondary/50 animate-pulse" />
          ))}
        </div>
      )}

      {learning.isError && (
        <EmptyState
          title="Learning unavailable"
          description={learning.error instanceof ApiError ? learning.error.message : "Please try again later."}
        />
      )}

      {learning.data && items.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No assigned training yet"
          description="When your agency administrator assigns a course to your seat, it appears here immediately."
        />
      )}

      {items.length > 0 && (
        <StaggerContainer className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}
