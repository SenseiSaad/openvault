"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface WelcomeBannerProps {
  title: string;
  description: string;
  agencyName?: string;
  badge?: string;
  action?: React.ReactNode;
}

export function WelcomeBanner({
  title,
  description,
  agencyName,
  badge = "Enterprise Portal",
  action
}: WelcomeBannerProps) {
  return (
    <Card className="relative mb-6 overflow-hidden border-border/80 bg-gradient-to-br from-primary/[0.04] via-background to-accent/20 shadow-subtle">
      <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
      <CardContent className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              <Sparkles className="h-3 w-3" />
              {badge}
            </span>
            {agencyName && (
              <span className="text-xs font-medium text-muted-foreground">
                · {agencyName}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold font-heading tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </CardContent>
    </Card>
  );
}
