"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { humanizeEnum } from "@/lib/utils";

export function Breadcrumbs() {
  const pathname = usePathname();

  // Strip query and split segments
  const segments = pathname
    .split("?")[0]
    ?.split("/")
    .filter(Boolean) || [];

  if (segments.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
      <Link
        href={`/${segments[0]}`}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        <span className="sr-only">Home</span>
      </Link>

      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join("/")}`;
        const isLast = index === segments.length - 1;
        const formatted = humanizeEnum(segment.replace(/-/g, "_"));

        return (
          <React.Fragment key={href}>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            {isLast ? (
              <span className="font-medium text-foreground tracking-tight" aria-current="page">
                {formatted}
              </span>
            ) : (
              <Link href={href} className="hover:text-foreground transition-colors">
                {formatted}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
