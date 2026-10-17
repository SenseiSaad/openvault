/** Post-login landing route per role — the backend remains authoritative. */
import { type Role } from "./roles";

export const ROLE_DASHBOARDS: Record<Role, string> = {
  super_admin: "/platform",
  training_manager: "/platform",
  agency_admin: "/agency",
  learner: "/learner"
};

export function dashboardForRole(roles: readonly Role[]): string {
  if (roles.includes("super_admin")) return ROLE_DASHBOARDS.super_admin;
  if (roles.includes("agency_admin")) return ROLE_DASHBOARDS.agency_admin;
  if (roles.includes("training_manager")) return ROLE_DASHBOARDS.training_manager;
  return ROLE_DASHBOARDS.learner;
}
