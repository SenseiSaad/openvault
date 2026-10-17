import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AcceptInvitationPage from "./page";
import { authApi } from "@/features/auth/api";
import { ApiError } from "@/lib/api/error";

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  params: new URLSearchParams()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/accept-invitation",
  useSearchParams: () => nav.params
}));

vi.mock("@/features/auth/api", () => ({
  authApi: {
    acceptInvitation: vi.fn()
  }
}));

const acceptMock = vi.mocked(authApi.acceptInvitation);

function renderInvitation(token: string | null) {
  nav.params = new URLSearchParams(token ? `token=${token}` : "");
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AcceptInvitationPage />
    </QueryClientProvider>
  );
}

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("First name"), "Ada");
  await user.type(screen.getByLabelText("Last name"), "Lovelace");
  await user.type(screen.getByLabelText("Create password"), "Str0ngEnoughPass");
  await user.click(screen.getByRole("button", { name: "Activate account" }));
}

describe("AcceptInvitationPage", () => {
  beforeEach(() => {
    nav.replace.mockClear();
    acceptMock.mockReset();
  });

  it("explains where the page comes from when no token is present", () => {
    renderInvitation(null);
    expect(screen.getByText("No invitation found")).toBeInTheDocument();
    expect(acceptMock).not.toHaveBeenCalled();
  });

  it("creates a new account session and continues into the dashboard", async () => {
    acceptMock.mockResolvedValue({ kind: "account_created", user: { id: "u9", email: "ada@agency.test", roles: ["learner"] } });

    renderInvitation("invite-token");
    await fillAndSubmit();

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/learner"));
    expect(acceptMock).toHaveBeenCalledWith({
      token: "invite-token",
      password: "Str0ngEnoughPass",
      first_name: "Ada",
      last_name: "Lovelace"
    });
  });

  it("handles an existing account by showing a calm sign-in path (no fake session)", async () => {
    acceptMock.mockResolvedValue({ kind: "existing_account", email: "ada@agency.test", message: "Already registered." });

    renderInvitation("invite-token");
    await fillAndSubmit();

    expect(await screen.findByText("Account already exists")).toBeInTheDocument();
    expect(screen.getByText("Already registered.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("reports expired, revoked or used invitations without technical detail", async () => {
    acceptMock.mockRejectedValue(new ApiError({ status: 410, code: "validation", message: "gone" }));

    renderInvitation("invite-token");
    await fillAndSubmit();

    expect(await screen.findByText(/no longer valid/i)).toBeInTheDocument();
    expect(screen.queryByText("gone")).not.toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });
});