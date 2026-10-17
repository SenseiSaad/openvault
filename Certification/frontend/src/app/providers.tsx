"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { createQueryClient } from "@/lib/query-client";
import { api } from "@/lib/api/client";
import { SessionProvider } from "@/features/auth/session-context";
import { AgencyProvider } from "@/features/auth/agency-context";

/**
 * Global client providers. Order matters:
 *  QueryClient -> Session (/api/auth/me) -> Agency selection -> UI.
 * A single 401 listener redirects to the session-expired screen from anywhere
 * in the app; it never auto-signs the user out on 403.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = api.onUnauthenticated(() => {
      const next = pathname?.startsWith("/") && !pathname.startsWith("//") ? pathname : "/";
      router.replace(`/session-expired?next=${encodeURIComponent(next)}`);
    });
    return unsubscribe;
  }, [router, pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <AgencyProvider>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </AgencyProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
