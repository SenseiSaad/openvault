import { AlertTriangle, CheckCircle2, Clock, XCircle, Ban, Circle, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { humanizeEnum } from "@/lib/utils";

/**
 * Maps backend status enums to a semantic badge. Each state pairs a distinct
 * icon with its color so status is never communicated by color alone.
 */
const STATUS_MAP: Record<string, { variant: "success" | "warning" | "destructive" | "info" | "neutral"; Icon: typeof Circle }> = {
  active: { variant: "success", Icon: CheckCircle2 },
  completed: { variant: "success", Icon: CheckCircle2 },
  accepted: { variant: "success", Icon: CheckCircle2 },
  paid: { variant: "success", Icon: CheckCircle2 },
  delivered: { variant: "success", Icon: CheckCircle2 },
  published: { variant: "success", Icon: CheckCircle2 },
  assigned: { variant: "success", Icon: CheckCircle2 },
  pending: { variant: "warning", Icon: Clock },
  pending_review: { variant: "warning", Icon: Clock },
  draft: { variant: "neutral", Icon: Circle },
  processing: { variant: "info", Icon: Clock },
  in_progress: { variant: "info", Icon: Clock },
  suspended: { variant: "destructive", Icon: Ban },
  inactive: { variant: "neutral", Icon: Circle },
  expired: { variant: "destructive", Icon: XCircle },
  failed: { variant: "destructive", Icon: XCircle },
  declined: { variant: "destructive", Icon: XCircle },
  cancelled: { variant: "destructive", Icon: XCircle },
  revoked: { variant: "destructive", Icon: Ban },
  refunded: { variant: "warning", Icon: AlertTriangle }
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-sm text-muted-foreground">—</span>;
  const key = status.toLowerCase();
  const config = STATUS_MAP[key] ?? { variant: "neutral" as const, Icon: HelpCircle };
  return (
    <Badge variant={config.variant}>
      <config.Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {humanizeEnum(status)}
    </Badge>
  );
}
