"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, type SessionStatus } from "./session-context";
import { type Role } from "./roles";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Route-level guards. These exist purely for UX: the backend remains the
 * authoritative authorization check, and the frontend treats 401 and 403
 * distinctly (401 = sign in again, 403 = access denied screen).
 */

function safeNext(path: string | null): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { status, user } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(safeNext(pathname))}`);
    }
  }, [status, router, pathname]);

  useEffect(() => {
    if (status === "authenticated" && user && roles && roles.length > 0) {
      const allowed = user.roles.some((role) => roles.includes(role));
      if (!allowed) router.replace("/access-denied");
    }
  }, [status, user, roles, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
        <Spinner label="Loading your session…" />
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  if (roles && roles.length > 0 && user && !user.roles.some((role) => roles.includes(role))) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Full-page "you don't have permission" state. Used by /access-denied and as
 * inline fallback when a fetch returns 403.
 */
export function AccessDenied({ title, message, action }: { title?: string; message?: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-24 text-center">
      <div className="rounded-full bg-warning/10 p-4 text-warning" aria-hidden="true">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{title ?? "Access denied"}</h1>
      <p className="text-muted-foreground">
        {message ??
          "You do not have permission to view this area. If you believe this is a mistake, contact your agency administrator."}
      </p>
      {action ?? (
        <Button asChild variant="outline">
          <a href="/">Return home</a>
        </Button>
      )}
    </div>
  );
}

/** Renders children only while the session status matches — for conditional chrome. */
export function ShowFor({ status, children }: { status: SessionStatus | SessionStatus[]; children: ReactNode }) {
  const { status: current } = useSession();
  const allowed = Array.isArray(status) ? status.includes(current) : current === status;
  return allowed ? <>{children}</> : null;
}
