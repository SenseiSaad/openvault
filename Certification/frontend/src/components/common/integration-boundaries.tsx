import { AlertTriangle, FlaskConical } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Explicit integration boundary for backend capabilities that do not exist
 * yet. Flagged features render this instead of pretending to work. No mock
 * data is ever shown behind it.
 */
export function IntegrationPending({
  feature,
  backendRequirement
}: {
  feature: string;
  backendRequirement: string;
}) {
  return (
    <Alert variant="info">
      <FlaskConical aria-hidden="true" className="h-4 w-4" />
      <AlertTitle>{feature} — integration pending</AlertTitle>
      <AlertDescription>
        This capability is designed and scaffolded in the frontend but is not enabled because the required backend API
        is not yet available. Nothing on this screen uses simulated data.
        <br />
        <span className="mt-2 block text-xs">
          <strong>Backend requirement:</strong> {backendRequirement}
        </span>
      </AlertDescription>
    </Alert>
  );
}

/** Rendered when the backend exposes only an internal numeric id where a public id is required (IB-1). */
export function PublicIdBlocker() {
  return (
    <Alert variant="warning">
      <AlertTriangle aria-hidden="true" className="h-4 w-4" />
      <AlertTitle>Backend integration required</AlertTitle>
      <AlertDescription>
        The backend response for your agency currently contains only an internal record identifier. Public, URL-safe
        agency identifiers (UUID or slug) are required before this screen can be enabled. See
        docs/INTEGRATION_BLOCKERS.md (IB-1).
      </AlertDescription>
    </Alert>
  );
}
