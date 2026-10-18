import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./client";
import { ApiError } from "./error";

/** JSON Response helper for the fetch mock. */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("ApiClient", () => {
  const fetchMock = vi.fn();
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient("");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends credentials, a per-request X-Request-Id and skips empty query values", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await client.get("/api/things", { query: { page: 2, q: "", missing: undefined, active: true } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/things?page=2&active=true");
    expect(init.credentials).toBe("include");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Request-Id"]).toMatch(/.+/);
    expect(headers["Accept"]).toBe("application/json");
    expect(headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("fetches the CSRF token lazily and attaches X-CSRF-Token on mutations only", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { csrf_token: "csrf-abc" })) // GET /api/auth/csrf
      .mockResolvedValueOnce(jsonResponse(200, {})); // POST

    await client.post("/api/auth/login", { email: "a@b.co" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [csrfUrl] = fetchMock.mock.calls[0] as [string];
    expect(csrfUrl).toBe("/api/auth/csrf");

    const [postUrl, postInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(postUrl).toBe("/api/auth/login");
    expect((postInit.headers as Record<string, string>)["X-CSRF-Token"]).toBe("csrf-abc");
    expect(postInit.body).toBe(JSON.stringify({ email: "a@b.co" }));
  });

  it("retries a rejected CSRF token exactly once with a freshly fetched token", async () => {
    let csrfCount = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/auth/csrf") {
        csrfCount += 1;
        return Promise.resolve(jsonResponse(200, { csrf_token: `token-${csrfCount}` }));
      }
      // Reject until the third CSRF fetch (initial + fresh-token retry) has happened.
      return Promise.resolve(jsonResponse(csrfCount >= 3 ? 200 : 401, {}));
    });

    await client.post("/api/thing", { a: 1 });

    const postCalls = fetchMock.mock.calls.filter(([url]) => url !== "/api/auth/csrf");
    expect(postCalls.length).toBe(2); // exactly one retry — never more
    const lastHeaders = postCalls[1]?.[1] as RequestInit;
    expect((lastHeaders.headers as Record<string, string>)["X-CSRF-Token"]).toBe("token-3");
  });

  it("notifies unauthenticated listeners on 401 but not on 403 or the session probe", async () => {
    const listener = vi.fn();
    const unsubscribe = client.onUnauthenticated(listener);

    fetchMock.mockResolvedValueOnce(jsonResponse(401, { detail: "Unauthenticated" }));
    await expect(client.get("/api/me/enrollments")).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledTimes(1);

    // Anonymous visitors always get 401 from the session probe; it must not redirect them
    // to the session-expired screen.
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { detail: "Unauthenticated" }));
    await expect(client.get("/api/auth/me")).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(jsonResponse(403, { detail: "Forbidden" }));
    const error = await client.get("/api/admin").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("forbidden");
    expect(listener).toHaveBeenCalledTimes(1); // 403 is not a logout

    unsubscribe();
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));
    await expect(client.get("/api/me/enrollments")).rejects.toThrow();
    expect(listener).toHaveBeenCalledTimes(1); // unsubscribed
  });

  it("never surfaces raw 5xx backend internals", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(500, { detail: "SQLSTATE[HY000] [2002] Connection refused for password hunter2" })
    );

    const error = (await client.get("/api/broken").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
    expect(error.message).toBe("The service is temporarily unavailable. Please try again shortly.");
    expect(error.message).not.toContain("SQLSTATE");
    expect(error.message).not.toContain("hunter2");
  });

  it("shows 4xx detail messages and structured field errors", async () => {
    // Each POST needs a CSRF response first (fresh client per test).
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { csrf_token: "csrf-1" }))
      .mockResolvedValueOnce(jsonResponse(400, { detail: "Email already registered" }));
    const detailError = (await client.post("/api/x").catch((e: unknown) => e)) as ApiError;
    expect(detailError).toBeInstanceOf(ApiError);
    expect(detailError.message).toBe("Email already registered");

    // Token is now cached on this client, so the next POST goes straight out.
    fetchMock.mockResolvedValueOnce(jsonResponse(422, { errors: { email: ["Enter a valid email"] } }));
    const fieldError = (await client.post("/api/x").catch((e: unknown) => e)) as ApiError;
    expect(fieldError.message).toBe("Please review the highlighted fields.");
    expect(fieldError.fieldErrors).toEqual({ email: "Enter a valid email" });
  });

  it("normalizes network failures into a safe ApiError", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const error = (await client.get("/api/offline").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.code).toBe("network");
    expect(error.message).not.toContain("Failed to fetch");
  });
});