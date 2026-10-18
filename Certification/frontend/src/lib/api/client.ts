import { ApiError, safeMessageForStatus, type ApiErrorCode } from "./error";
import type { ApiErrorBody } from "./types";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

interface RequestContext {
  method: Method;
  path: string;
  options: RequestOptions;
  requestId: string;
}

export type UnauthenticatedListener = () => void;

const MUTATING: ReadonlySet<Method> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Single centralized API client.
 *
 * Security model (see README > Authentication):
 * - The backend session is an opaque HttpOnly cookie; this client never
 *   reads, stores or transmits tokens from web storage.
 * - Every request sends `credentials: "include"` so the session cookie and
 *   CSRF cookie flow automatically.
 * - Mutating requests attach the `X-CSRF-Token` header, obtained lazily from
 *   GET /api/auth/csrf and cached in memory only.
 * - 401 => unauthenticated (listeners fire, e.g. redirect to session-expired).
 *   403 => authenticated but unauthorized (never treated as logged out).
 * - Mutations are never retried automatically. Callers decide on query-level
 *   retry for safe (idempotent GET) requests only.
 */
export class ApiClient {
  private csrfToken: string | null = null;
  private csrfFetch: Promise<string | null> | null = null;
  private unauthenticatedListeners = new Set<UnauthenticatedListener>();

  constructor(private readonly baseUrl: string) {}

  onUnauthenticated(listener: UnauthenticatedListener): () => void {
    this.unauthenticatedListeners.add(listener);
    return () => this.unauthenticatedListeners.delete(listener);
  }

  private notifyUnauthenticated() {
    this.unauthenticatedListeners.forEach((listener) => listener());
  }

  private buildUrl(path: string, query?: RequestOptions["query"]): string {
    const url = `${this.baseUrl}${path}`;
    if (!query) return url;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  }

  private async fetchCsrfToken(): Promise<string | null> {
    if (!this.csrfFetch) {
      this.csrfFetch = (async () => {
        try {
          const response = await fetch(this.buildUrl("/api/auth/csrf"), {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" }
          });
          if (!response.ok) return null;
          const body = (await response.json()) as { csrf_token?: string; csrfToken?: string };
          const token = body.csrf_token ?? body.csrfToken ?? null;
          this.csrfToken = token;
          return token;
        } catch {
          return null;
        } finally {
          this.csrfFetch = null;
        }
      })();
    }
    return this.csrfFetch;
  }

  private async parseBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return null;
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  /** Extracts only safe, structured information from an error payload. */
  private normalizeError(status: number, body: unknown, requestId: string): ApiError {
    const parsed = (body ?? {}) as ApiErrorBody;
    const code: ApiErrorCode =
      status === 401
        ? "unauthenticated"
        : status === 403
          ? "forbidden"
          : status === 404
            ? "not_found"
            : status === 409
              ? "conflict"
              : status === 429
                ? "rate_limited"
                : status >= 500
                  ? "server"
                  : "validation";

    const fieldErrors: Record<string, string> = {};
    if (parsed.errors && typeof parsed.errors === "object") {
      for (const [field, messages] of Object.entries(parsed.errors)) {
        const message = Array.isArray(messages) ? messages[0] : messages;
        if (typeof message === "string") fieldErrors[field] = message;
      }
    }

    // Backend messages are trusted only for 4xx validation-style payloads; a
    // database or stack message on a 5xx is never shown.
    const backendMessage =
      status < 500
        ? typeof parsed.detail === "string"
          ? parsed.detail
          : typeof parsed.message === "string"
            ? parsed.message
            : undefined
        : undefined;
    const hasFieldErrors = Object.keys(fieldErrors).length > 0 && status < 500;
    const safeMessage = hasFieldErrors
      ? "Please review the highlighted fields."
      : (backendMessage ?? safeMessageForStatus(status));

    return new ApiError({
      status,
      code,
      message: safeMessage,
      fieldErrors,
      requestId: parsed.request_id ?? requestId
    });
  }

  private async request<T>(method: Method, path: string, options: RequestOptions = {}, body?: unknown, retryWithoutCsrf = false): Promise<T> {
    const requestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Request-Id": requestId,
      ...options.headers
    };

    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (MUTATING.has(method)) {
      const token = retryWithoutCsrf ? await this.fetchCsrfToken() : (this.csrfToken ?? (await this.fetchCsrfToken()));
      if (token) headers["X-CSRF-Token"] = token;
    }

    let response: Response;
    try {
      response = await fetch(this.buildUrl(path, options.query), {
        method,
        credentials: "include",
        // Authenticated API responses must never be served from the HTTP cache: a 304 has
        // no body and would surface as a failed request to the UI.
        cache: "no-store",
        headers,
        signal: options.signal,
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new ApiError({ status: 0, code: "network", message: safeMessageForStatus(500), requestId });
    }

    if (response.status === 401 && MUTATING.has(method) && !retryWithoutCsrf) {
      // A rejected CSRF token surfaces as 401/403 on some backends; retry
      // exactly once with a freshly fetched token.
      this.csrfToken = null;
      const fresh = await this.fetchCsrfToken();
      if (fresh) {
        return this.request<T>(method, path, options, body, true);
      }
    }

    const responseBody = await this.parseBody(response);

    if (!response.ok) {
      // The session probe on a public page is expected to 401 for anonymous visitors, and a
      // failed login is a form error. Neither means "the session expired", so they must not
      // trigger the global session-expired redirect.
      const expectedAuthProbe =
        path === "/api/auth/me" || path === "/api/auth/login" || path === "/api/auth/csrf";
      if (response.status === 401 && !expectedAuthProbe) this.notifyUnauthenticated();
      throw this.normalizeError(response.status, responseBody, requestId);
    }

    return (responseBody ?? (undefined as unknown)) as T;
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("GET", path, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>("POST", path, options, body);
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>("PUT", path, options, body);
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>("PATCH", path, options, body);
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("DELETE", path, options);
  }
}

import { env } from "@/config/env";

export const api = new ApiClient(env.apiBaseUrl);
export { ApiError };
