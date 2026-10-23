import Link from 'next/link'
import {
  ArrowUpRight,
  Building2,
  Check,
  Download,
  FileText,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { Reveal } from '@/components/reveal'

const SCOPES = [
  {
    icon: Building2,
    title: 'Company-wide',
    body: 'Everyone active at your company can find it.',
    count: 'All members',
  },
  {
    icon: Users,
    title: 'Department',
    body: 'Only the department you choose can see it.',
    count: 'One team',
  },
  {
    icon: LockKeyhole,
    title: 'Selected people',
    body: 'You, plus the exact names you add. Nobody else.',
    count: 'Named only',
  },
]

const AUDIT = [
  { time: '09:41', label: 'Sign-in', detail: 'saad@northstar.pk', tone: 'ok' },
  { time: '09:44', label: 'Document uploaded', detail: 'Employee Handbook.pdf', tone: 'ok' },
  { time: '09:52', label: 'Access granted', detail: 'Hira S. · Vendor Agreement.pdf', tone: 'accent' },
  { time: '10:03', label: 'Download blocked', detail: 'Viewer role · no permission', tone: 'danger' },
]

export function SystemSection() {
  return (
    <section id="system" className="scroll-mt-24 py-20 sm:py-24 lg:py-28" aria-labelledby="system-heading">
      <div className="container-page">
        <Reveal>
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">The system</p>
              <h2 id="system-heading" className="display-lg mt-5">
                Built for useful access,
                <br />
                not <span className="serif text-accent">open exposure.</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground lg:pb-1">
              The assistant is only as safe as the retrieval behind it. OpenVault filters what a
              person can see before a single passage reaches the model.
            </p>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-12 overflow-hidden rounded-[1.35rem] border border-border bg-surface/75">
            <div className="grid lg:grid-cols-12">
              {/* Permission-aware AI */}
              <article className="flex flex-col border-b border-border p-6 sm:p-8 lg:col-span-7 lg:border-b-0 lg:border-r">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      01 — Retrieval
                    </p>
                    <h3 className="display-md mt-3 max-w-md">Answers that show their work.</h3>
                  </div>
                  <span className="mt-1 hidden size-9 shrink-0 place-items-center rounded-full border border-border text-accent sm:grid">
                    <Sparkles className="size-4" aria-hidden />
                  </span>
                </div>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                  Every answer is built from permitted passages and returns with its source, page,
                  and access scope attached.
                </p>

                <div className="mt-7 border-l border-accent/60 pl-4 sm:pl-5">
                  <p className="text-[12px] text-muted-foreground">
                    &ldquo;What&apos;s our notice period for a resignation?&rdquo;
                  </p>
                  <p className="mt-3 max-w-xl text-[13.5px] leading-[1.7] text-foreground/90">
                    Thirty days from the date of written notice. During probation, the period is
                    seven days.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                      <FileText className="size-3 text-accent" aria-hidden />
                      Employee Handbook.pdf · p. 12
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10.5px] text-ok">
                      <Check className="size-3" aria-hidden /> Company-wide
                    </span>
                    <span className="ml-auto hidden font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground sm:inline">
                      Filtered before generation
                    </span>
                  </div>
                </div>

                <div className="mt-auto pt-8">
                  <div className="flex items-center gap-2 border-t border-border pt-4 font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-foreground">
                    <span><span className="text-accent">01</span> Scope filter</span>
                    <span className="h-px flex-1 bg-border" aria-hidden />
                    <span><span className="text-accent">02</span> Retrieve</span>
                    <span className="h-px flex-1 bg-border" aria-hidden />
                    <span><span className="text-accent">03</span> Cite</span>
                  </div>
                </div>
              </article>

              {/* Access scopes */}
              <article className="p-6 sm:p-8 lg:col-span-5">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      02 — Access
                    </p>
                    <h3 className="display-md mt-3">Three scopes. One rulebook.</h3>
                  </div>
                  <span className="mt-1 hidden size-9 shrink-0 place-items-center rounded-full border border-border text-accent sm:grid">
                    <KeyRound className="size-4" aria-hidden />
                  </span>
                </div>

                <ul className="mt-7">
                  {SCOPES.map(({ icon: Icon, title, body, count }, index) => (
                    <li
                      key={title}
                      className={`flex gap-3.5 py-4 ${index > 0 ? 'border-t border-border' : 'pt-0'}`}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-accent">
                        <Icon className="size-3.5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-[13px] font-medium">{title}</p>
                          <span className="shrink-0 font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-foreground">
                            {count}
                          </span>
                        </div>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{body}</p>
                      </div>
                    </li>
                  ))}
                </ul>

                <p className="border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
                  Restricted files stay hidden from the assistant too, not just from the interface.
                </p>
              </article>

              {/* Cross-company sharing */}
              <article className="border-t border-border p-6 sm:p-8 lg:col-span-5 lg:border-r">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    03 — Collaboration
                  </p>
                  <h3 className="display-md mt-3">Share one page, not the library.</h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                    Find a registered partner by its company code, choose one person, and grant exactly
                    one document.
                  </p>
                </div>

                <div className="mt-8">
                  <div className="flex items-stretch">
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                        Your tenant
                      </p>
                      <p className="mt-2 font-mono text-[1.1rem] tracking-[0.16em]">N7K2M</p>
                      <p className="mt-1 truncate text-[10px] text-muted-foreground">Northstar Labs</p>
                    </div>
                    <div className="relative mx-3 flex w-16 flex-col items-center justify-center" aria-hidden>
                      <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
                      <span className="relative grid size-7 place-items-center rounded-full border border-accent/40 bg-accent-soft text-accent">
                        <LockKeyhole className="size-3" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 text-right">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                        Partner tenant
                      </p>
                      <p className="mt-2 font-mono text-[1.1rem] tracking-[0.16em]">A7K2M</p>
                      <p className="mt-1 truncate text-[10px] text-muted-foreground">Hira S. · People Ops</p>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-border pt-3">
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <FileText className="size-3 text-accent" aria-hidden /> 1 document granted
                    </span>
                    <span className="text-[10px] text-muted-foreground">Download off · Revocable</span>
                  </div>
                </div>
              </article>

              {/* Audit trail */}
              <article className="border-t border-border p-6 sm:p-8 lg:col-span-7">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      04 — Evidence
                    </p>
                    <h3 className="display-md mt-3">Every action leaves a receipt.</h3>
                  </div>
                  <span className="mt-1 hidden size-9 shrink-0 place-items-center rounded-full border border-border text-accent sm:grid">
                    <ShieldCheck className="size-4" aria-hidden />
                  </span>
                </div>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                  Sign-ins, uploads, shares, downloads, and revocations are recorded for the people
                  accountable after the work is done.
                </p>

                <div className="mt-6">
                  {AUDIT.map((row, index) => (
                    <div
                      key={row.time + row.label}
                      className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 py-2.5 sm:grid-cols-[2.5rem_1fr_1.2fr_auto] ${
                        index > 0 ? 'border-t border-border' : ''
                      }`}
                    >
                      <span className="font-mono text-[9.5px] text-muted-foreground">{row.time}</span>
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={`size-1.5 shrink-0 rounded-full ${
                            row.tone === 'danger'
                              ? 'bg-danger'
                              : row.tone === 'accent'
                                ? 'bg-accent'
                                : 'bg-ok'
                          }`}
                          aria-hidden
                        />
                        <span className="truncate text-[11.5px] font-medium">{row.label}</span>
                      </span>
                      <span className="hidden truncate text-[10.5px] text-muted-foreground sm:block">
                        {row.detail}
                      </span>
                      <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-muted-foreground">
                        Logged
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <span className="inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                    <Download className="size-3" aria-hidden /> CSV export for auditors
                  </span>
                  <Link href="/policy" className="link-arrow text-[11.5px]">
                    Read the security model <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export default SystemSection
