"use client";

import { useQuery } from "@tanstack/react-query";
import { Award, Download, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { IntegrationPending } from "@/components/common/integration-boundaries";
import { StatusBadge } from "@/components/common/status-badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api/client";
import { featureFlags } from "@/config/feature-flags";
import { formatDate } from "@/lib/utils";

interface Certificate {
  uuid: string;
  certificateNumber: string;
  certificateType: "module" | "final";
  courseTitle: string | null;
  moduleTitle: string | null;
  issuedAt: string;
  expiresAt: string | null;
  status: "valid" | "revoked";
  revokedAt: string | null;
  revocationReason: string | null;
  pdfUrl: string;
}

export default function CertificatesPage() {
  const certificates = useQuery({
    queryKey: ["learner", "certificates"],
    queryFn: ({ signal }) => api.get<{ items: Certificate[] }>("/api/me/certificates", { signal }),
    enabled: featureFlags.learnerCertificates,
    retry: false
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificates & Credentials Vault"
        description="Official completion certificates and verifiable accreditation credentials earned through your certified training."
      />

      {!featureFlags.learnerCertificates ? (
        <IntegrationPending
          feature="Certificates"
          backendRequirement="Certificate list and download endpoints under /api/me."
        />
      ) : certificates.isPending ? (
        <Spinner label="Loading certificates" />
      ) : certificates.isError ? (
        <EmptyState title="Certificates unavailable" description="Please try again later." />
      ) : (certificates.data?.items ?? []).length === 0 ? (
        <EmptyState
          icon={Award}
          title="No certificates earned yet"
          description="Complete all required lessons and pass the assessments to unlock your official downloadable certificate."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(certificates.data?.items ?? []).map((certificate) => (
            <Card key={certificate.uuid} className="border-border/80 shadow-card">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">
                    {certificate.courseTitle ?? certificate.moduleTitle ?? "Certification"}
                  </CardTitle>
                  <StatusBadge status={certificate.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Certificate no.</span>
                  <span className="font-mono text-xs">{certificate.certificateNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="capitalize">{certificate.certificateType}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Issued</span>
                  <span>{formatDate(certificate.issuedAt)}</span>
                </div>
                {certificate.revokedAt && (
                  <p className="text-xs text-destructive">
                    Revoked {formatDate(certificate.revokedAt)}
                    {certificate.revocationReason ? ` — ${certificate.revocationReason}` : ""}
                  </p>
                )}
              </CardContent>
              <CardFooter className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600" />
                  Verifiable credential
                </span>
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a href={certificate.pdfUrl} target="_blank" rel="noopener noreferrer">
                    <Download aria-hidden="true" className="h-4 w-4" /> Download PDF
                  </a>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
