"use client";

import { Award } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { IntegrationPending } from "@/components/common/integration-boundaries";
import { featureFlags } from "@/config/feature-flags";

/** Certificates — IB-4: no certificate endpoints in the backend yet. */
export default function CertificatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificates & Credentials Vault"
        description="Official completion certificates and verifiable accreditation credentials earned through your certified training."
      />
      {featureFlags.learnerCertificates ? (
        <EmptyState
          icon={Award}
          title="No certificates earned yet"
          description="Complete all required lessons and pass the final course assessments to unlock official downloadable certificates."
        />
      ) : (
        <IntegrationPending
          feature="Certificates"
          backendRequirement="Certificate generation and download endpoints under /api/me/certificates (IB-4). No completion data is simulated."
        />
      )}
    </div>
  );
}
