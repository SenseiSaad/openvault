import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Reveal } from '@/components/reveal'

export const metadata: Metadata = {
  title: 'Privacy & security',
  description:
    'How OpenVault protects company knowledge: tenant isolation, least privilege, permission-aware AI, and a complete audit trail.',
}

const POLICIES = [
  {
    title: 'Private by default',
    body: 'OpenVault does not expose a public browse, publisher, or free-user area. Documents are available only after enterprise authentication and only through the current user’s permissions.',
  },
  {
    title: 'Tenant isolation',
    body: 'Every document, indexed chunk, member, and audit event is scoped to its owning company. A member cannot use another company’s code to see files unless a specific document grant exists.',
  },
  {
    title: 'Least privilege',
    body: 'Company-wide documents are readable by active members of the owning company. Restricted documents require an explicit per-person grant. External sharing is always one document to one registered person at a time.',
  },
  {
    title: 'Permission-aware AI',
    body: 'The retrieval layer filters documents before they reach the assistant. A user cannot ask the AI to reveal a file that their account cannot access.',
  },
  {
    title: 'Auditability',
    body: 'Sign-ins, uploads, downloads, member changes, share grants, revocations, and AI questions are recorded in the employer audit trail for review and CPA or compliance workflows.',
  },
  {
    title: 'Responsible use',
    body: 'Employers are responsible for inviting the right people, assigning accurate titles and roles, protecting credentials, and revoking access when a person or partner no longer needs it.',
  },
]

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export default function PolicyPage() {
  return (
    <main id="main-content" className="min-h-screen overflow-x-clip">
      <SiteHeader />

      <section className="relative overflow-hidden pb-14 pt-12 sm:pt-16 lg:pb-20 lg:pt-20" aria-labelledby="policy-title">
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 -z-10" />
        <div className="container-page">
          <div className="max-w-3xl">
            <p className="animate-fade-up eyebrow" style={{ animationDelay: '80ms' }}>
              Privacy & security
            </p>
            <h1
              id="policy-title"
              className="display-xl mt-5 animate-fade-up"
              style={{ animationDelay: '160ms' }}
            >
              The rules behind a <span className="serif text-accent">private vault.</span>
            </h1>
            <p
              className="mt-6 max-w-2xl animate-fade-up text-[1.02rem] leading-relaxed text-muted-foreground sm:text-lg"
              style={{ animationDelay: '260ms' }}
            >
              OpenVault is designed around employer-controlled access. These principles describe the
              product behavior that protects company knowledge.
            </p>
            <p
              className="mt-4 animate-fade-up font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground"
              style={{ animationDelay: '320ms' }}
            >
              Product behavior · October 2026
            </p>
          </div>
        </div>
      </section>

      <section className="container-page pb-16 sm:pb-20">
        <div className="grid gap-12 lg:grid-cols-[0.6fr_1.4fr] lg:gap-16">
          <Reveal>
            <aside className="lg:sticky lg:top-28">
              <div className="rounded-xl border border-border bg-surface/70 p-5">
                <p className="flex items-center gap-2 text-[11px] font-medium">
                  <ShieldCheck className="size-3.5 text-accent" aria-hidden /> On this page
                </p>
                <nav aria-label="Security sections" className="mt-4 flex flex-col gap-2.5">
                  {POLICIES.map((policy, index) => (
                    <a
                      key={policy.title}
                      href={`#${slug(policy.title)}`}
                      className="group flex items-baseline gap-2 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <span className="font-mono text-[8.5px] text-accent">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      {policy.title}
                    </a>
                  ))}
                </nav>
              </div>
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border p-4">
                <LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
                <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                  No public browsing, no shared crawl, no cross-tenant retrieval. The company owns
                  the workspace and the permissions inside it.
                </p>
              </div>
            </aside>
          </Reveal>

          <div>
            {POLICIES.map((policy, index) => (
              <Reveal key={policy.title} delay={index * 45}>
                <article
                  id={slug(policy.title)}
                  className="scroll-mt-28 border-t border-border py-7 sm:py-8"
                >
                  <div className="grid gap-3 sm:grid-cols-[3rem_1fr] sm:gap-6">
                    <span className="font-mono text-[10px] text-accent">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h2 className="text-[1.15rem] font-medium tracking-[-0.025em]">{policy.title}</h2>
                      <p className="mt-2.5 max-w-2xl text-[13px] leading-[1.75] text-muted-foreground">
                        {policy.body}
                      </p>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}

            <Reveal>
              <p className="mt-6 border-t border-border pt-5 text-[10.5px] leading-relaxed text-muted-foreground">
                This page documents the implemented access model. Production deployments should add
                environment-specific retention, encryption, backup, incident-response, and legal
                review.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="container-page pb-16 sm:pb-20">
        <Reveal>
          <div className="flex flex-col gap-6 rounded-xl border border-border bg-surface/70 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
            <div>
              <p className="eyebrow">Questions</p>
              <h2 className="display-md mt-3">Want the long version?</h2>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Link href="/help" className="btn btn-primary">
                Read the field guide <ArrowRight className="size-4" aria-hidden />
              </Link>
              <a href="mailto:hello@openvault.site" className="btn btn-secondary">
                Contact us
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </main>
  )
}
