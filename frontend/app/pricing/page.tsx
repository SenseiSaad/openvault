import Link from 'next/link'
import {
  ArrowRight,
  Check,
  CreditCard,
  Globe2,
  ShieldCheck,
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Reveal } from '@/components/reveal'

const EARLY_ACCESS = [
  {
    icon: Globe2,
    title: 'USD pricing',
    body: 'Plans are being finalized in USD so they stay predictable against our main AI cost. A PKR equivalent will be shown at checkout.',
  },
  {
    icon: CreditCard,
    title: 'Local payment options',
    body: 'Bank transfer, JazzCash and Easypaisa are being prepared alongside international card payments. No card is required to start.',
  },
  {
    icon: ShieldCheck,
    title: 'Early-access terms',
    body: 'Teams that onboard during early access keep the terms they start with when the public plans go live.',
  },
]

const INCLUDED = [
  'Permission-aware AI with source citations',
  'Tenant isolation and per-person document access',
  'Cross-company sharing with instant revocation',
  'Audit trail for sign-ins, uploads, shares and AI questions',
  'Amazon Bedrock hosted AI or a local Ollama endpoint',
  'Direct onboarding support from the team',
]

const FAQ = [
  {
    q: 'When will pricing be published?',
    a: 'Before general availability. Early-access teams will see the final plans first and keep the terms they onboarded with.',
  },
  {
    q: 'Why price in USD?',
    a: 'Our main AI cost is billed in USD. USD plans keep the price predictable and stop currency movement from changing your bill. We will show a PKR equivalent and support local payment methods.',
  },
  {
    q: 'Can I use OpenVault now?',
    a: 'Yes, by invitation. Request early access and we will set up a workspace with your team.',
  },
  {
    q: 'Will there be a free tier?',
    a: 'Yes. The free tier is intended for evaluation and small teams, and it will be published with the rest of the plans.',
  },
]

export default function PricingPage() {
  return (
    <main id="main-content" className="min-h-screen overflow-x-clip">
      <SiteHeader />

      <section
        className="relative overflow-hidden pb-16 pt-12 sm:pt-16 lg:pb-20 lg:pt-20"
        aria-labelledby="pricing-title"
      >
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 -z-10" />
        <div className="container-page">
          <div className="max-w-3xl">
            <p className="animate-fade-up eyebrow" style={{ animationDelay: '80ms' }}>
              Early access
            </p>
            <h1
              id="pricing-title"
              className="display-xl mt-5 animate-fade-up"
              style={{ animationDelay: '160ms' }}
            >
              Pricing is being
              <br />
              <span className="serif text-accent">finalized.</span>
            </h1>
            <p
              className="mt-6 max-w-2xl animate-fade-up text-[1.02rem] leading-relaxed text-muted-foreground sm:text-lg"
              style={{ animationDelay: '260ms' }}
            >
              OpenVault is in early access and will be fully available soon. We are onboarding a
              small group of organizations while we finish simple USD plans and local payment
              options. Prices will be published here before general availability.
            </p>
            <div
              className="mt-8 flex animate-fade-up flex-col gap-3 sm:flex-row sm:items-center"
              style={{ animationDelay: '340ms' }}
            >
              <a
                href="mailto:hello@openvault.site?subject=OpenVault%20early%20access"
                className="btn btn-primary group"
              >
                Request early access
                <ArrowRight
                  className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden
                />
              </a>
              <Link href="/#how-it-works" className="btn btn-secondary">
                See how it works
              </Link>
            </div>
            <div
              className="mt-6 flex animate-fade-up flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-muted-foreground"
              style={{ animationDelay: '420ms' }}
            >
              {['USD pricing', 'Local payment options', 'No card to start'].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-accent" aria-hidden /> {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-page pb-16 lg:pb-20" aria-label="Early-access pricing">
        <div className="grid gap-4 sm:grid-cols-3">
          {EARLY_ACCESS.map(({ icon: Icon, title, body }, index) => (
            <Reveal key={title} delay={index * 70}>
              <article className="h-full rounded-[1.1rem] border border-border bg-surface/60 p-5 sm:p-6">
                <span className="grid size-9 place-items-center rounded-full border border-border text-accent">
                  <Icon className="size-4" aria-hidden />
                </span>
                <h2 className="mt-5 text-[14px] font-medium tracking-[-0.02em]">{title}</h2>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface/35 py-16 sm:py-20" aria-labelledby="included-title">
        <div className="container-page">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <Reveal>
              <div>
                <p className="eyebrow">The early-access workspace</p>
                <h2 id="included-title" className="display-lg mt-5">
                  Everything the product
                  <br />
                  <span className="serif text-accent">does today.</span>
                </h2>
                <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Pricing is not public yet, but the product is. Early-access teams get the same
                  permission model, cited answers and audit trail that will ship at general
                  availability.
                </p>
              </div>
            </Reveal>

            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {INCLUDED.map((item, index) => (
                <Reveal key={item} delay={index * 50}>
                  <div className="flex items-start gap-3 border-t border-border pt-4">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
                    <p className="text-[12.5px] leading-relaxed text-muted-foreground">{item}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20" aria-labelledby="faq-title">
        <Reveal>
          <div className="max-w-2xl">
            <p className="eyebrow">Questions</p>
            <h2 id="faq-title" className="display-md mt-4">
              What early access
              <br />
              <span className="serif text-accent">means for you.</span>
            </h2>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-x-12 gap-y-7 sm:grid-cols-2">
          {FAQ.map((item) => (
            <article key={item.q} className="border-t border-border pt-4">
              <h3 className="text-[13.5px] font-medium leading-snug">{item.q}</h3>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="relative overflow-hidden bg-[#151412] text-[#f3efe5]"
        aria-labelledby="pricing-cta"
      >
        <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 opacity-[0.1]" />
        <div className="container-page relative py-16 sm:py-20">
          <Reveal>
            <div className="max-w-2xl">
              <p className="eyebrow text-[#d9a75f]">Early access</p>
              <h2 id="pricing-cta" className="display-lg mt-4">
                Bring your documents.
                <br />
                <span className="serif text-[#d9a75f]">We will set up the vault.</span>
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#f3efe5]/55">
                Tell us what your team needs to keep private and what you want people to find.
                We will reply with an early-access workspace and a clear path to the final plans.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href="mailto:hello@openvault.site?subject=OpenVault%20early%20access"
                  className="btn bg-[#f3efe5] text-[#171511] hover:bg-[#d9a75f] hover:text-[#1a1205]"
                >
                  Request early access <ArrowRight className="size-4" aria-hidden />
                </a>
                <Link
                  href="/policy"
                  className="btn border border-white/20 text-[#f3efe5] hover:border-white/40 hover:bg-white/5"
                >
                  Read the security model
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
