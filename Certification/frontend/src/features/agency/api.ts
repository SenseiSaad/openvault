import { api } from "@/lib/api/client";
import { agencyPublicId, type AgencyMembership } from "@/features/auth/types";
import { useSession } from "@/features/auth/session-context";
import { useAgency } from "@/features/auth/agency-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ListQuery, Paginated } from "@/lib/api/types";

/**
 * Agency administration API.
 *
 * INTEGRATION-UNVERIFIED (IB-2): the backend is not currently inspectable.
 * Route paths and response fields below follow the documented contract list
 * ("agency, member, invitation, order, entitlement, seat, billing endpoints
 * under /api") and MUST be verified before this portal is marked complete.
 * All agency scoping uses PUBLIC ids only (slug/uuid) — never internal ids.
 */

export interface AgencyMember {
  uuid?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  role: string;
  status: string;
  joined_at?: string;
  agency_role?: string;
}

export interface AgencyInvitation {
  uuid: string;
  email: string;
  role: string;
  status: string;
  invited_at?: string;
  expires_at?: string;
}

export interface AgencyEntitlement {
  uuid: string;
  product?: { uuid?: string; slug?: string; name: string };
  seats_total: number;
  seats_assigned: number;
  status: string;
  expires_at?: string;
}

export interface SeatAssignment {
  uuid: string;
  entitlement?: AgencyEntitlement;
  learner?: { email: string; first_name?: string; last_name?: string };
  assigned_at?: string;
  status: string;
}

export interface AgencyOrder {
  uuid: string;
  number?: string;
  status: string;
  total_cents?: number;
  created_at?: string;
  items?: { product?: { name: string }; quantity: number; unit_price_cents?: number }[];
}

export interface BillingInfo {
  subscription_status?: string;
  renews_at?: string;
  billing_portal_url?: string;
  payment_method?: string;
}

/** Store product as sold to agencies (catalogue + checkout). */
export interface StoreProduct {
  uuid: string;
  slug?: string;
  name: string;
  description?: string;
  price_cents?: number;
  status?: string;
}

const memberName = (member: { first_name?: string; last_name?: string; email: string }) =>
  [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email;

export { memberName };

export function useActiveAgencyId(): string | null {
  const { status } = useSession();
  const { activeAgencyPublicId } = useAgency();
  return status === "authenticated" ? activeAgencyPublicId : null;
}

export const agencyKeys = {
  members: (agencyId: string | null, query: ListQuery) => ["agency", agencyId, "members", query] as const,
  invitations: (agencyId: string | null, status: string) => ["agency", agencyId, "invitations", status] as const,
  entitlements: (agencyId: string | null) => ["agency", agencyId, "entitlements"] as const,
  seats: (agencyId: string | null) => ["agency", agencyId, "seats"] as const,
  orders: (agencyId: string | null, query: ListQuery) => ["agency", agencyId, "orders", query] as const,
  order: (uuid: string) => ["agency", "orders", uuid] as const,
  billing: (agencyId: string | null) => ["agency", agencyId, "billing"] as const,
  overview: (agencyId: string | null) => ["agency", agencyId, "overview"] as const
};

export const agencyApi = {
  overview(agencyId: string): Promise<{ members?: number; pending_invitations?: number; seats_available?: number; recent_orders?: number }> {
    return api.get(`/api/agencies/${agencyId}/overview`);
  },
  members(agencyId: string, query: ListQuery): Promise<Paginated<AgencyMember>> {
    return api.get(`/api/agencies/${agencyId}/members`, { query });
  },
  updateMember(agencyId: string, memberUuid: string, payload: { role?: string; status?: string }): Promise<void> {
    return api.patch(`/api/agencies/${agencyId}/members/${memberUuid}`, payload);
  },
  invitations(agencyId: string, status?: string): Promise<{ items?: AgencyInvitation[] }> {
    return api.get(`/api/agencies/${agencyId}/invitations`, { query: { status } });
  },
  invite(agencyId: string, payload: { email: string; first_name?: string; last_name?: string; role: string }): Promise<void> {
    return api.post(`/api/agencies/${agencyId}/invitations`, payload);
  },
  revokeInvitation(agencyId: string, invitationUuid: string): Promise<void> {
    return api.post(`/api/agencies/${agencyId}/invitations/${invitationUuid}/revoke`);
  },
  entitlements(agencyId: string): Promise<{ items?: AgencyEntitlement[] }> {
    return api.get(`/api/agencies/${agencyId}/entitlements`);
  },
  seats(agencyId: string): Promise<{ items?: SeatAssignment[] }> {
    return api.get(`/api/agencies/${agencyId}/seats`);
  },
  releaseSeat(seatUuid: string): Promise<void> {
    return api.post(`/api/seats/${seatUuid}/release`);
  },
  reassignSeat(seatUuid: string, memberUuid: string): Promise<void> {
    return api.post(`/api/seats/${seatUuid}/assign`, { member_uuid: memberUuid });
  },
  orders(agencyId: string, query: ListQuery): Promise<Paginated<AgencyOrder>> {
    return api.get(`/api/agencies/${agencyId}/orders`, { query });
  },
  order(orderUuid: string): Promise<AgencyOrder> {
    return api.get(`/api/orders/${orderUuid}`);
  },
  billing(agencyId: string): Promise<BillingInfo> {
    return api.get(`/api/agencies/${agencyId}/billing`);
  },

  /**
   * Checkout (IB-3, INTEGRATION-UNVERIFIED): store product detail and order
   * creation. The catalogue LIST route (GET /api/store/products) is verified;
   * the single-product and POST /api/orders variants follow the documented
   * contract and must be confirmed before checkout is enabled by flag.
   * The public product id (uuid/slug) is passed through — never an internal id.
   */
  storeProduct(productPublicId: string, signal?: AbortSignal): Promise<StoreProduct> {
    return api.get(`/api/store/products/${productPublicId}`, { signal });
  },
  createOrder(payload: { product_uuid: string; quantity: number }): Promise<AgencyOrder> {
    return api.post("/api/orders", payload);
  }
};

/** Convenience: current agency public id + whether it is URL-safe. */
export function useAgencyScope() {
  const { status } = useSession();
  const { activeAgency, activeAgencyPublicId, missingPublicId } = useAgency();
  return { enabled: status === "authenticated", agency: activeAgency, agencyId: activeAgencyPublicId, missingPublicId };
}

export function agencyName(membership: AgencyMembership | null): string {
  return membership ? agencyPublicId(membership) ?? membership.name : "";
}

export function useAgencyOverview() {
  const { agencyId, enabled } = useAgencyScope();
  return useQuery({
    queryKey: agencyKeys.overview(agencyId),
    queryFn: () => agencyApi.overview(agencyId as string),
    enabled: enabled && Boolean(agencyId)
  });
}

export function useAgencyMembers(query: ListQuery) {
  const { agencyId, enabled } = useAgencyScope();
  return useQuery({
    queryKey: agencyKeys.members(agencyId, query),
    queryFn: () => agencyApi.members(agencyId as string, query),
    enabled: enabled && Boolean(agencyId)
  });
}

export function useUpdateMember() {
  const { agencyId } = useAgencyScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { memberUuid: string; role?: string; status?: string }) =>
      agencyApi.updateMember(agencyId as string, payload.memberUuid, { role: payload.role, status: payload.status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agency", agencyId, "members"] });
    }
  });
}
