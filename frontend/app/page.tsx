import Link from 'next/link'
import { ArrowRight, BrainCircuit, Check, FileCheck2, LockKeyhole, Network, ShieldCheck, Sparkles, Upload, Lock, UserCheck, Building2 } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f6f2]'

const pillars = [
  { icon: LockKeyhole, title: 'Private by default', body: 'Every document belongs to one registered company. Nothing is browsable by the public, and restricted files are visible only to named people.' },
  { icon: BrainCircuit, title: 'Answers grounded in your files', body: 'OpenVault indexes your policies, contracts, reports, and procedures so approved employees can ask questions with cited source documents.' },
  { icon: Network, title: 'Controlled collaboration', body: 'Find a registered partner by its company code, choose one employee, and grant exactly one document without opening the rest of your library.' },
]

export default function Page() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f6f2] text-[#1d1d1b]">
      <SiteHeader />

      {/* Hero Section */}
      <section className="relative mx-auto max-w-7xl px-6 pb-20 pt-12 lg:px-10 lg:pb-20 lg:pt-20">
        {/* Floating gradient blobs */}
        <div className="pointer-events-none absolute left-0 top-0 -z-10 h-96 w-96 -translate-x-1/2 -translate-y-1/4 rounded-full bg-[#dfe7f7] opacity-60 blur-3xl mix-blend-multiply" />
        <div className="pointer-events-none absolute right-0 top-20 -z-10 h-80 w-80 translate-x-1/3 rounded-full bg-[#e7e2ff] opacity-60 blur-3xl mix-blend-multiply" />

        <div className="grid items-end gap-12 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#6b6862] animate-[fade-in-up_0.6s_ease-out_both]">
              <Sparkles className="size-3.5" aria-hidden /> The private company knowledge system
            </p>
            <h1 className="max-w-4xl text-[clamp(3.5rem,8vw,7.7rem)] font-semibold leading-[.88] tracking-[-0.085em] animate-[fade-in-up_0.6s_ease-out_both] delay-[150ms]">
              Give your<br /><span className="font-serif font-normal italic">knowledge a key.</span>
            </h1>
          </div>
          <div className="max-w-md pb-1 lg:pb-3 animate-[fade-in-up_0.6s_ease-out_both] delay-[300ms]">
            <p className="text-lg leading-relaxed text-[#5d5b55]">
              OpenVault gives employers a secure place to organize company knowledge, answer questions with AI, and collaborate with other registered companies without losing control.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/enterprise?tab=create" className={`inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3c3b37] ${FOCUS}`}>
                Get Started <ArrowRight className="size-4" />
              </Link>
              <Link href="#system-heading" className={`inline-flex items-center gap-2 rounded-full border border-[#dcdad3] bg-[#fffdfa] px-5 py-3 text-sm font-semibold transition hover:border-[#1d1d1b] ${FOCUS}`}>
                Learn more <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* The OpenVault System */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24" aria-labelledby="pillars-heading">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b6862]">The OpenVault system</p>
          <h2 id="pillars-heading" className="mt-4 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
            Built for useful access, not <span className="font-serif font-normal italic">open exposure.</span>
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {pillars.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-[26px] border border-[#dcdad3] bg-[#fffdfa] p-7 transition-transform duration-300 hover:scale-[1.02]">
              <span className="grid size-11 place-items-center rounded-2xl bg-[#f0ede5]">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-7 text-xl font-semibold tracking-[-0.03em]">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6b6862]">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* What we are building */}
      <section className="bg-[#20211f] px-6 py-20 text-white lg:px-10 lg:py-24" aria-labelledby="system-heading">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">What we are building</p>
              <h2 id="system-heading" className="mt-5 text-4xl font-semibold leading-tight tracking-[-0.06em] sm:text-6xl">
                A calm operating layer for <span className="font-serif font-normal italic text-white/75">company truth.</span>
              </h2>
            </div>
            <div className="relative grid gap-8 sm:grid-cols-2">
              <div className="hidden sm:block absolute left-1/2 top-0 bottom-0 w-px bg-white/10 -translate-x-1/2"></div>
              
              <div className="relative pt-5 sm:border-t-0 border-t border-white/15 animate-[fade-in-up_0.5s_ease-out_both]" style={{ animationDelay: '100ms' }}>
                <div className="mb-4 inline-flex size-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">1</div>
                <p className="text-sm font-semibold">Bring the knowledge together</p>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Upload policies, contracts, procedures, reports, and internal notes. Files stay inside the employer&apos;s tenant and are indexed for retrieval.
                </p>
              </div>
              <div className="relative pt-5 sm:border-t-0 border-t border-white/15 animate-[fade-in-up_0.5s_ease-out_both]" style={{ animationDelay: '200ms' }}>
                <div className="mb-4 inline-flex size-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">2</div>
                <p className="text-sm font-semibold">Set the audience</p>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Keep a file company-wide or choose named users. A CTO, CFO, or other employee cannot see a restricted file unless explicitly granted access.
                </p>
              </div>
              <div className="relative pt-5 border-t border-white/15 animate-[fade-in-up_0.5s_ease-out_both]" style={{ animationDelay: '300ms' }}>
                <div className="mb-4 inline-flex size-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">3</div>
                <p className="text-sm font-semibold">Share with confidence</p>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Use a partner company&apos;s five-character code, select its registered employee, and share one document. Access can be revoked at any time.
                </p>
              </div>
              <div className="relative pt-5 border-t border-white/15 animate-[fade-in-up_0.5s_ease-out_both]" style={{ animationDelay: '400ms' }}>
                <div className="mb-4 inline-flex size-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">4</div>
                <p className="text-sm font-semibold">Ask and prove</p>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  Employees ask the assistant questions grounded in what they can access. Admin audit trails record uploads, shares, downloads, and member activity.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CPA Ready */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24" aria-labelledby="cpa-heading">
        <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-[28px] bg-[#dfe7f7] p-8 sm:p-12 relative overflow-hidden">
            <ShieldCheck className="absolute -right-6 -top-6 size-48 text-black/[0.03] rotate-12" aria-hidden />
            <div className="relative z-10">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#53688f] flex items-center gap-2">
                <ShieldCheck className="size-4" /> CPA-ready from day one
              </p>
              <h2 id="cpa-heading" className="mt-5 max-w-xl text-4xl font-semibold leading-tight tracking-[-0.06em] sm:text-5xl">
                Make every control easier to <span className="font-serif font-normal italic">explain.</span>
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-[#536070]">
                OpenVault supports the evidence habits accounting, compliance, and CPA teams need: controlled ownership, least-privilege access, source-cited answers, document history, and a searchable audit trail.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  'Evidence by document', 'Role-aware access', 
                  'Share and revoke logs', 'Audit-ready activity', 
                  'Named-person grants', 'Immutable history'
                ].map((point) => (
                  <p key={point} className="flex items-center gap-2 text-sm font-medium text-[#34496f]">
                    <Check className="size-4 text-[#53688f]" /> {point}
                  </p>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-[28px] bg-[#fffdfa] border border-[#dcdad3] p-8 sm:p-10 flex flex-col justify-between transition-transform duration-300 hover:shadow-lg">
            <div>
              <FileCheck2 className="size-7 text-[#53688f]" aria-hidden />
              <h3 className="mt-16 text-2xl font-semibold tracking-[-0.04em]">A better handoff for finance and assurance.</h3>
              <p className="mt-4 text-sm leading-relaxed text-[#6b6862]">
                Give a CPA, auditor, or approved partner exactly the evidence they need, without turning your whole company library into a shared drive.
              </p>
            </div>
            <Link href="/about" className={`mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#1d1d1b] hover:text-[#53688f] transition-colors ${FOCUS}`}>
              See the operating model <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* How Access Control Works */}
      <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-10 lg:pb-24">
        <div className="rounded-[28px] bg-[#fffdfa] border border-[#dcdad3] p-8 sm:p-12 overflow-hidden relative">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b6862] mb-4">Granular Control</p>
            <h2 className="text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">How document access actually works</h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 relative">
            {/* Connecting lines for large screens */}
            <div className="hidden lg:block absolute top-6 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-[#dcdad3] to-transparent"></div>

            <div className="relative text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#f7f6f2] border border-[#dcdad3] mb-5 shadow-sm">
                <Upload className="size-5 text-[#53688f]" />
              </div>
              <h3 className="text-sm font-semibold mb-2">1. Secure Upload</h3>
              <p className="text-xs leading-relaxed text-[#6b6862]">CEO uploads a confidential file and marks it for &apos;Selected people&apos; only.</p>
            </div>

            <div className="relative text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#f7f6f2] border border-[#dcdad3] mb-5 shadow-sm">
                <Lock className="size-5 text-[#53688f]" />
              </div>
              <h3 className="text-sm font-semibold mb-2">2. Zero-Trust Defaults</h3>
              <p className="text-xs leading-relaxed text-[#6b6862]">Even the CTO or CFO in the same company cannot view it by default.</p>
            </div>

            <div className="relative text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#f7f6f2] border border-[#dcdad3] mb-5 shadow-sm">
                <UserCheck className="size-5 text-[#53688f]" />
              </div>
              <h3 className="text-sm font-semibold mb-2">3. Exact Delegation</h3>
              <p className="text-xs leading-relaxed text-[#6b6862]">Only explicitly named people (e.g. HR Director) are granted read access.</p>
            </div>

            <div className="relative text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#f7f6f2] border border-[#dcdad3] mb-5 shadow-sm">
                <Building2 className="size-5 text-[#53688f]" />
              </div>
              <h3 className="text-sm font-semibold mb-2">4. Partner Sharing</h3>
              <p className="text-xs leading-relaxed text-[#6b6862]">Share externally via company code to specific people at partner companies securely.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-10 lg:pb-28">
        <div className="rounded-[28px] bg-[#fffdfa] border border-[#dcdad3] p-8 sm:p-12">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b6862]">Ready when your team is</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Put the right knowledge in the right hands.</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#6b6862]">Start with a registered organization. Employees and employer admins use the same secure entry point, with permissions set by the company.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/enterprise?tab=create" className={`inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#3c3b37] ${FOCUS}`}>
                Register enterprise <ArrowRight className="size-4" />
              </Link>
              <Link href="/enterprise?role=employee" className={`inline-flex items-center gap-2 rounded-full border border-[#dcdad3] px-5 py-3 text-sm font-medium transition hover:border-[#1d1d1b] ${FOCUS}`}>
                Log in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
