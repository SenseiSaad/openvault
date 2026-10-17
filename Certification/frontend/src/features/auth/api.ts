import { api } from "@/lib/api/client";
import type {
  AcceptInvitationRequest,
  CurrentUser,
  ForgotPasswordRequest,
  InvitationAcceptanceOutcome,
  LoginRequest,
  ResetPasswordRequest
} from "./types";

/**
 * Authentication API. All calls rely on the opaque HttpOnly session cookie
 * managed by the backend; no token is ever stored client-side.
 *
 * Response shapes below are the documented contract; field presence is
 * defensive (unknown fields are ignored by TypeScript consumers).
 */

export const authApi = {
  /** GET /api/auth/csrf — obtain a CSRF token (cached in-memory by the client). */
  csrf(): Promise<{ csrf_token?: string; csrfToken?: string }> {
    return api.get("/api/auth/csrf");
  },

  /** GET /api/auth/me — session restoration. 401 => unauthenticated. */
  me(signal?: AbortSignal): Promise<CurrentUser> {
    return api.get("/api/auth/me", { signal });
  },

  /** POST /api/auth/login */
  login(payload: LoginRequest): Promise<{ user?: CurrentUser }> {
    return api.post("/api/auth/login", payload);
  },

  /** POST /api/auth/logout */
  logout(): Promise<void> {
    return api.post("/api/auth/logout");
  },

  /** POST /api/auth/password-reset/request — always appears successful. */
  requestPasswordReset(payload: ForgotPasswordRequest): Promise<void> {
    return api.post("/api/auth/password-reset/request", payload);
  },

  /** POST /api/auth/password-reset/confirm */
  confirmPasswordReset(payload: ResetPasswordRequest): Promise<void> {
    return api.post("/api/auth/password-reset/confirm", payload);
  },

  /** POST /api/invitations/accept */
  acceptInvitation(payload: AcceptInvitationRequest): Promise<InvitationAcceptanceOutcome> {
    return api.post("/api/invitations/accept", payload);
  }
};
