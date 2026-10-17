/**
 * Feature flags for capabilities whose backend contracts are not yet
 * verified or whose endpoints do not exist yet in the backend.
 *
 * Rule: a feature behind a flag that is `false` MUST NOT render fake data.
 * Flagged screens render an explicit "integration pending" boundary.
 *
 * See docs/INTEGRATION_BLOCKERS.md for the corresponding backend work.
 */
export const featureFlags = {
  /** Enrollment, course player and server-synchronized progress. */
  learnerLearning: flag("NEXT_PUBLIC_FEATURE_LEARNER_LEARNING", false),
  /** Assessments and quizzes. */
  learnerAssessments: flag("NEXT_PUBLIC_FEATURE_LEARNER_ASSESSMENTS", false),
  /** Certificate generation and download. */
  learnerCertificates: flag("NEXT_PUBLIC_FEATURE_LEARNER_CERTIFICATES", false),
  /** Checkout / order placement. Disabled until the order API is verified. */
  storeCheckout: flag("NEXT_PUBLIC_FEATURE_STORE_CHECKOUT", false),
  /** Platform audit log views (audit endpoints unverified). */
  platformAuditLog: flag("NEXT_PUBLIC_FEATURE_PLATFORM_AUDIT_LOG", false),
  /** Bulk CSV invitation upload (bulk endpoint unverified). */
  bulkInvitations: flag("NEXT_PUBLIC_FEATURE_BULK_INVITATIONS", false)
} as const;

export type FeatureFlag = keyof typeof featureFlags;

function flag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return raw === "true" || raw === "1";
}
