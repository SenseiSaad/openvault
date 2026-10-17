import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccessDenied, RequireAuth } from "./guards";
import { type CurrentUser } from "./types";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  pathname: "/agency/members",
  session: { status: "loading", user: null, refresh: vi.fn(), signOut: vi.fn() } as {
    status: "loading" | "authenticated" | "unauthenticated";
    user: CurrentUser | null;
    refresh: () => Promise<void>;
    signOut: () => Promise<void>;
  }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => mocks.pathname
}));

vi.mock("./session-context", () => ({
  useSession: () => mocks.session
}));

const user: CurrentUser = { id: 1, email: "admin@agency.test", roles: ["agency_admin"] };

describe("RequireAuth", () => {
  beforeEach(() => {
    mocks.replace.mockClear();
    mocks.pathname = "/agency/members";
    mocks.session = { status: "loading", user: null, refresh: vi.fn(), signOut: vi.fn() };
  });

  it("shows a polite loading status while the session is being restored", () => {
    render(<RequireAuth>secret</RequireAuth>);
    // Spinner (role=status) inside the role=status wrapper announces the wait.
    expect(screen.getByText("Loading your session…")).toBeInTheDocument();
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated visitors to /login with a safe next param", () => {
    mocks.session = { status: "unauthenticated", user: null, refresh: vi.fn(), signOut: vi.fn() };
    render(<RequireAuth>secret</RequireAuth>);
    expect(mocks.replace).toHaveBeenCalledWith("/login?next=%2Fagency%2Fmembers");
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("sanitizes hostile next targets (no protocol-relative redirect)", () => {
    mocks.pathname = "//evil.example/phish";
    mocks.session = { status: "unauthenticated", user: null, refresh: vi.fn(), signOut: vi.fn() };
    render(<RequireAuth>secret</RequireAuth>);
    expect(mocks.replace).toHaveBeenCalledWith("/login?next=%2F");
  });

  it("renders children when the required role is held", () => {
    mocks.session = { status: "authenticated", user, refresh: vi.fn(), signOut: vi.fn() };
    render(<RequireAuth roles={["agency_admin"]}>secret</RequireAuth>);
    expect(screen.getByText("secret")).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("sends authenticated-but-unauthorized users to /access-denied and hides content", () => {
    mocks.session = { status: "authenticated", user, refresh: vi.fn(), signOut: vi.fn() };
    render(<RequireAuth roles={["super_admin"]}>secret</RequireAuth>);
    expect(mocks.replace).toHaveBeenCalledWith("/access-denied");
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("renders no session state (never leaks content) once signed out", () => {
    mocks.session = { status: "unauthenticated", user: null, refresh: vi.fn(), signOut: vi.fn() };
    const { container } = render(<RequireAuth>secret</RequireAuth>);
    expect(container.textContent).toBe("");
  });
});

describe("AccessDenied", () => {
  it("explains the situation with a way back", () => {
    render(<AccessDenied />);
    expect(screen.getByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /return home/i })).toBeInTheDocument();
  });
});