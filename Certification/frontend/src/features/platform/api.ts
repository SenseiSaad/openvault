import { api } from "@/lib/api/client";
import type { ListQuery, Paginated } from "@/lib/api/types";

/**
 * Platform administration API — super_admin only.
 * INTEGRATION-UNVERIFIED (IB-5): platform endpoints are not inspectable yet;
 * every call below must be verified against the real backend before this
 * portal is treated as complete. See docs/INTEGRATION_BLOCKERS.md.
 */

export interface PlatformAgency {
  uuid: string;
  slug?: string;
  name: string;
  status: string;
  member_count?: number;
  seats_used?: number;
  created_at?: string;
}

export interface PlatformCourse {
  uuid: string;
  slug?: string;
  title: string;
  status: string;
  current_version?: string;
  updated_at?: string;
}

export interface CourseVersion {
  uuid: string;
  version_label: string;
  status: string;
  created_at?: string;
  modules?: { uuid: string; title: string; lessons?: { uuid: string; title: string }[] }[];
}

export interface PlatformProduct {
  uuid: string;
  slug?: string;
  name: string;
  description?: string;
  price_cents?: number;
  status: string;
}

export interface PlatformEntitlement {
  uuid: string;
  agency?: { uuid?: string; name: string };
  product?: { uuid?: string; name: string };
  seats_granted: number;
  seats_used?: number;
  status: string;
}

export interface PlatformStats {
  agencies_total?: number;
  agencies_active?: number;
  courses_published?: number;
  products_total?: number;
}

export const platformApi = {
  stats(): Promise<PlatformStats> {
    return api.get("/api/platform/stats");
  },
  agencies(query: ListQuery): Promise<Paginated<PlatformAgency>> {
    return api.get("/api/platform/agencies", { query });
  },
  agency(agencyUuid: string): Promise<PlatformAgency> {
    return api.get(`/api/platform/agencies/${agencyUuid}`);
  },
  setAgencyStatus(agencyUuid: string, status: string): Promise<void> {
    return api.patch(`/api/platform/agencies/${agencyUuid}`, { status });
  },
  courses(query: ListQuery): Promise<Paginated<PlatformCourse>> {
    return api.get("/api/platform/courses", { query });
  },
  versions(courseUuid: string): Promise<{ items?: CourseVersion[] }> {
    return api.get(`/api/platform/courses/${courseUuid}/versions`);
  },
  createVersion(courseUuid: string, payload: { version_label: string }): Promise<void> {
    return api.post(`/api/platform/courses/${courseUuid}/versions`, payload);
  },
  publishVersion(versionUuid: string): Promise<void> {
    return api.post(`/api/platform/course-versions/${versionUuid}/publish`);
  },
  products(query: ListQuery): Promise<Paginated<PlatformProduct>> {
    return api.get("/api/platform/products", { query });
  },
  updateProduct(productUuid: string, payload: { price_cents?: number; status?: string }): Promise<void> {
    return api.patch(`/api/platform/products/${productUuid}`, payload);
  },
  entitlements(query: ListQuery): Promise<Paginated<PlatformEntitlement>> {
    return api.get("/api/platform/entitlements", { query });
  },
  updateEntitlement(entitlementUuid: string, payload: { seats_granted?: number; status?: string }): Promise<void> {
    return api.patch(`/api/platform/entitlements/${entitlementUuid}`, payload);
  }
};
