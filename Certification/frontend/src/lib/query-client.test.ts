import { describe, expect, it } from "vitest";
import { createQueryClient } from "./query-client";
import { ApiError } from "./api/error";

type RetryFn = (failureCount: number, error: Error) => boolean;

function apiError(status: number): ApiError {
  return new ApiError({ status, code: status === 401 ? "unauthenticated" : status === 403 ? "forbidden" : "server", message: "x" });
}

describe("createQueryClient retry policy", () => {
  const client = createQueryClient();
  const retry = client.getDefaultOptions().queries?.retry as RetryFn;

  it("is wired for queries while mutations never retry", () => {
    expect(typeof retry).toBe("function");
    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
  });

  it("does not retry authentication or authorization failures", () => {
    expect(retry(0, apiError(401))).toBe(false);
    expect(retry(0, apiError(403))).toBe(false);
  });

  it("retries server errors up to the limit, then stops", () => {
    expect(retry(0, apiError(503))).toBe(true);
    expect(retry(1, apiError(500))).toBe(true);
    expect(retry(2, apiError(500))).toBe(false);
  });

  it("does not retry client-side 4xx (except the terminal auth cases above)", () => {
    expect(retry(0, apiError(404))).toBe(false);
  });

  it("retries generic (non-Api) failures such as network drops", () => {
    expect(retry(0, new Error("network down"))).toBe(true);
    expect(retry(2, new Error("network down"))).toBe(false);
  });
});