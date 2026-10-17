"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSuspenseFallback } from "@/components/common/page-suspense-fallback";
import { useSession } from "@/features/auth/session-context";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

/** Shown when an API call 401s mid-session. Offers sign-in, preserving intent. */
function SessionExpiredContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const next = safeNext(searchParams.get("next"));

  // If the session is actually still alive (e.g. stale notification), return immediately.
  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, router, next]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Your session has ended</CardTitle>
          <CardDescription>
            For your security, sessions end after a period of inactivity. Any unsaved changes were discarded. Please
            sign in again to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">You will be returned to: {next}</p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in again</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function SessionExpiredPage() {
  return (
    <Suspense fallback={<PageSuspenseFallback />}>
      <SessionExpiredContent />
    </Suspense>
  );
}
