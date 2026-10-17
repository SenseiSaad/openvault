"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./empty-state";
import { ApiError } from "@/lib/api/error";
import { cn } from "@/lib/utils";

interface DataTableProps<T> {
  /** Query state the table renders. */
  data: { items: T[] | undefined; total?: number; page?: number; pages?: number } | undefined;
  isLoading: boolean;
  error?: ApiError | Error | null;
  /** Column definition per row. */
  columns: { id: string; header: React.ReactNode; className?: string; render: (row: T) => React.ReactNode }[];
  /** Accessible caption for the table element. */
  caption: string;
  emptyTitle: string;
  emptyDescription?: string;
  /** Enable the URL-synced search input (debounced, `?q=`). */
  searchable?: boolean;
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
  /** Stable row identity. */
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}

/**
 * Management table with URL-query-driven pagination and search
 * (`?page=&q=`), so any filtered view is linkable and restores on refresh.
 * The query itself lives in the feature hook; this component only syncs the
 * URL params.
 */
export function DataTable<T>({
  data,
  isLoading,
  error,
  columns,
  caption,
  emptyTitle,
  emptyDescription,
  searchable,
  searchPlaceholder = "Search…",
  toolbar,
  rowKey,
  onRowClick
}: DataTableProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1");
  const [searchDraft, setSearchDraft] = useState(searchParams.get("q") ?? "");

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: true });
    },
    [router, pathname, searchParams]
  );

  // Debounced search -> ?q=
  useEffect(() => {
    if (!searchable) return;
    const current = searchParams.get("q") ?? "";
    if (searchDraft === current) return;
    const handle = setTimeout(() => pushParams({ q: searchDraft || null, page: null }), 400);
    return () => clearTimeout(handle);
  }, [searchDraft, searchable, searchParams, pushParams]);

  const pages = data?.pages ?? 1;
  const total = data?.total ?? 0;
  const items = data?.items;

  const colSpan = columns.length + 1;

  return (
    <div className="space-y-3">
      {(searchable || toolbar) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {searchable ? (
            <div className="relative w-full max-w-sm">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="pl-9"
              />
            </div>
          ) : (
            <div />
          )}
          {toolbar}
        </div>
      )}

      {error ? (
        <EmptyState
          title="Could not load this list"
          description={error instanceof ApiError ? error.message : "An unexpected error occurred. Please try again."}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-card">
          <Table>
            <caption className="sr-only">{caption}</caption>
            <TableHeader className="bg-secondary/40">
              <TableRow className="border-b border-border/80 hover:bg-transparent">
                {columns.map((column) => (
                  <TableHead key={column.id} className={cn("text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3.5", column.className)}>
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, rowIndex) => (
                  <TableRow key={`skeleton-${rowIndex}`} className="border-b border-border/60">
                    {columns.map((column) => (
                      <TableCell key={column.id} className="py-3.5">
                        <Skeleton className="h-5 w-full max-w-40" />
                      </TableCell>
                    ))}
                    <TableCell className="py-3.5">
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                  </TableRow>
                ))}

              {!isLoading && (!items || items.length === 0) && (
                <TableRow>
                  <TableCell colSpan={colSpan} className="py-12">
                    <EmptyState title={emptyTitle} description={emptyDescription} />
                  </TableCell>
                </TableRow>
              )}

              {!isLoading &&
                items?.map((row) => (
                  <TableRow
                    key={rowKey(row)}
                    className={cn(
                      "border-b border-border/50 transition-colors hover:bg-accent/40",
                      onRowClick && "cursor-pointer"
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((column) => (
                      <TableCell key={column.id} className="py-3.5 text-sm">{column.render(row)}</TableCell>
                    ))}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!error && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground pt-1">
          <p aria-live="polite" className="font-medium">
            {total > 0 ? (
              <>
                Showing <span className="font-semibold text-foreground">{items?.length ?? 0}</span> of{" "}
                <span className="font-semibold text-foreground">{total}</span> record{total === 1 ? "" : "s"} · Page{" "}
                <span className="font-semibold text-foreground">{page}</span> of {pages}
              </>
            ) : (
              "No records found"
            )}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => pushParams({ page: String(page - 1) })}
              className="h-8 gap-1 text-xs"
            >
              <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages || isLoading}
              onClick={() => pushParams({ page: String(page + 1) })}
              className="h-8 gap-1 text-xs"
            >
              Next <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Shared helper: parse standard list params from a URLSearchParams. */
export function useListParams() {
  const searchParams = useSearchParams();
  return useMemo(
    () => ({
      page: Math.max(1, Number(searchParams.get("page") ?? "1") || 1),
      pageSize: 20,
      q: searchParams.get("q") ?? undefined
    }),
    [searchParams]
  );
}
