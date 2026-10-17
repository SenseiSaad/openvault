"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Minus, LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CountUp } from "@/components/motion/count-up";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value?: number;
  href?: string;
  icon: LucideIcon;
  isLoading?: boolean;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  description?: string;
  variant?: "indigo" | "emerald" | "amber" | "sky";
}

export function StatCard({
  label,
  value,
  href,
  icon: Icon,
  isLoading = false,
  trend,
  description,
  variant = "indigo"
}: StatCardProps) {
  const iconVariants = {
    indigo: "bg-primary/10 text-primary border-primary/20",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-200",
    amber: "bg-amber-50 text-amber-600 border-amber-200",
    sky: "bg-sky-50 text-sky-600 border-sky-200"
  };

  const cardContent = (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover border-border/80">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:scale-105",
              iconVariants[variant]
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div className="text-3xl font-bold font-heading tabular-nums text-foreground">
            {isLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : value !== undefined ? (
              <CountUp value={value} />
            ) : (
              "—"
            )}
          </div>

          {trend && !isLoading && (
            <div
              className={cn(
                "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
                trend.direction === "up" && "bg-emerald-50 text-emerald-700",
                trend.direction === "down" && "bg-rose-50 text-rose-700",
                trend.direction === "neutral" && "bg-slate-100 text-slate-700"
              )}
            >
              {trend.direction === "up" && <ArrowUpRight className="h-3.5 w-3.5" />}
              {trend.direction === "down" && <ArrowDownRight className="h-3.5 w-3.5" />}
              {trend.direction === "neutral" && <Minus className="h-3.5 w-3.5" />}
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>

        {description && (
          <p className="mt-2 text-xs text-muted-foreground/80 line-clamp-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
