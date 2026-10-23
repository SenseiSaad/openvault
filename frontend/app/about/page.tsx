import Link from 'next/link'
import type { Metadata } from 'next'
import {
  ArrowRight,
  BrainCircuit,
  Check,
  FileCheck2,
  KeyRound,
  LockKeyhole,
  Network,
  ShieldCheck,
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Reveal } from '@/components/reveal'

export const metadata: Metadata = {
  title: 'About',
  description:
    'OpenVault is a secure layer between your people and the company knowledge they need. Built for private, permission-aware access.',
}

const PRINCIPLES = [
  {
    icon: LockKeyhole,
    title: 'Tenant isolation',
    body: 'Each registered employer receives a separate company workspace. Documents, people, AI retrieval, and audit events stay scoped to that company.',
  },
  {
    icon: KeyRound,
    title: 'Short company codes',
    body: 'Every organization gets a unique five-character code. Admins use it to find a registered partner before selecting a specific recipient.',
  },
  {
    icon: Network,
    title: 'Person-level sharing',
    body: 'A document can stay company-wide or be limited to named people. Sharing a file with one HR employee never grants the rest of their company access.',
  },
  {
    icon: BrainCircuit,
    title: 'Permission-aware AI',
    body: 'The assistant only retrieves chunks from documents the current employee is allowed to access. Source names and pages are returned with each answer.',
  },
  {
    icon: ShieldCheck,
    title: 'Accountability by default',
    body: 'Uploads, downloads, sign-ins, member changes, and share or revoke actions are recorded in the employer audit trail.',
  },
  {
    icon: FileCheck2,
    title: 'CPA-ready evidence',
    body: 'Controlled evidence packets, cited answers, and activity history make finance, compliance, and assurance handoffs easier.',
  },
]

const FACTS = [
  ['One tenant', 'per registered organization'],
  ['One document', 'per external recipient'],
  ['One trail', 'for every action'],
]

export default function AboutPage() {
  return (
    <main id="main-content" className="min-h-screen overflow-x-clip">
      <SiteHeader />

      <section className="relative overflow-hidden pb-16 pt-12 sm:pt-16 lg:pb-24 lg:pt-20" aria-labelledby="about-title">
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 -z-10" />
        <div className="container-page">
          <div className="max-w-4xl">
            <p className="animate-fade-up eyebrow" style={{ animationDelay: '80ms' }}>
              About OpenVault
            </p>
            <h1
              id="about-title"
              className="display-xl mt-5 max-w-4xl animate-fade-up"
              style={{ animationDelay: '160ms' }}
            >
              A secure layer between your people and the knowledge they{' '}
              <span className="serif text-accent">need.</span>
            </h1>
            <p
              className="mt-7 max-w-2xl animate-fade-up text-[1.02rem] leading-relaxed text-muted-foreground sm:text-lg"
              style={{ animationDelay: '260ms' }}
            >
              OpenVault is an employer-controlled knowledge and document system. It turns scattered
              company files into a searchable, permission-aware workspace without creating another
              public content marketplace.
            </p>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
            {FACTS.map(([title, body], index) => (
              <div key={title} className="bg-surface p-5 sm:p-6">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-accent">
                  0{index + 1}
                </p>
                <p className="mt-3 text-[15px] font-medium">{title}</p>
                <p className="mt-1 text-[11.5px] text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface/35 py-20 sm:py-24" aria-labelledby="principles-title">
        <div className="container-page">
          <Reveal>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-xl">
                <p className="eyebrow">The principles</p>
                <h2 id="principles-title" className="display-lg mt-5">
                  Useful access.
                  <br />
                  <span className="serif text-accent">Nothing careless.</span>
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground lg:pb-1">
                OpenVault is not a public document library. It is a controlled workspace for
                registered companies and the people they authorize.
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-x-12 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map(({ icon: Icon, title, body }, index) => (
              <Reveal key={title} delay={(index % 3) * 70}>
                <article className="flex h-full flex-col border-t border-border pt-5">
                  <div className="flex items-center justify-between">
                    <span className="grid size-8 place-items-center rounded-full border border-border text-accent">
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="mt-6 text-[15px] font-medium tracking-[-0.02em]">{title}</h3>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#151412] py-20 text-[#f3efe5] sm:py-24" aria-labelledby="model-title">
        <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 opacity-[0.1]" />
        <div className="container-page relative">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <Reveal>
              <div>
                <p className="eyebrow text-[#d9a75f]">The operating model</p>
                <h2 id="model-title" className="display-lg mt-5">
                  Bring it together.
                  <br />
                  <span className="serif text-[#d9a75f]">Limit the audience.</span>
                </h2>
                <p className="mt-6 max-w-sm text-sm leading-relaxed text-[#f3efe5]/50">
                  A simple rule runs through every screen: the assistant may only use what the
                  person asking is already allowed to see.
                </p>
              </div>
            </Reveal>

            <div className="grid gap-8 sm:grid-cols-3 lg:pt-2">
              {[
                {
                  title: 'For employers',
                  body: 'Register a company, invite employees, upload knowledge, and decide whether each file belongs to the whole company or selected people.',
                },
                {
                  title: 'For collaboration',
                  body: 'Find another registered organization by code, choose one employee, and grant one document with optional download rights.',
                },
                {
                  title: 'For the assistant',
                  body: 'Retrieval is filtered before generation. Answers carry source names and page references so they can be checked, not taken on faith.',
                },
              ].map((item, index) => (
                <Reveal key={item.title} delay={index * 70}>
                  <article className="border-t border-white/15 pt-5">
                    <span className="font-mono text-[9px] text-[#d9a75f]">0{index + 1}</span>
                    <h3 className="mt-5 text-[14px] font-medium">{item.title}</h3>
                    <p className="mt-2 text-[12px] leading-relaxed text-[#f3efe5]/50">{item.body}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={120}>
            <div className="mt-16 flex flex-col gap-5 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-[11.5px] text-[#f3efe5]/50">
                <Check className="size-3.5 text-[#d9a75f]" aria-hidden /> Built at the University of
                South Asia · FYP 2026
              </p>
              <Link href="/policy" className="link-arrow text-[#f3efe5]">
                Read the security model <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <Reveal>
          <div className="flex flex-col gap-6 rounded-xl border border-border bg-surface/70 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
            <div>
              <p className="eyebrow">Start here</p>
              <h2 className="display-md mt-3">Give your team a vault they can trust.</h2>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Link href="/enterprise?tab=create" className="btn btn-primary">
                Create an organization <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/pricing" className="btn btn-secondary">
                See pricing
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </main>
  )
}
