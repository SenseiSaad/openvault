"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldX, Search } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { PageSuspenseFallback } from "@/components/common/page-suspense-fallback";
import { api } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";

interface VerificationResult {
  found: boolean;
  valid: boolean;
  certificate?: {
    certificateNumber: string;
    certificateType: "module" | "final";
    learnerName: string;
    courseTitle: string | null;
    moduleTitle: string | null;
    issuedAt: string;
    expiresAt: string | null;
  };
  revocation?: { revokedAt: string; reason: string };
}

function readToken(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    return url.searchParams.get("token") ?? trimmed;
  } catch {
    return trimmed;
  }
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const [input, setInput] = useState(searchParams.get("token") ?? "");
  const [token, setToken] = useState(searchParams.get("token") ?? "");

  const result = useQuery({
    queryKey: ["certificate", "verify", token],
    queryFn: ({ signal }) =>
      api.get<VerificationResult>(`/api/public/certificates/verify`, {
        query: { token },
        signal
      }),
    enabled: token.length >= 10,
    retry: false
  });

  return (
    <div className="container max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        title="Verify a certificate"
        description="Confirm that a Certification Academy credential is genuine and currently valid. Verification uses the secure link issued with the certificate."
      />

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Verification reference</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              setToken(readToken(input));
            }}
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="token">Certificate link or token</Label>
              <Input
                id="token"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Paste the verification link or token from the certificate email"
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={input.trim().length < 10} className="gap-1.5">
              <Search aria-hidden="true" className="h-4 w-4" /> Verify
            </Button>
          </form>
        </CardContent>
      </Card>

      {token.length >= 10 && result.isPending && <Spinner label="Checking certificate" />}

      {token.length >= 10 && result.isError && (
        <EmptyState
          title="Verification unavailable"
          description="The verification service could not be reached. Please try again shortly."
        />
      )}

      {result.data?.found === false && (
        <EmptyState
          icon={ShieldX}
          title="No certificate found"
          description="This reference does not match any issued certificate. Check that the full link was copied."
        />
      )}

      {result.data?.found && result.data.certificate && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                {result.data.valid ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                ) : (
                  <ShieldX className="h-5 w-5 text-destructive" />
                )}
                {result.data.valid ? "Valid certificate" : "Certificate revoked"}
              </CardTitle>
              <Badge className={result.data.valid ? "bg-emerald-600 text-white" : ""}>
                {result.data.valid ? "Valid" : "Revoked"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Awarded to</span>
              <span className="font-medium">{result.data.certificate.learnerName}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Credential</span>
              <span className="text-right">
                {result.data.certificate.courseTitle ?? result.data.certificate.moduleTitle}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Type</span>
              <span className="capitalize">{result.data.certificate.certificateType}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Certificate number</span>
              <span className="font-mono text-xs">{result.data.certificate.certificateNumber}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Issued</span>
              <span>{formatDate(result.data.certificate.issuedAt)}</span>
            </div>
            {result.data.certificate.expiresAt && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Expires</span>
                <span>{formatDate(result.data.certificate.expiresAt)}</span>
              </div>
            )}
            {result.data.revocation && (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                Revoked on {formatDate(result.data.revocation.revokedAt)} — {result.data.revocation.reason}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<PageSuspenseFallback />}>
      <VerifyContent />
    </Suspense>
  );
}
