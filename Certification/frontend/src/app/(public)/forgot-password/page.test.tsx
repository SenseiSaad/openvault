import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ForgotPasswordPage from "./page";
import { authApi } from "@/features/auth/api";
import { ApiError } from "@/lib/api/error";

vi.mock("@/features/auth/api", () => ({
  authApi: {
    requestPasswordReset: vi.fn()
  }
}));

const requestMock = vi.mocked(authApi.requestPasswordReset);

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it("validates the email before calling the API", async () => {
    render(<ForgotPasswordPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email address"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("always shows the neutral confirmation, never disclosing whether the account exists", async () => {
    requestMock.mockResolvedValue(undefined);
    render(<ForgotPasswordPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email address"), "someone@agency.test");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText(/If an account exists for that address/i)).toBeInTheDocument();
    expect(requestMock).toHaveBeenCalledWith({ email: "someone@agency.test" });
  });

  it("keeps the neutral confirmation even when the backend fails (no information leak)", async () => {
    requestMock.mockRejectedValue(new ApiError({ status: 500, code: "server", message: "boom" }));
    render(<ForgotPasswordPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email address"), "someone@agency.test");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText(/If an account exists for that address/i)).toBeInTheDocument();
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
  });

  it("explains rate limiting calmly on 429", async () => {
    requestMock.mockRejectedValue(new ApiError({ status: 429, code: "rate_limited", message: "slow down" }));
    render(<ForgotPasswordPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email address"), "someone@agency.test");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText(/Too many requests/i)).toBeInTheDocument();
  });
});