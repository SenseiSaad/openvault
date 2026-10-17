import { Spinner } from "@/components/ui/spinner";

/**
 * Fallback for Suspense boundaries around URL-dependent views.
 * Pages that call useSearchParams() must wrap that subtree (Next 15 static
 * prerender requirement — "missing-suspense-with-csr-bailout").
 */
export function PageSuspenseFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Spinner label="Loading…" />
    </div>
  );
}