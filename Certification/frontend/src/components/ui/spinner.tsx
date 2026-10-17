import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Accessible spinner: announces itself via role="status". */
export function Spinner({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-muted-foreground">
      <Loader2 aria-hidden="true" className={cn("h-5 w-5 animate-spin text-primary", className)} />
      <span className="text-sm">{label}</span>
    </span>
  );
}
