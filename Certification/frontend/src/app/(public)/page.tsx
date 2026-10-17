import Link from "next/link";
import {
  GraduationCap,
  ShieldCheck,
  Users,
  BarChart3,
  ArrowRight,
  Sparkles,
  Lock,
  Award,
  CheckCircle2,
  FileCheck2,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Certification Academy — Government Training Platform" };

const valueProps = [
  {
    icon: ShieldCheck,
    title: "Federal Security Architecture",
    description:
      "Session-based authentication with HttpOnly cookies, CSRF protection, and role-based access control aligned with government security expectations.",
    badge: "FedRAMP Aligned"
  },
  {
    icon: Users,
    title: "Agency-Scale Seat Management",
    description:
      "Purchase entitlements, assign seats to agency staff, track real-time utilization, and reassign personnel instantly without support tickets.",
    badge: "Multi-Tenant"
  },
  {
    icon: BarChart3,
    title: "Auditable Compliance Reporting",
    description:
      "Enrollment milestones, progress telemetry, and completion verification at your fingertips, fully exportable for federal oversight.",
    badge: "OIG & GAO Ready"
  }
];

const platformMetrics = [
  { value: "50,000+", label: "Certified Learners", subtext: "Across federal & state departments" },
  { value: "200+", label: "Government Agencies", subtext: "Active multi-tenant organizations" },
  { value: "99.95%", label: "Platform Availability", subtext: "High-reliability cloud infrastructure" },
  { value: "100%", label: "Audit-Ready Logs", subtext: "Complete immutable traceability" }
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-primary/10 selection:text-primary">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Frosted Glass Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-heading text-lg font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
            aria-label="Certification Academy home"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <GraduationCap aria-hidden="true" className="h-5 w-5" />
            </div>
            <span>Certification Academy</span>
          </Link>

          <nav aria-label="Primary" className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="text-xs font-semibold">
              <Link href="/catalogue">Training Catalogue</Link>
            </Button>
            <Button size="sm" asChild className="gap-1.5 shadow-sm">
              <Link href="/login">
                Sign In <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-primary/[0.03] via-background to-background py-20 sm:py-28">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40" />

          <div className="container max-w-4xl px-4 text-center sm:px-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1 text-xs font-semibold text-primary shadow-subtle mb-6 backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              U.S. Government Training & Certification Infrastructure
            </div>

            <h1 className="font-heading text-balance text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl">
              Certified training, managed at{" "}
              <span className="bg-gradient-to-r from-primary via-indigo-600 to-indigo-800 bg-clip-text text-transparent">
                agency scale
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
              Certification Academy is a purpose-built learning management system for federal, state, and local agencies — delivering procurement-friendly seat allocations, auditable progress tracking, and enterprise-grade security.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" asChild className="gap-2 shadow-md hover:shadow-lg transition-all duration-200">
                <Link href="/login">
                  Sign in to your account <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="gap-2 bg-background/60 backdrop-blur-sm">
                <Link href="/catalogue">
                  Browse training catalogue
                </Link>
              </Button>
            </div>

            <p className="mt-5 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-muted-foreground/80" />
              Accounts are provisioned exclusively by agency administrators — no open public registration.
            </p>
          </div>
        </section>

        {/* Fleet Metrics Strip */}
        <section aria-label="Platform metrics" className="border-b border-border/60 bg-secondary/30 py-12">
          <div className="container max-w-7xl px-4 sm:px-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {platformMetrics.map((metric) => (
                <div key={metric.label} className="rounded-xl border border-border/70 bg-card p-5 shadow-card text-center sm:text-left">
                  <div className="font-heading text-3xl font-bold tracking-tight text-foreground tabular-nums">
                    {metric.value}
                  </div>
                  <div className="mt-1 font-semibold text-sm text-foreground">
                    {metric.label}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {metric.subtext}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Capabilities Section */}
        <section aria-labelledby="capabilities-title" className="container max-w-7xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center mb-14">
            <h2 id="capabilities-title" className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Architected for enterprise rigor
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Everything federal administrators and agency learners need for seamless certified compliance.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {valueProps.map(({ icon: Icon, title, description, badge }) => (
              <article
                key={title}
                className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-7 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-card-hover"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200">
                      <Icon aria-hidden="true" className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {badge}
                    </span>
                  </div>

                  <h3 className="font-heading text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-border/60 flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <span>Verified capability</span>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Call to Action Banner */}
        <section className="container max-w-7xl px-4 pb-20 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-r from-primary to-indigo-900 p-8 sm:p-12 text-white shadow-xl">
            <div className="absolute right-0 top-0 -mr-24 -mt-24 h-96 w-96 rounded-full bg-white/10 blur-3xl pointer-events-none" />

            <div className="relative max-w-2xl space-y-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-md">
                <Building2 className="h-3.5 w-3.5" /> Federal Agency Training
              </span>

              <h2 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
                Ready to empower your workforce?
              </h2>

              <p className="text-white/80 text-sm sm:text-base leading-relaxed">
                Connect with your department training liaison or agency administrator to verify your seat entitlement and begin certified curriculum today.
              </p>

              <div className="pt-2 flex flex-wrap gap-3">
                <Button size="lg" variant="secondary" asChild className="gap-2 font-semibold shadow-md">
                  <Link href="/login">
                    Access Portal <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="border-white/30 text-white hover:bg-white/10">
                  <Link href="/catalogue">
                    Explore Product Catalog
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/70 bg-card">
        <div className="container max-w-7xl px-4 py-8 sm:px-6 flex flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2 font-medium">
            <GraduationCap className="h-4 w-4 text-primary" />
            <span>© {new Date().getFullYear()} Certification Academy. A Government Training Platform.</span>
          </div>

          <nav aria-label="Footer">
            <ul className="flex items-center gap-5">
              <li>
                <Link className="underline-offset-4 hover:underline hover:text-foreground transition-colors" href="/privacy">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link className="underline-offset-4 hover:underline hover:text-foreground transition-colors" href="/terms">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link className="underline-offset-4 hover:underline hover:text-foreground transition-colors" href="/accessibility">
                  Accessibility (Section 508)
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
