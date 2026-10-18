/**
 * Feature flags.
 *
 * IMPORTANT: each `process.env.NEXT_PUBLIC_*` reference must be written out statically.
 * Next.js only inlines statically referenced public env vars into the client bundle; a
 * dynamic `process.env[name]` lookup silently evaluates to undefined in the browser and
 * leaves every flag at its default.
 */
export const featureFlags = {
  /** Enrollment, course player and server-synchronized progress. */
  learnerLearning: flag(process.env.NEXT_PUBLIC_FEATURE_LEARNER_LEARNING, false),
  /** Assessments and quizzes. */
  learnerAssessments: flag(process.env.NEXT_PUBLIC_FEATURE_LEARNER_ASSESSMENTS, false),
  /** Certificate generation and download. */
  learnerCertificates: flag(process.env.NEXT_PUBLIC_FEATURE_LEARNER_CERTIFICATES, false),
  /** Checkout / order placement. */
  storeCheckout: flag(process.env.NEXT_PUBLIC_FEATURE_STORE_CHECKOUT, false),
  /** Platform audit log views. */
  platformAuditLog: flag(process.env.NEXT_PUBLIC_FEATURE_PLATFORM_AUDIT_LOG, false),
  /** CSV bulk invitation upload. */
  bulkInvitations: flag(process.env.NEXT_PUBLIC_FEATURE_BULK_INVITATIONS, false)
} as const;

export type FeatureFlag = keyof typeof featureFlags;

function flag(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined) return defaultValue;
  return raw === "true" || raw === "1";
}
