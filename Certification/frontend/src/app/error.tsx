"use client";

import { Button } from "@/components/ui/button";

/** Route-level error recovery screen (Next.js App Router convention). */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">
        An unexpected error occurred while displaying this page. Your session and data are unaffected.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <a href="/">Return home</a>
        </Button>
      </div>
    </div>
  );
}
