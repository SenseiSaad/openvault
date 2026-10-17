"use client";

import { ChevronsUpDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useAgency } from "./agency-context";
import { agencyPublicId } from "./types";

/**
 * Agency selector for users who belong to multiple agencies. Shows the
 * active agency and role prominently; the choice persists per tab and is
 * re-validated on every session load.
 */
export function AgencySelector() {
  const { memberships, activeAgency, needsSelector, selectAgency } = useAgency();

  if (memberships.length === 0 || !activeAgency) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="max-w-56 gap-2" aria-label={`Active agency: ${activeAgency.name}. Change agency`}>
          <Building2 aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="truncate text-sm">{activeAgency.name}</span>
          {needsSelector && <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 opacity-50" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Your agencies</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((membership) => {
          const publicId = agencyPublicId(membership);
          if (!publicId) return null;
          return (
            <DropdownMenuCheckboxItem
              key={publicId}
              checked={membership === activeAgency}
              onCheckedChange={() => selectAgency(publicId)}
            >
              <span className="flex flex-col">
                <span className="truncate">{membership.name}</span>
                <span className="text-xs text-muted-foreground">{membership.role}</span>
              </span>
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
