"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSession } from "./session-context";
import { agencyPublicId, type AgencyMembership } from "./types";
import { type Role } from "./roles";

const STORAGE_KEY = "ca.selected-agency";

interface AgencyContextValue {
  /** All agencies the signed-in user belongs to. */
  memberships: AgencyMembership[];
  /** The currently selected agency, or null when the user has none/one to pick. */
  activeAgency: AgencyMembership | null;
  /** URL-safe public id of the active agency (slug or uuid), or null if unavailable. */
  activeAgencyPublicId: string | null;
  /** True when the active agency lacks a public id — screens must render the blocker. */
  missingPublicId: boolean;
  selectAgency: (publicId: string) => void;
  /** True when the user belongs to more than one agency. */
  needsSelector: boolean;
}

const AgencyContext = createContext<AgencyContextValue | null>(null);

/**
 * Tracks the user's selected agency. The selection is preserved per tab in
 * sessionStorage (never a credential — only the public slug/uuid), and is
 * re-validated against the agencies the backend reports on every session
 * load. A stale or unauthorized selection can never be reused.
 */
export function AgencyProvider({ children }: { children: ReactNode }) {
  const { user, status } = useSession();
  const memberships = useMemo(() => user?.agencies ?? [], [user]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored && memberships.some((m) => agencyPublicId(m) === stored)) {
      setSelected(stored);
    } else if (memberships.length > 0) {
      setSelected(agencyPublicId(memberships[0] as AgencyMembership));
    }
  }, [status, memberships]);

  const selectAgency = (publicId: string) => {
    setSelected(publicId);
    try {
      sessionStorage.setItem(STORAGE_KEY, publicId);
    } catch {
      // storage unavailable (private mode) — selection stays in memory
    }
  };

  const activeAgency = useMemo(
    () => memberships.find((m) => agencyPublicId(m) === selected) ?? null,
    [memberships, selected]
  );

  const value = useMemo<AgencyContextValue>(
    () => ({
      memberships,
      activeAgency,
      activeAgencyPublicId: activeAgency ? agencyPublicId(activeAgency) : null,
      missingPublicId: Boolean(activeAgency && !agencyPublicId(activeAgency)),
      selectAgency,
      needsSelector: memberships.length > 1
    }),
    [memberships, activeAgency]
  );

  return <AgencyContext.Provider value={value}>{children}</AgencyContext.Provider>;
}

export function useAgency(): AgencyContextValue {
  const ctx = useContext(AgencyContext);
  if (!ctx) throw new Error("useAgency must be used within AgencyProvider");
  return ctx;
}

/** Role held by the current user within the active agency (or platform-wide). */
export function useActiveRole(): Role | null {
  const { user } = useSession();
  const { activeAgency } = useAgency();
  if (activeAgency) return activeAgency.role;
  return user?.roles[0] ?? null;
}
