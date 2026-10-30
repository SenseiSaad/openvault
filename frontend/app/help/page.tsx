import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, Check, LockKeyhole, Search, Share2, Upload } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Reveal } from '@/components/reveal'

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'A short guide to the private vault: register a company, invite your team, upload and classify documents, then share one file with one person.',
}

const STEPS = [
  {
    title: 'Register your enterprise',
    body: 'Create the organization and first employer admin account from the secure access page.',
  },
  {
    title: 'Invite the team',
    body: 'Admins add employees and viewers, including job titles such as CEO, CFO, CTO, or HR for clear recipient selection.',
  },
  {
    title: 'Upload and classify',
    body: 'Add a document, choose company-wide or selected-people access, and index it for permission-aware AI search.',
  },
  {
    title: 'Share precisely',
    body: 'Use a partner company code, find its registered members, select one person, and grant one file.',
  },
]

const ANSWERS = [
  {
    icon: Upload,
    title: 'Who can upload?',
    body: 'Employer admins and employees can upload. Viewers can read only what their account permits.',
    tone: 'bg-info-soft text-info',
  },
  {
    icon: LockKeyhole,
    title: 'What can people see?',
    body: 'Company-wide files are available to that company. Restricted files require a named grant. The AI follows the same rule.',
    tone: 'bg-accent-soft text-accent',
  },
  {
    icon: Share2,
    title: 'How does sharing work?',
    body: 'Search a registered company by its code, select its employee, and grant or revoke one specific document.',
    tone: 'bg-warn-soft text-warn',
  },
]

export default function HelpPage() {
  return (
    <main id="main-content" className="min-h-screen overflow-x-clip">
      <SiteHeader />

      <section className="relative overflow-hidden pb-14 pt-12 sm:pt-16 lg:pb-20 lg:pt-20" aria-labelledby="help-title">
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 -z-10" />
        <div className="container-page">
          <div className="max-w-3xl">
            <p className="animate-fade-up eyebrow" style={{ animationDelay: '80ms' }}>
              How it works
            </p>
            <h1
              id="help-title"
              className="display-xl mt-5 max-w-3xl animate-fade-up"
              style={{ animationDelay: '160ms' }}
            >
              The short guide to a <span className="serif text-accent">private vault.</span>
            </h1>
            <p
              className="mt-6 max-w-2xl animate-fade-up text-[1.02rem] leading-relaxed text-muted-foreground sm:text-lg"
              style={{ animationDelay: '260ms' }}
            >
              OpenVault is not a public document library. It is a controlled workspace for registered
              companies and the people they authorize.
            </p>
          </div>
        </div>
      </section>

      <section className="container-page pb-16 sm:pb-20" aria-label="Getting started steps">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
          <Reveal>
            <div className="lg:sticky lg:top-28">
              <p className="eyebrow">The quick path</p>
              <h2 className="display-md mt-4 max-w-xs">Four steps. No migration project.</h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Most teams upload their first policy and ask a cited question in under ten minutes.
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                {['No card required', 'USD pricing', 'Cancel anytime'].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          <div>
            {STEPS.map((step, index) => (
              <Reveal key={step.title} delay={index * 60}>
                <article className="grid grid-cols-[2.5rem_1fr] gap-4 border-t border-border py-6 sm:grid-cols-[4rem_1fr] sm:gap-7 sm:py-8">
                  <span className="font-mono text-[10px] text-accent">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h2 className="text-[1.1rem] font-medium tracking-[-0.025em] sm:text-[1.25rem]">
                      {step.title}
                    </h2>
                    <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface/35 py-16 sm:py-20" aria-label="Quick answers">
        <div className="container-page">
          <Reveal>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="eyebrow">Quick answers</p>
                <h2 className="display-md mt-4">The three questions everyone asks first.</h2>
              </div>
              <Link href="/policy" className="link-arrow">
                Read the full policy <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {ANSWERS.map(({ icon: Icon, title, body, tone }, index) => (
              <Reveal key={title} delay={index * 70}>
                <article className="flex h-full flex-col rounded-xl border border-border bg-surface p-6">
                  <span className={`grid size-9 place-items-center rounded-full ${tone}`}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <h3 className="mt-8 text-[15px] font-medium">{title}</h3>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#151412] py-16 text-[#f3efe5] sm:py-20" aria-labelledby="help-cta">
        <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 opacity-[0.1]" />
        <div className="container-page relative">
          <Reveal>
            <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <Search className="size-5 text-[#d9a75f]" aria-hidden />
                <h2 id="help-cta" className="display-md mt-5">
                  Still deciding how to start?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[#f3efe5]/55">
                  Register your organization and use the employer dashboard to define the right
                  access model for every file.
                </p>
              </div>
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <Link
                  href="/enterprise?tab=create"
                  className="btn bg-[#f3efe5] text-[#171511] hover:bg-[#d9a75f] hover:text-[#1a1205]"
                >
                  Create an organization <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link
                  href="/enterprise?role=employee"
                  className="btn border border-white/20 text-[#f3efe5] hover:border-white/40 hover:bg-white/5"
                >
                  Sign in
                </Link>
              </div>
            </div>
            <p className="mt-8 flex items-center gap-2 border-t border-white/10 pt-5 text-[10.5px] text-[#f3efe5]/40">
              <Check className="size-3.5 text-[#d9a75f]" aria-hidden /> Every plan includes tenant
              isolation, cited answers, and the audit trail.
            </p>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
