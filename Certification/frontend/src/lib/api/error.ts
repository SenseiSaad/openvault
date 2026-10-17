/**
 * Normalized API error. The client guarantees that `message` is always safe
 * to render: raw backend/stack/database messages are never surfaced to the
 * UI — see `safeMessageForStatus`.
 */
export type ApiErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "validation"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "csrf"
  | "network"
  | "server"
  | "unknown";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  /** Per-field validation errors when the backend returned a structured payload. */
  readonly fieldErrors: Record<string, string>;
  readonly requestId?: string;

  constructor(params: {
    status: number;
    code: ApiErrorCode;
    message: string;
    fieldErrors?: Record<string, string>;
    requestId?: string;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.code = params.code;
    this.fieldErrors = params.fieldErrors ?? {};
    this.requestId = params.requestId;
  }

  get isUnauthenticated() {
    return this.code === "unauthenticated";
  }

  get isForbidden() {
    return this.code === "forbidden";
  }
}

/** User-facing fallback copy per status — intentionally generic and calm. */
export function safeMessageForStatus(status: number): string {
  switch (status) {
    case 400:
      return "The request could not be completed. Please review the form and try again.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You do not have permission to perform this action.";
    case 404:
      return "The requested item could not be found.";
    case 409:
      return "This change conflicts with the current state. Please refresh and try again.";
    case 422:
      return "Some of the submitted information is invalid. Please review the form.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    default:
      return status >= 500
        ? "The service is temporarily unavailable. Please try again shortly."
        : "Something went wrong. Please try again.";
  }
}
