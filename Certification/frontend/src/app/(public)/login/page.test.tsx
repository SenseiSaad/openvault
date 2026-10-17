import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LoginPage from "./page";
import { authApi } from "@/features/auth/api";
import { ApiError } from "@/lib/api/error";

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  params: new URLSearchParams()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push, refresh: nav.refresh }),
  usePathname: () => "/login",
  useSearchParams: () => nav.params
}));

vi.mock("@/features/auth/api", () => ({
  authApi: {
    login: vi.fn(),
    me: vi.fn(),
    logout: vi.fn()
  }
}));

const loginMock = vi.mocked(authApi.login);
const meMock = vi.mocked(authApi.me);

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LoginPage />
    </QueryClientProvider>
  );
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email address"), email);
  if (password) await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    nav.replace.mockClear();
    nav.params = new URLSearchParams();
    loginMock.mockReset();
    meMock.mockReset();
  });

  it("validates the form before calling the API", async () => {
    renderLogin();
    await fillAndSubmit("not-an-email", "");

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("signs in and redirects to the role dashboard", async () => {
    loginMock.mockResolvedValue({ user: { id: "u1", email: "admin@agency.test", roles: ["agency_admin"] } });
    meMock.mockResolvedValue({ id: "u1", email: "admin@agency.test", roles: ["agency_admin"] });

    renderLogin();
    await fillAndSubmit("admin@agency.test", "correct horse battery");

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/agency"));
    expect(loginMock).toHaveBeenCalledWith({ email: "admin@agency.test", password: "correct horse battery" });
    expect(meMock).toHaveBeenCalledTimes(1);
  });

  it("honours a safe ?next= redirect target after sign-in", async () => {
    nav.params = new URLSearchParams("next=/agency/seats");
    loginMock.mockResolvedValue({ user: { id: "u1", email: "admin@agency.test", roles: ["agency_admin"] } });
    meMock.mockResolvedValue({ id: "u1", email: "admin@agency.test", roles: ["agency_admin"] });

    renderLogin();
    await fillAndSubmit("admin@agency.test", "correct horse battery");

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/agency/seats"));
  });

  it("shows a generic credential error on 401 without leaking internals", async () => {
    loginMock.mockRejectedValue(new ApiError({ status: 401, code: "unauthenticated", message: "nope" }));

    renderLogin();
    await fillAndSubmit("admin@agency.test", "wrong-password");

    expect(await screen.findByText("The email address or password is incorrect.")).toBeInTheDocument();
    expect(loginMock).toHaveBeenCalledTimes(1);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("disables the submit button while signing in and prevents duplicate submits", async () => {
    loginMock.mockImplementation(() => new Promise(() => {})); // never resolves — simulates a slow backend

    renderLogin();
    await fillAndSubmit("admin@agency.test", "correct horse battery");

    const pendingButton = await screen.findByRole("button", { name: "Signing in…" });
    expect(pendingButton).toBeDisabled();

    await userEvent.setup().click(pendingButton);
    expect(loginMock).toHaveBeenCalledTimes(1);
  });
});