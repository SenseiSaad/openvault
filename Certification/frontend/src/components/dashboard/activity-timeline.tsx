"use client";

import React from "react";
import { CheckCircle2, Clock, ShieldCheck, UserCheck, AlertCircle, LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  icon?: LucideIcon;
  type?: "success" | "info" | "warning";
}

interface ActivityTimelineProps {
  title?: string;
  items: ActivityItem[];
  emptyMessage?: string;
  className?: string;
}

export function ActivityTimeline({
  title = "Recent System Activity",
  items,
  emptyMessage = "No recent activity recorded.",
  className
}: ActivityTimelineProps) {
  const typeIcons: Record<string, { icon: LucideIcon; color: string }> = {
    success: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
    info: { icon: UserCheck, color: "text-primary bg-primary/10" },
    warning: { icon: AlertCircle, color: "text-amber-600 bg-amber-50" }
  };

  return (
    <Card className={cn("border-border/80 shadow-card", className)}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <Clock className="h-3 w-3" /> Live Audit Feed
        </span>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="relative space-y-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-[1px] before:bg-border/80">
            {items.map((item) => {
              const typeConfig = typeIcons[item.type ?? "info"] ?? typeIcons.info!;
              const Icon = item.icon ?? typeConfig.icon;

              return (
                <div key={item.id} className="relative flex items-start gap-3 pl-1">
                  <div
                    className={cn(
                      "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-card",
                      typeConfig.color
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {item.title}
                      </p>
                      <time className="shrink-0 text-[11px] text-muted-foreground">
                        {item.timestamp}
                      </time>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
