import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider, useSession } from "./session-context";
import { authApi } from "./api";
import { ApiError } from "@/lib/api/error";

vi.mock("./api", () => ({
  authApi: {
    me: vi.fn(),
    logout: vi.fn()
  }
}));

const meMock = vi.mocked(authApi.me);

function Probe() {
  const { status, user, refresh } = useSession();
  return (
    <div data-testid="probe">
      {status}
      {user ? `:${user.email}` : ""}
      <button type="button" onClick={() => void refresh()}>
        refresh
      </button>
    </div>
  );
}

function renderSession() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <Probe />
      </SessionProvider>
    </QueryClientProvider>
  );
}

describe("SessionProvider", () => {
  beforeEach(() => {
    meMock.mockReset();
  });

  it("restores the session from GET /api/auth/me after a full page refresh", async () => {
    meMock.mockResolvedValue({ id: "u1", email: "learner@agency.test", roles: ["learner"] });

    renderSession();
    // Fresh QueryClient (as after F5) -> starts loading, then authenticates.
    expect(screen.getByTestId("probe")).toHaveTextContent("loading");

    expect(await screen.findByText("authenticated:learner@agency.test")).toBeInTheDocument();
    expect(meMock).toHaveBeenCalledTimes(1);
  });

  it("treats a 401 as unauthenticated without throwing", async () => {
    meMock.mockRejectedValue(new ApiError({ status: 401, code: "unauthenticated", message: "nope" }));

    renderSession();

    expect(await screen.findByText("unauthenticated")).toBeInTheDocument();
  });

  it("refresh() forces a refetch of /api/auth/me", async () => {
    meMock.mockResolvedValue({ id: "u3", email: "a@b.test", roles: ["learner"] });

    renderSession();
    await screen.findByText("authenticated:a@b.test");
    expect(meMock).toHaveBeenCalledTimes(1);

    screen.getByRole("button", { name: "refresh" }).click();
    await vi.waitFor(() => expect(meMock).toHaveBeenCalledTimes(2));
  });
});