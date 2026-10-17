/**
 * Product roles, mirroring the backend's role model. Backend authorization is
 * authoritative; role checks here exist only for UX (hiding links, routing).
 */
export const ROLES = ["super_admin", "training_manager", "agency_admin", "learner"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Platform Administrator",
  training_manager: "Training Manager",
  agency_admin: "Agency Administrator",
  learner: "Learner"
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isRoleArray(value: unknown): value is Role[] {
  return Array.isArray(value) && value.every(isRole);
}
