"use client";

import React from "react";
import { Award, Download, CheckCircle2, ShieldCheck, ExternalLink } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CertificateCardProps {
  id: string;
  title: string;
  issuedAt: string;
  expiresAt?: string;
  credentialId: string;
  onDownload?: () => void;
}

export function CertificateCard({
  id,
  title,
  issuedAt,
  expiresAt,
  credentialId,
  onDownload
}: CertificateCardProps) {
  return (
    <Card className="group relative overflow-hidden border-border/80 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
      {/* Decorative Ribbon Header */}
      <div className="relative h-24 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md shadow-sm">
            <Award className="h-6 w-6 text-white" />
          </div>
          <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-md">
            <ShieldCheck className="h-3.5 w-3.5" /> Certified
          </span>
        </div>
      </div>

      <CardHeader className="p-5 pb-2">
        <h3 className="font-heading font-bold text-base text-foreground leading-snug">
          {title}
        </h3>
        <p className="font-mono text-[11px] text-muted-foreground mt-1">
          Credential ID: {credentialId}
        </p>
      </CardHeader>

      <CardContent className="p-5 pt-2 text-xs text-muted-foreground space-y-1">
        <div className="flex justify-between">
          <span>Issued Date:</span>
          <span className="font-medium text-foreground">{issuedAt}</span>
        </div>
        {expiresAt && (
          <div className="flex justify-between">
            <span>Valid Until:</span>
            <span className="font-medium text-foreground">{expiresAt}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t border-border/60 p-4 flex gap-2">
        <Button
          size="sm"
          className="flex-1 gap-1.5"
          onClick={onDownload}
        >
          <Download className="h-3.5 w-3.5" /> Download PDF
        </Button>
      </CardFooter>
    </Card>
  );
}
