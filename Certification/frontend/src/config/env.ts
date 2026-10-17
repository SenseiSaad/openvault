/**
 * Central environment configuration. Only public, non-secret values belong
 * here. No tokens, keys or credentials are ever stored in the frontend.
 */
export const env = {
  /** Absolute backend origin, used when the API is not same-origin (e.g. dev proxy disabled). */
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
  /** Environment label shown in the admin shell footer. */
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT ?? "development"
} as const;

export const isProduction = env.environment === "production";
