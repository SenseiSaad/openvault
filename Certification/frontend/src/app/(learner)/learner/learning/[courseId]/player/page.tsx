"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  PlayCircle,
  BookOpen,
  ArrowLeft,
  ShieldCheck,
  Award
} from "lucide-react";
import { IntegrationPending } from "@/components/common/integration-boundaries";
import { EmptyState } from "@/components/common/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { featureFlags } from "@/config/feature-flags";
import { fireCelebration } from "@/components/learning/confetti";
import { cn } from "@/lib/utils";

/**
 * Course player with server-synchronized progress.
 * INTEGRATION-UNVERIFIED (IB-4): lesson/progress endpoints are not in the
 * backend yet. The whole player is behind featureFlags.learnerLearning.
 */

interface Lesson {
  uuid: string;
  title: string;
  duration_minutes?: number;
  completed?: boolean;
}

interface EnrollmentDetail {
  uuid: string;
  course?: { title: string };
  lessons?: Lesson[];
  progress_percent?: number;
}

export default function CoursePlayerPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const queryClient = useQueryClient();
  const [activeLesson, setActiveLesson] = useState<string | null>(null);

  const enrollment = useQuery({
    queryKey: ["learner", "enrollment", courseId],
    queryFn: ({ signal }) => api.get<EnrollmentDetail>(`/api/me/enrollments/${courseId}`, { signal }),
    enabled: featureFlags.learnerLearning,
    retry: false
  });

  const lessons = enrollment.data?.lessons ?? [];
  const current = lessons.find((lesson) => lesson.uuid === activeLesson) ?? lessons[0];

  const completedCount = lessons.filter((l) => l.completed).length;
  const progressPercent = lessons.length > 0
    ? Math.round((completedCount / lessons.length) * 100)
    : 0;

  const completeLesson = useMutation({
    mutationFn: (lessonUuid: string) =>
      api.post(`/api/me/progress`, { enrollment_uuid: courseId, lesson_uuid: lessonUuid }),
    onMutate: async (lessonUuid) => {
      await queryClient.cancelQueries({ queryKey: ["learner", "enrollment", courseId] });
      const previous = queryClient.getQueryData<EnrollmentDetail>(["learner", "enrollment", courseId]);
      queryClient.setQueryData<EnrollmentDetail>(["learner", "enrollment", courseId], (old) =>
        old
          ? {
              ...old,
              lessons: (old.lessons ?? []).map((lesson) =>
                lesson.uuid === lessonUuid ? { ...lesson, completed: true } : lesson
              )
            }
          : old
      );
      return { previous };
    },
    onError: (error, _lessonUuid, context) => {
      if (context?.previous) queryClient.setQueryData(["learner", "enrollment", courseId], context.previous);
      toast.error(error instanceof ApiError ? error.message : "Progress could not be saved. Please try again.");
    },
    onSuccess: () => {
      toast.success("Lesson marked as complete.");
      fireCelebration();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["learner", "enrollment", courseId] })
  });

  if (!featureFlags.learnerLearning) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-xs">
          <Link href="/learner/learning">
            <ArrowLeft className="h-4 w-4" /> Back to My Learning
          </Link>
        </Button>
        <IntegrationPending
          feature="Course player and synchronized progress"
          backendRequirement="Enrollment, lesson listing and progress endpoints (IB-4). The player is fully implemented behind this flag; nothing is simulated."
        />
      </div>
    );
  }

  if (enrollment.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner label="Loading course player" />
      </div>
    );
  }

  if (enrollment.isError || !enrollment.data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-xs">
          <Link href="/learner/learning">
            <ArrowLeft className="h-4 w-4" /> Back to My Learning
          </Link>
        </Button>
        <EmptyState
          title="Course unavailable"
          description={enrollment.error instanceof ApiError ? enrollment.error.message : "Please try again later."}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Navigation & Course Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/70 pb-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2 text-xs text-muted-foreground hover:text-foreground">
            <Link href="/learner/learning">
              <ArrowLeft className="h-4 w-4" /> Back to Curriculum
            </Link>
          </Button>
          <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {enrollment.data.course?.title ?? "Course Player"}
          </h1>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="w-36 space-y-1">
            <div className="flex justify-between font-medium">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-bold tabular-nums text-foreground">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>

          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground border border-border/80 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Official Track
          </span>
        </div>
      </div>

      {/* Main Player Grid */}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Left: Lessons Sidebar */}
        <aside
          aria-label="Lesson navigation"
          className="rounded-xl border border-border/80 bg-card p-4 shadow-card h-fit space-y-3"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Curriculum Outline
            </p>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {completedCount} / {lessons.length} Done
            </span>
          </div>

          <ol className="space-y-1.5">
            {lessons.map((lesson, index) => {
              const isSelected = current?.uuid === lesson.uuid;
              return (
                <li key={lesson.uuid}>
                  <button
                    type="button"
                    onClick={() => setActiveLesson(lesson.uuid)}
                    aria-current={isSelected ? "true" : undefined}
                    className={cn(
                      "group flex w-full items-center justify-between gap-3 rounded-lg p-2.5 text-left text-xs transition-all duration-150",
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                        : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold border",
                          isSelected
                            ? "bg-primary-foreground text-primary border-primary-foreground"
                            : "bg-secondary text-muted-foreground border-border"
                        )}
                      >
                        {index + 1}
                      </span>
                      <span className="truncate">{lesson.title}</span>
                    </div>

                    {lesson.completed && (
                      <CheckCircle2
                        aria-label="Completed"
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isSelected ? "text-primary-foreground" : "text-emerald-600"
                        )}
                      />
                    )}
                  </button>
                </li>
              );
            })}
            {lessons.length === 0 && (
              <li className="py-4 text-center text-xs text-muted-foreground">
                No published modules available.
              </li>
            )}
          </ol>
        </aside>

        {/* Right: Content Area & Controls */}
        <section
          aria-label="Lesson content"
          className="rounded-xl border border-border/80 bg-card p-6 shadow-card space-y-6"
        >
          {current ? (
            <>
              <div className="border-b border-border/60 pb-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-1">
                  <PlayCircle className="h-4 w-4" /> Active Module
                </div>
                <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  {current.title}
                </h2>
                {current.duration_minutes && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> Estimated time: {current.duration_minutes} minutes
                  </p>
                )}
              </div>

              {/* Realistic Interactive Viewer Placeholder */}
              <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-b from-secondary/50 to-secondary/20 p-10 text-center">
                <div className="mx-auto max-w-md space-y-4 py-8">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                    <BookOpen className="h-8 w-8" />
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-foreground">
                    Interactive Lesson Player
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Module content streams directly from the government-authorized CDN when integrated with the backend content repository (IB-4).
                  </p>
                </div>
              </div>

              {/* Navigation Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    !lessons.some((lesson) => lesson.uuid === current.uuid) ||
                    lessons[0]?.uuid === current.uuid
                  }
                  onClick={() => {
                    const index = lessons.findIndex((lesson) => lesson.uuid === current.uuid);
                    const previous = lessons[index - 1];
                    if (previous) setActiveLesson(previous.uuid);
                  }}
                  className="gap-1.5"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous Lesson
                </Button>

                <Button
                  size="sm"
                  disabled={current.completed || completeLesson.isPending}
                  onClick={() => completeLesson.mutate(current.uuid)}
                  className="gap-1.5 shadow-sm"
                >
                  {current.completed ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Completed
                    </>
                  ) : completeLesson.isPending ? (
                    "Saving Progress…"
                  ) : (
                    <>
                      Mark Complete & Continue <CheckCircle2 className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={lessons[lessons.length - 1]?.uuid === current.uuid}
                  onClick={() => {
                    const index = lessons.findIndex((lesson) => lesson.uuid === current.uuid);
                    const next = lessons[index + 1];
                    if (next) setActiveLesson(next.uuid);
                  }}
                  className="gap-1.5"
                >
                  Next Lesson <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No lessons published yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
