import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResetPasswordPage from "./page";
import { authApi } from "@/features/auth/api";
import { ApiError } from "@/lib/api/error";

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  params: new URLSearchParams()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/reset-password",
  useSearchParams: () => nav.params
}));

vi.mock("@/features/auth/api", () => ({
  authApi: {
    confirmPasswordReset: vi.fn()
  }
}));

const confirmMock = vi.mocked(authApi.confirmPasswordReset);

const STRONG = "Str0ngEnoughPass";

function renderWithToken(token: string | null) {
  nav.params = new URLSearchParams(token ? `token=${token}` : "");
  return render(<ResetPasswordPage />);
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    nav.replace.mockClear();
    confirmMock.mockReset();
  });

  it("refuses to render the form without a reset token", () => {
    renderWithToken(null);
    expect(screen.getByText("Reset link is incomplete")).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("rejects passwords below the policy", async () => {
    renderWithToken("tok-123");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("New password"), "short");
    await user.type(screen.getByLabelText("Confirm password"), "short");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText("Password must be at least 12 characters")).toBeInTheDocument();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("rejects mismatched confirmation", async () => {
    renderWithToken("tok-123");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("New password"), STRONG);
    await user.type(screen.getByLabelText("Confirm password"), `${STRONG}x`);
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("submits the token with the new password and returns to sign-in", async () => {
    confirmMock.mockResolvedValue(undefined);
    renderWithToken("tok-123");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("New password"), STRONG);
    await user.type(screen.getByLabelText("Confirm password"), STRONG);
    await user.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/login?reset=true"));
    expect(confirmMock).toHaveBeenCalledWith({ token: "tok-123", new_password: STRONG });
  });

  it("shows the backend's safe message when the reset link is invalid or expired", async () => {
    confirmMock.mockRejectedValue(
      new ApiError({ status: 400, code: "validation", message: "This reset link is invalid or has expired. Please request a new one." })
    );
    renderWithToken("tok-expired");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("New password"), STRONG);
    await user.type(screen.getByLabelText("Confirm password"), STRONG);
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });
});