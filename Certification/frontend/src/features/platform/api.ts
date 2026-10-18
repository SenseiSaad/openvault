import { api } from "@/lib/api/client";
import type { ListQuery, Paginated } from "@/lib/api/types";

/**
 * Platform administration API — verified against the real backend
 * (`/api/platform/*`, Super Admin / Training Manager only).
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
  current_version?: number | string | null;
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
  description?: string | null;
  price_cents?: number | null;
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
  enrollments_total?: number;
  revenue_cents?: number;
}

export interface AuditEntry {
  id: string;
  action: string;
  actorType: string;
  subjectType: string;
  subjectPublicId?: string | null;
  agency?: { uuid: string; name: string } | null;
  occurredAt: string;
  metadata?: unknown;
}

export interface PlatformReportOverview {
  revenue_cents: number;
  paid_orders: number;
  agencies: { total: number; active: number };
  entitlements: { active: number; seats_sold: number };
  enrollments: { total: number; completed: number; completion_percent: number | null };
  assessments: { graded: number; passed: number; pass_rate_percent: number | null };
  certificates: { issued: number; revoked: number };
}

export interface CourseCompletion {
  courseTitle: string;
  enrollments: number;
  completed: number;
  completionPercent: number | null;
}

export interface AssessmentPassRate {
  assessmentTitle: string;
  kind: string;
  attempts: number;
  graded: number;
  passed: number;
  passRatePercent: number | null;
  averageScorePercent: number | null;
}

type ListQueryWithQ = ListQuery & { q?: string };

function toListQuery(query: ListQueryWithQ): Record<string, string | number | undefined> {
  return {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 25,
    search: query.q ?? query.search
  };
}

export const platformApi = {
  stats(): Promise<PlatformStats> {
    return api.get("/api/platform/stats");
  },
  async reportsOverview(): Promise<PlatformReportOverview> {
    const raw = await api.get<{
      revenueCents: number;
      paidOrders: number;
      agencies: { total: number; active: number };
      entitlements: { active: number; seatsSold: number };
      enrollments: { total: number; completed: number; completionPercent: number | null };
      assessments: { graded: number; passed: number; passRatePercent: number | null };
      certificates: { issued: number; revoked: number };
    }>("/api/platform/reports/overview");
    return {
      revenue_cents: raw.revenueCents,
      paid_orders: raw.paidOrders,
      agencies: raw.agencies,
      entitlements: { active: raw.entitlements.active, seats_sold: raw.entitlements.seatsSold },
      enrollments: {
        total: raw.enrollments.total,
        completed: raw.enrollments.completed,
        completion_percent: raw.enrollments.completionPercent
      },
      assessments: {
        graded: raw.assessments.graded,
        passed: raw.assessments.passed,
        pass_rate_percent: raw.assessments.passRatePercent
      },
      certificates: raw.certificates
    };
  },
  async reportsCompletions(): Promise<{ items: CourseCompletion[] }> {
    return api.get("/api/platform/reports/completions");
  },
  async reportsAssessments(): Promise<{ items: AssessmentPassRate[] }> {
    return api.get("/api/platform/reports/assessments");
  },
  agencies(query: ListQueryWithQ): Promise<Paginated<PlatformAgency>> {
    return api.get("/api/platform/agencies", { query: toListQuery(query) });
  },
  agency(agencyUuid: string): Promise<PlatformAgency> {
    return api.get(`/api/platform/agencies/${agencyUuid}`);
  },
  setAgencyStatus(agencyUuid: string, status: string): Promise<void> {
    return api.patch(`/api/platform/agencies/${agencyUuid}`, { status });
  },
  courses(query: ListQueryWithQ): Promise<Paginated<PlatformCourse>> {
    return api.get("/api/platform/courses", { query: toListQuery(query) });
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
  products(query: ListQueryWithQ): Promise<Paginated<PlatformProduct>> {
    return api.get("/api/platform/products", { query: toListQuery(query) });
  },
  updateProduct(productUuid: string, payload: { price_cents?: number; status?: string }): Promise<void> {
    return api.patch(`/api/platform/products/${productUuid}`, payload);
  },
  entitlements(query: ListQueryWithQ): Promise<Paginated<PlatformEntitlement>> {
    return api.get("/api/platform/entitlements", { query: toListQuery(query) });
  },
  updateEntitlement(
    entitlementUuid: string,
    payload: { seats_granted?: number; status?: string }
  ): Promise<void> {
    return api.patch(`/api/platform/entitlements/${entitlementUuid}`, payload);
  },
  async auditLog(
    query: ListQueryWithQ & { agencyPublicId?: string; action?: string; from?: string; to?: string }
  ): Promise<Paginated<AuditEntry>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const raw = await api.get<{ items: AuditEntry[]; page: { total: number } }>("/api/platform/audit-log", {
      query: {
        limit: pageSize,
        offset: (page - 1) * pageSize,
        action: query.action ?? query.q,
        agencyPublicId: query.agencyPublicId,
        from: query.from,
        to: query.to
      }
    });
    return {
      items: raw.items,
      total: raw.page.total,
      page,
      page_size: pageSize,
      pages: Math.max(1, Math.ceil(raw.page.total / pageSize))
    };
  }
};
