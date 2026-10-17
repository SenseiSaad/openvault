"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, Clock, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { cn } from "@/lib/utils";

interface CourseCardProps {
  id: string;
  title: string;
  description?: string;
  category?: string;
  duration?: string;
  progressPercent?: number;
  status?: string;
  dueAt?: string;
  href: string;
  isMandatory?: boolean;
}

export function CourseCard({
  id,
  title,
  description,
  category = "Certified Training",
  duration,
  progressPercent = 0,
  status,
  dueAt,
  href,
  isMandatory = false
}: CourseCardProps) {
  const isCompleted = progressPercent >= 100 || status === "completed";

  return (
    <Card className="group flex h-full flex-col overflow-hidden border-border/80 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
      {/* Decorative Top Accent Banner */}
      <div className="relative h-28 w-full bg-gradient-to-br from-primary/90 via-primary to-indigo-900 p-4 text-white overflow-hidden">
        <div className="absolute right-0 top-0 -mr-6 -mt-6 h-28 w-28 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex items-start justify-between">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide backdrop-blur-md">
            <BookOpen className="h-3 w-3" />
            {category}
          </span>

          {isMandatory && (
            <span className="rounded-full bg-amber-400/90 text-amber-950 px-2 py-0.5 text-[10px] font-bold">
              Mandatory
            </span>
          )}
        </div>

        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-white/80">
          {duration && (
            <span className="flex items-center gap-1 text-[11px]">
              <Clock className="h-3 w-3" /> {duration}
            </span>
          )}
          {dueAt && (
            <span className="text-[11px] font-medium text-amber-200">
              Due: {dueAt}
            </span>
          )}
        </div>
      </div>

      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading font-semibold text-base leading-snug tracking-tight text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}
      </CardHeader>

      <CardContent className="mt-auto p-4 pt-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">
              {isCompleted ? "Completed" : "Progress"}
            </span>
            <span className="font-bold tabular-nums text-foreground">
              {progressPercent}%
            </span>
          </div>
          <Progress
            value={progressPercent}
            className="h-2"
            indicatorClassName={cn(
              isCompleted ? "bg-emerald-500" : "bg-primary"
            )}
          />
        </div>
      </CardContent>

      <CardFooter className="border-t border-border/60 p-4 pt-3 flex items-center justify-between">
        {status ? (
          <StatusBadge status={status} />
        ) : (
          <span className="text-xs text-muted-foreground">Enrolled</span>
        )}

        <Button asChild size="sm" variant={isCompleted ? "outline" : "default"}>
          <Link href={href} className="gap-1.5">
            {isCompleted ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Review
              </>
            ) : (
              <>
                Continue <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
