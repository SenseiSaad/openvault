import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api/error";

/**
 * Query retry policy: only "safe" failures are retried — network errors and
 * 5xx on GET queries. Mutations are never retried automatically, and
 * authentication/authorization failures are terminal.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            if (error.isUnauthenticated || error.isForbidden) return false;
            return error.status >= 500 && failureCount < 2;
          }
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
        staleTime: 30_000
      },
      mutations: {
        retry: false // never automatically retry a state-changing request
      }
    }
  });
}
