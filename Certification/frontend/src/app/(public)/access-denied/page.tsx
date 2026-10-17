"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Authenticated-but-unauthorized landing. Backed by backend 403s — the
 * frontend never decides authorization, it only communicates it.
 */
export default function AccessDeniedPage() {
  const router = useRouter();
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 rounded-full bg-warning/10 p-4 text-warning" aria-hidden="true">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Access denied</h1>
        <p className="mt-2 text-muted-foreground">
          Your account does not have permission to view this area. This attempt has been logged by the platform. If you
          believe you should have access, contact your agency administrator.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => router.back()} variant="outline">
            Go back
          </Button>
          <Button asChild>
            <Link href="/">Return home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
