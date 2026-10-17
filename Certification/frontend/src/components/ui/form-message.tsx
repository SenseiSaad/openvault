"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type FormMessageTone = "error" | "success" | "info";

const toneConfig: Record<FormMessageTone, { className: string; Icon: typeof Info }> = {
  error: { className: "text-destructive", Icon: AlertCircle },
  success: { className: "text-success", Icon: CheckCircle2 },
  info: { className: "text-muted-foreground", Icon: Info }
};

/**
 * Inline form feedback tied to a field via aria-describedby by the caller.
 * Always includes an icon so severity is not conveyed by color alone.
 */
export function FormMessage({ tone = "info", children }: { tone?: FormMessageTone; children: React.ReactNode }) {
  if (!children) return null;
  const { className, Icon } = toneConfig[tone];
  return (
    <p className={cn("flex items-start gap-1.5 text-sm", className)} role={tone === "error" ? "alert" : undefined}>
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
