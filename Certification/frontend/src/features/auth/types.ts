import { type Role } from "./roles";

/**
 * INTEGRATION BLOCKER (IB-1) — see docs/INTEGRATION_BLOCKERS.md.
 *
 * The current backend /api/auth/me response may expose only an *internal
 * numeric* agency id. The frontend REQUIRES the backend to return, per
 * agency membership (via /api/auth/me or /api/me/agencies):
 *
 *   - `uuid` (public, URL-safe)   — required for any agency-scoped URL
 *   - `slug` (public, URL-safe)   — preferred for URLs when present
 *   - `name` (display name)       — required for the agency selector
 *   - `role` (user's role within the agency)
 *
 * Until the backend provides this, `publicId` resolves to `null` and any
 * agency-scoped screen renders an explicit integration blocker instead of
 * building a URL from the internal numeric id. The frontend NEVER places an
 * internal numeric agency id in a URL.
 */
export interface AgencyMembership {
  /** Internal numeric id, if the backend still exposes one. NEVER used in URLs. */
  id?: number;
  /** Public UUID. Preferred stable public identifier. */
  uuid?: string;
  /** Public slug. Preferred for human-readable URLs. */
  slug?: string;
  name: string;
  role: Role;
}

export interface CurrentUser {
  id: string | number;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  roles: Role[];
  is_active?: boolean;
  agencies?: AgencyMembership[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
  confirm_password?: string;
}

export interface AcceptInvitationRequest {
  token: string;
  /** Present when the invitee is creating a new account. */
  password?: string;
  first_name?: string;
  last_name?: string;
}

export type InvitationAcceptanceOutcome =
  | { kind: "account_created"; user: CurrentUser }
  | { kind: "existing_account"; email?: string; message: string };

export function displayName(user: CurrentUser | null): string {
  if (!user) return "";
  if (user.full_name) return user.full_name;
  const joined = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return joined || user.email;
}

/**
 * Resolves a URL-safe public identifier for an agency. Returns null when the
 * backend has not yet supplied one (see IB-1) — callers must render the
 * integration blocker in that case, never fall back to a numeric id.
 */
export function agencyPublicId(membership: AgencyMembership): string | null {
  return membership.slug ?? membership.uuid ?? null;
}
