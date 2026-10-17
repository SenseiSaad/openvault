"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "./api";
import { type CurrentUser } from "./types";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface SessionContextValue {
  user: CurrentUser | null;
  status: SessionStatus;
  /** Forces a refetch of /api/auth/me. */
  refresh: () => Promise<void>;
  /** Calls the backend logout endpoint and clears session state. */
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Holds the authenticated user. On mount it calls GET /api/auth/me exactly
 * once (session restoration after refresh). A 401 means unauthenticated; a
 * 403 means authenticated-but-unauthorized and is NOT treated as a logout.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: ({ signal }) => authApi.me(signal),
    // The session is the source of truth for the lifetime of the tab;
    // it is refreshed explicitly (after login/logout) or on the next load.
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    await queryClient.refetchQueries({ queryKey: ["auth", "me"] });
  }, [queryClient]);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      queryClient.setQueryData(["auth", "me"], null);
      await queryClient.invalidateQueries();
    }
  }, [queryClient]);

  const value = useMemo<SessionContextValue>(() => {
    const status: SessionStatus = meQuery.isPending ? "loading" : meQuery.data ? "authenticated" : "unauthenticated";
    return {
      user: status === "authenticated" ? (meQuery.data as CurrentUser) : null,
      status,
      refresh,
      signOut
    };
  }, [meQuery, refresh, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
