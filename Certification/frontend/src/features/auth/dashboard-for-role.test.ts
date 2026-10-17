import { describe, expect, it } from "vitest";
import { dashboardForRole, ROLE_DASHBOARDS } from "./dashboard-for-role";

describe("dashboardForRole", () => {
  it("routes each role to its own dashboard", () => {
    expect(dashboardForRole(["learner"])).toBe("/learner");
    expect(dashboardForRole(["agency_admin"])).toBe("/agency");
    expect(dashboardForRole(["training_manager"])).toBe("/platform");
    expect(dashboardForRole(["super_admin"])).toBe("/platform");
  });

  it("prefers the highest-privilege role when several are present", () => {
    expect(dashboardForRole(["learner", "agency_admin"])).toBe("/agency");
    expect(dashboardForRole(["agency_admin", "super_admin"])).toBe("/platform");
    expect(dashboardForRole(["learner", "training_manager"])).toBe("/platform");
  });

  it("falls back to the learner dashboard for an empty role list", () => {
    expect(dashboardForRole([])).toBe(ROLE_DASHBOARDS.learner);
  });
});