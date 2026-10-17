"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface QuickActionItem {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

interface QuickActionsProps {
  title?: string;
  items: QuickActionItem[];
  className?: string;
}

export function QuickActions({
  title = "Quick Operations",
  items,
  className
}: QuickActionsProps) {
  return (
    <Card className={cn("border-border/80 shadow-card", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-start gap-3 rounded-lg border border-border/70 p-3.5 transition-all duration-150 hover:border-primary/40 hover:bg-accent/40 hover:shadow-subtle"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-150">
              <item.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                  {item.title}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-150" />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                {item.description}
              </p>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
