"use client";

import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { IntegrationPending } from "@/components/common/integration-boundaries";
import { featureFlags } from "@/config/feature-flags";

/** Assessments — IB-4: no assessment endpoints in the backend yet. */
export default function AssessmentsPage() {
  return (
    <div>
      <PageHeader title="Assessments" description="Quizzes and exams attached to your courses." />
      {featureFlags.learnerAssessments ? (
        // Enabled path renders here once endpoints exist; intentionally no placeholder data.
        <p className="text-sm text-muted-foreground">No assessments are currently assigned.</p>
      ) : (
        <IntegrationPending
          feature="Assessments"
          backendRequirement="Assessment and attempt endpoints under /api/me/assessments (IB-4). The interface activates automatically when the backend ships."
        />
      )}
    </div>
  );
}
