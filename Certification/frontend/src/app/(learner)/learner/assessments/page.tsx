"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList, RefreshCw, XCircle } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { IntegrationPending } from "@/components/common/integration-boundaries";
import { StatusBadge } from "@/components/common/status-badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { featureFlags } from "@/config/feature-flags";
import { formatDate } from "@/lib/utils";

interface Enrollment {
  uuid: string;
  course?: { title: string };
  status?: string;
}

interface AssessmentOverview {
  assessmentPublicId: string;
  kind: "module" | "final";
  title: string;
  availableFrom: string;
  attemptsUsed: number;
  maxAttempts: number | null;
  bestScorePercent: number | null;
  hasPassed: boolean;
  inProgressAttemptId: string | null;
}

interface AttemptQuestion {
  questionPublicId: string;
  questionType: "single_choice" | "multiple_choice" | "true_false" | "matching";
  promptHtml: string;
  pointsPossible: number;
  displayPosition: number;
  options?: { optionKey: string; optionText: string }[];
  pairs?: { left: { key: string; text: string }[]; right: { key: string; text: string }[] };
  results?: { isCorrect: boolean | null; pointsAwarded: number | null; explanationHtml: string | null };
}

interface Attempt {
  attemptPublicId: string;
  attemptNo: number;
  status: "in_progress" | "submitted" | "graded" | "abandoned";
  scorePercent: number | null;
  passed: boolean | null;
  questions: AttemptQuestion[];
}

function AssessmentList({
  enrollment,
  onStart,
  onResume
}: {
  enrollment: Enrollment;
  onStart: (assessment: AssessmentOverview) => void;
  onResume: (assessment: AssessmentOverview) => void;
}) {
  const assessments = useQuery({
    queryKey: ["learner", "assessments", enrollment.uuid],
    queryFn: ({ signal }) =>
      api.get<{ items: AssessmentOverview[] }>(`/api/me/enrollments/${enrollment.uuid}/assessments`, {
        signal
      }),
    retry: false
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{enrollment.course?.title ?? "Course"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {assessments.isPending && <Spinner label="Loading assessments" />}
        {assessments.isError && (
          <p className="text-sm text-muted-foreground">Assessments could not be loaded.</p>
        )}
        {assessments.data && assessments.data.items.length === 0 && (
          <p className="text-sm text-muted-foreground">No assessments are configured for this course.</p>
        )}
        {(assessments.data?.items ?? []).map((assessment) => {
          const exhausted =
            assessment.maxAttempts !== null && assessment.attemptsUsed >= assessment.maxAttempts;
          return (
            <div
              key={assessment.assessmentPublicId}
              className="flex flex-col gap-3 rounded-lg border border-border/80 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{assessment.title}</span>
                  <Badge variant="neutral" className="capitalize">
                    {assessment.kind}
                  </Badge>
                  {assessment.hasPassed && (
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Passed</Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    Attempts: {assessment.attemptsUsed}
                    {assessment.maxAttempts !== null ? ` / ${assessment.maxAttempts}` : " (unlimited)"}
                  </span>
                  {assessment.bestScorePercent !== null && <span>Best score: {assessment.bestScorePercent}%</span>}
                  <span>Available since {formatDate(assessment.availableFrom)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {assessment.inProgressAttemptId ? (
                  <Button size="sm" onClick={() => onResume(assessment)}>
                    Resume attempt
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={assessment.hasPassed || exhausted}
                    onClick={() => onStart(assessment)}
                  >
                    {assessment.hasPassed ? "Passed" : exhausted ? "No attempts left" : "Start attempt"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AttemptRunner({
  enrollmentUuid,
  assessment,
  onExit
}: {
  enrollmentUuid: string;
  assessment: AssessmentOverview;
  onExit: () => void;
}) {
  const queryClient = useQueryClient();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<
    Record<string, { selected?: string[]; matches?: Record<string, string> }>
  >({});
  const [result, setResult] = useState<Attempt | null>(null);

  const start = useMutation({
    mutationFn: () =>
      api.post<Attempt>(
        `/api/me/enrollments/${enrollmentUuid}/assessments/${assessment.assessmentPublicId}/attempts`
      ),
    onSuccess: (data) => setAttempt(data),
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "The attempt could not be started.")
  });

  const submit = useMutation({
    mutationFn: () =>
      api.post<Attempt>(`/api/me/attempts/${attempt?.attemptPublicId}/submit`, { answers }),
    onSuccess: async (data) => {
      setResult(data);
      setAttempt(null);
      toast.success(data.passed ? "Assessment passed." : "Attempt submitted.");
      await queryClient.invalidateQueries({ queryKey: ["learner"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "The attempt could not be submitted.")
  });

  if (!attempt && !result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{assessment.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            {assessment.kind === "final" ? "Final assessment" : "Module assessment"} ·{" "}
            {assessment.maxAttempts !== null
              ? `${assessment.maxAttempts} attempt${assessment.maxAttempts === 1 ? "" : "s"} allowed`
              : "Unlimited attempts"}
          </p>
          <p>Answer every question, then submit. Questions and answer order may be shuffled.</p>
          <div className="flex gap-2">
            <Button onClick={() => start.mutate()} disabled={start.isPending}>
              {assessment.inProgressAttemptId ? "Resume attempt" : "Begin assessment"}
            </Button>
            <Button variant="outline" onClick={onExit}>
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (result) {
    const passed = result.passed === true;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {passed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            {passed ? "Passed" : "Not passed"} — {result.scorePercent ?? 0}%
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={result.scorePercent ?? 0} />
          {result.questions.map((question) => (
            <div key={question.questionPublicId} className="rounded-lg border border-border/80 p-4">
              <div
                className="text-sm font-medium [&_p]:inline"
                dangerouslySetInnerHTML={{ __html: question.promptHtml }}
              />
              {question.results && (
                <div className="mt-2 space-y-1 text-xs">
                  <p className={question.results.isCorrect ? "text-emerald-600" : "text-destructive"}>
                    {question.results.isCorrect ? "Correct" : "Incorrect"} ·{" "}
                    {question.results.pointsAwarded ?? 0} / {question.pointsPossible} points
                  </p>
                  {question.results.explanationHtml && (
                    <div
                      className="text-muted-foreground [&_p]:inline"
                      dangerouslySetInnerHTML={{ __html: question.results.explanationHtml }}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <Button onClick={onExit}>Back to assessments</Button>
        </CardFooter>
      </Card>
    );
  }

  const questions = attempt?.questions ?? [];
  const setSelected = (questionId: string, keys: string[]) =>
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], selected: keys } }));
  const setMatch = (questionId: string, leftKey: string, rightKey: string) =>
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        matches: { ...(prev[questionId]?.matches ?? {}), [leftKey]: rightKey }
      }
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{assessment.title}</span>
          <span className="text-xs font-normal text-muted-foreground">
            Attempt {attempt?.attemptNo}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {attempt?.status === "in_progress" && questions.length === 0 && (
          <p className="text-sm text-muted-foreground">This attempt has no questions.</p>
        )}
        {questions.map((question) => {
          const answer = answers[question.questionPublicId] ?? {};
          return (
            <fieldset key={question.questionPublicId} className="space-y-3 rounded-lg border border-border/80 p-4">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Question {question.displayPosition} · {question.pointsPossible} point
                {question.pointsPossible === 1 ? "" : "s"}
              </legend>
              <div
                className="text-sm font-medium [&_p]:inline"
                dangerouslySetInnerHTML={{ __html: question.promptHtml }}
              />
              {question.questionType === "matching" ? (
                <div className="space-y-2">
                  {(question.pairs?.left ?? []).map((left) => (
                    <div key={left.key} className="grid items-center gap-2 sm:grid-cols-2">
                      <span className="text-sm">{left.text}</span>
                      <select
                        aria-label={`Match for ${left.text}`}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={answer.matches?.[left.key] ?? ""}
                        onChange={(event) =>
                          setMatch(question.questionPublicId, left.key, event.target.value)
                        }
                      >
                        <option value="">Select a match…</option>
                        {(question.pairs?.right ?? []).map((right) => (
                          <option key={right.key} value={right.key}>
                            {right.text}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {(question.options ?? []).map((option) => {
                    const multiple = question.questionType === "multiple_choice";
                    const selected = (answer.selected ?? []).includes(option.optionKey);
                    return (
                      <label
                        key={option.optionKey}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-secondary/40"
                      >
                        <input
                          type={multiple ? "checkbox" : "radio"}
                          name={question.questionPublicId}
                          checked={selected}
                          onChange={() => {
                            if (multiple) {
                              const current = answer.selected ?? [];
                              setSelected(
                                question.questionPublicId,
                                selected
                                  ? current.filter((key) => key !== option.optionKey)
                                  : [...current, option.optionKey]
                              );
                            } else {
                              setSelected(question.questionPublicId, [option.optionKey]);
                            }
                          }}
                        />
                        <span>{option.optionText}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>
          );
        })}
        <p className="text-xs text-muted-foreground">
          Every question must be answered before submission. Unanswered questions are rejected by
          the server.
        </p>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button onClick={() => submit.mutate()} disabled={submit.isPending || questions.length === 0}>
          {submit.isPending ? "Submitting…" : "Submit assessment"}
        </Button>
        <Button variant="outline" onClick={onExit} disabled={submit.isPending}>
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function AssessmentsPage() {
  const [active, setActive] = useState<{ enrollment: Enrollment; assessment: AssessmentOverview } | null>(
    null
  );
  const enrollments = useQuery({
    queryKey: ["learner", "enrollments"],
    queryFn: ({ signal }) => api.get<{ items: Enrollment[] }>("/api/me/enrollments", { signal }),
    enabled: featureFlags.learnerAssessments,
    retry: false
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Assessments" description="Module quizzes and the final certification exam." />

      {!featureFlags.learnerAssessments ? (
        <IntegrationPending
          feature="Assessments"
          backendRequirement="Assessment and attempt endpoints under /api/me."
        />
      ) : active ? (
        <AttemptRunner
          enrollmentUuid={active.enrollment.uuid}
          assessment={active.assessment}
          onExit={() => setActive(null)}
        />
      ) : enrollments.isPending ? (
        <Spinner label="Loading assessments" />
      ) : enrollments.isError ? (
        <EmptyState title="Assessments unavailable" description="Your enrollments could not be loaded." />
      ) : (enrollments.data?.items ?? []).length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assessments yet"
          description="Assessments appear once your agency assigns you a course seat."
        />
      ) : (
        <div className="space-y-4">
          {(enrollments.data?.items ?? []).map((enrollment) => (
            <AssessmentList
              key={enrollment.uuid}
              enrollment={enrollment}
              onStart={(assessment) => setActive({ enrollment, assessment })}
              onResume={(assessment) => setActive({ enrollment, assessment })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
