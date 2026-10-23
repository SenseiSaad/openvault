import Link from 'next/link'
import { ArrowRight, BriefcaseBusiness, Building2, ShieldCheck } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Reveal } from '@/components/reveal'

const OPTIONS = [
  {
    icon: BriefcaseBusiness,
    title: 'Employee login',
    body: 'Access the documents and AI answers your organization has assigned to you.',
    href: '/enterprise?role=employee',
    cta: 'Employee login',
  },
  {
    icon: ShieldCheck,
    title: 'Employer admin',
    body: 'Manage people, permissions, partner sharing, and compliance activity.',
    href: '/enterprise?role=admin',
    cta: 'Admin login',
  },
]

export default function AuthPage() {
  return (
    <main id="main-content" className="min-h-screen overflow-x-clip">
      <SiteHeader />

      <section className="relative overflow-hidden pb-16 pt-12 sm:pt-16 lg:pb-20 lg:pt-20" aria-labelledby="access-title">
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 -z-10" />
        <div className="container-page">
          <div className="max-w-3xl">
            <p className="animate-fade-up eyebrow" style={{ animationDelay: '80ms' }}>
              OpenVault access
            </p>
            <h1
              id="access-title"
              className="display-xl mt-5 animate-fade-up"
              style={{ animationDelay: '160ms' }}
            >
              Your company&apos;s knowledge,
              <br />
              <span className="serif text-accent">securely inside.</span>
            </h1>
            <p
              className="mt-6 max-w-xl animate-fade-up text-[1.02rem] leading-relaxed text-muted-foreground sm:text-lg"
              style={{ animationDelay: '260ms' }}
            >
              There is no public library or free-user browsing area. Choose the enterprise path that
              matches your role.
            </p>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            <Reveal>
              <Link
                href="/enterprise?tab=create"
                className="group relative flex h-full min-h-[19rem] flex-col overflow-hidden rounded-[1.25rem] bg-[#151412] p-7 text-[#f3efe5] transition-transform duration-300 hover:-translate-y-1 sm:p-9"
              >
                <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 opacity-[0.12]" />
                <div
                  aria-hidden
                  className="pointer-events-none absolute -bottom-24 -right-16 size-72 rounded-full border border-white/10"
                >
                  <div className="absolute inset-8 rounded-full border border-white/10" />
                  <div className="absolute inset-20 rounded-full bg-[#d9a75f]/10" />
                </div>

                <span className="relative grid size-10 place-items-center rounded-full border border-white/15 bg-white/5 text-[#d9a75f]">
                  <Building2 className="size-4" aria-hidden />
                </span>
                <div className="relative mt-auto pt-14">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#d9a75f]">
                    01 — New organization
                  </p>
                  <h2 className="display-md mt-3">Register as enterprise</h2>
                  <p className="mt-2 max-w-sm text-[12.5px] leading-relaxed text-[#f3efe5]/55">
                    Create your organization workspace and become its first employer admin.
                  </p>
                  <span className="mt-6 inline-flex items-center gap-2 text-[12.5px] font-medium text-[#f3efe5]">
                    Register organization
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </div>
              </Link>
            </Reveal>

            <div className="flex flex-col gap-4">
              {OPTIONS.map(({ icon: Icon, title, body, href, cta }, index) => (
                <Reveal key={title} delay={(index + 1) * 70}>
                  <Link
                    href={href}
                    className="group flex flex-1 flex-col rounded-[1.25rem] border border-border bg-surface/65 p-6 transition-colors hover:border-border-strong hover:bg-surface"
                  >
                    <div className="flex items-start justify-between">
                      <span className="grid size-9 place-items-center rounded-full border border-border text-accent">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="font-mono text-[9px] text-muted-foreground">0{index + 2}</span>
                    </div>
                    <h2 className="mt-7 text-[1.05rem] font-medium tracking-[-0.025em]">{title}</h2>
                    <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-muted-foreground">{body}</p>
                    <span className="mt-5 inline-flex items-center gap-2 text-[12px] font-medium">
                      {cta}
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>

          <p className="mt-6 text-[10.5px] text-muted-foreground">
            Accounts are created by registered companies. OpenVault never exposes a public browse or
            free-user area.
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
