import { api } from "@/lib/api/client";
import type { Role } from "./roles";
import type {
  AcceptInvitationRequest,
  AgencyMembership,
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
 * The backend returns camelCase fields (userPublicId/firstName/…) plus the public
 * agency list; this module maps them to the frontend's snake_case view model once,
 * so pages never deal with wire-format differences.
 */

interface BackendRoleGrant {
  roleCode: string;
  agencyId: string | null;
}

interface BackendAgency {
  uuid: string;
  slug: string;
  name: string;
  role: string;
}

interface BackendUser {
  userPublicId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: BackendRoleGrant[];
  agencies?: BackendAgency[];
}

export function mapBackendUser(raw: BackendUser): CurrentUser {
  const roles: Role[] = [];
  for (const grant of raw.roles ?? []) {
    const role = grant.roleCode as Role;
    if (!roles.includes(role)) roles.push(role);
  }
  const agencies: AgencyMembership[] = (raw.agencies ?? []).map((agency) => ({
    uuid: agency.uuid,
    slug: agency.slug,
    name: agency.name,
    role: agency.role as Role
  }));
  const fullName = [raw.firstName, raw.lastName].filter(Boolean).join(" ");
  return {
    id: raw.userPublicId,
    email: raw.email,
    first_name: raw.firstName,
    last_name: raw.lastName,
    full_name: fullName || raw.email,
    roles,
    agencies
  };
}

export const authApi = {
  /** GET /api/auth/csrf — obtain a CSRF token (cached in-memory by the client). */
  csrf(): Promise<{ csrf_token?: string; csrfToken?: string }> {
    return api.get("/api/auth/csrf");
  },

  /** GET /api/auth/me — session restoration. 401 => unauthenticated. */
  async me(signal?: AbortSignal): Promise<CurrentUser> {
    const raw = await api.get<{ user: BackendUser }>("/api/auth/me", { signal });
    return mapBackendUser(raw.user);
  },

  /** POST /api/auth/login */
  async login(payload: LoginRequest): Promise<{ user?: CurrentUser }> {
    const raw = await api.post<{ user: BackendUser }>("/api/auth/login", payload);
    return { user: raw.user ? mapBackendUser(raw.user) : undefined };
  },

  /** POST /api/auth/logout */
  logout(): Promise<void> {
    return api.post("/api/auth/logout");
  },

  /** POST /api/auth/password-reset/request — always appears successful. */
  requestPasswordReset(payload: ForgotPasswordRequest): Promise<void> {
    return api.post("/api/auth/password-reset/request", payload);
  },

  /** POST /api/auth/password-reset/confirm (backend names the field `password`). */
  confirmPasswordReset(payload: ResetPasswordRequest): Promise<void> {
    return api.post("/api/auth/password-reset/confirm", {
      token: payload.token,
      password: payload.new_password
    });
  },

  /** POST /api/invitations/accept */
  async acceptInvitation(payload: AcceptInvitationRequest): Promise<InvitationAcceptanceOutcome> {
    const raw = await api.post<{
      signedIn: boolean;
      user?: BackendUser;
      message?: string;
    }>("/api/invitations/accept", {
      token: payload.token,
      password: payload.password,
      firstName: payload.first_name,
      lastName: payload.last_name
    });
    if (raw.signedIn && raw.user) {
      return { kind: "account_created", user: mapBackendUser(raw.user) };
    }
    return {
      kind: "existing_account",
      ...(raw.user?.email ? { email: raw.user.email } : {}),
      message: raw.message ?? "You have been added to the agency. Please sign in."
    };
  }
};
