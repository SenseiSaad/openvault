'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, BrainCircuit, Check, Cpu, HardDrive, ShieldCheck } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { PlanCard } from '@/components/plan-card'
import { Reveal } from '@/components/reveal'
import { adminApi, type Plan } from '@/lib/api'
import { FALLBACK_PLANS, PLAN_COPY, storageLabel } from '@/lib/pricing'
import { PRICING_CONTENT, type PricingLang } from '@/lib/pricing-i18n'

const LANG_KEY = 'openvault-pricing-lang'

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [live, setLive] = useState(true)
  const [lang, setLang] = useState<PricingLang>('en')

  useEffect(() => {
    const saved = window.localStorage.getItem(LANG_KEY)
    if (saved === 'ur' || saved === 'en') setLang(saved)
  }, [])

  useEffect(() => {
    adminApi
      .plans()
      .then((res) => setPlans(res))
      .catch(() => {
        setPlans(FALLBACK_PLANS.map((p, i) => ({ ...p, id: -(i + 1) })))
        setLive(false)
      })
  }, [])

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next: PricingLang = prev === 'en' ? 'ur' : 'en'
      window.localStorage.setItem(LANG_KEY, next)
      return next
    })
  }, [])

  const t = PRICING_CONTENT[lang]
  const coverIcons = useMemo(() => [Cpu, HardDrive, BrainCircuit, ShieldCheck], [])

  return (
    <main id="main-content" className="min-h-screen overflow-x-clip">
      <SiteHeader />

      <section className="relative overflow-hidden pb-14 pt-12 sm:pt-16 lg:pb-16 lg:pt-20" aria-labelledby="pricing-title">
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 -z-10" />
        <div className="container-page">
          <div className="max-w-3xl">
            <div className="flex animate-fade-up items-center gap-3" style={{ animationDelay: '80ms' }}>
              <p className="eyebrow">{t.eyebrow}</p>
              <button
                type="button"
                onClick={toggleLang}
                className="rounded-full border border-border bg-surface px-3 py-1 text-[10px] font-medium tracking-[0.02em] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
              >
                {t.langToggle}
              </button>
            </div>

            <h1
              id="pricing-title"
              className="display-xl mt-5 animate-fade-up"
              style={{ animationDelay: '160ms' }}
            >
              {t.titleA}
              <br />
              <span className="serif text-accent">{t.titleB}</span>
            </h1>
            <p
              className="mt-6 max-w-2xl animate-fade-up text-[1.02rem] leading-relaxed text-muted-foreground sm:text-lg"
              style={{ animationDelay: '260ms' }}
            >
              {t.lede}
            </p>
            <div
              className="mt-5 flex animate-fade-up flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-muted-foreground"
              style={{ animationDelay: '340ms' }}
            >
              {live && plans && (
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 shrink-0 text-accent" aria-hidden /> {t.liveNote}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 shrink-0 text-accent" aria-hidden /> {t.billedNote}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page pb-16 lg:pb-20" aria-label="Plans">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy={plans == null}>
          {plans == null
            ? Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[27rem] animate-pulse rounded-[1.1rem] border border-border bg-surface/60"
                />
              ))
            : plans.map((p) => {
                const baseCopy = PLAN_COPY[p.name] ?? { tagline: '', blurb: '', cta: 'start' as const }
                const copy = { ...baseCopy, ...(t.planCopy[p.name] ?? {}) }
                const features = [
                  t.members(p.max_members),
                  t.docs(p.max_documents),
                  storageLabel(p.storage_mb),
                  t.asks(p.monthly_ask_limit),
                ]
                if (p.allow_versions) features.push(t.versioning)
                if (p.allow_departments) features.push(t.departments)
                if (p.allow_custom_llm) features.push(t.byoKey)
                return (
                  <PlanCard
                    key={p.id}
                    plan={p}
                    tagline={copy.tagline}
                    blurb={copy.blurb}
                    features={features}
                    featured={copy.highlight}
                    badge={copy.highlight ? t.bestValue : undefined}
                    fromLabel={p.name === 'Enterprise' ? t.fromLabel : undefined}
                    perMonthLabel={t.perMonth}
                    ctaLabel={copy.cta === 'contact' ? t.contactUs : t.getStarted}
                    ctaKind={copy.cta}
                  />
                )
              })}
        </div>
        <p className="mt-5 text-[11px] text-muted-foreground">
          {!live && `${t.fallbackNote} `}
          {t.customNote}{' '}
          <a href="mailto:hello@openvault.site" className="text-foreground underline underline-offset-4">
            {t.talkToUs}
          </a>
          .
        </p>
      </section>

      <section className="border-y border-border bg-surface/35 py-16 sm:py-20" aria-label="Coverage">
        <div className="container-page">
          <Reveal>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <h2 className="display-md max-w-xl">
                {t.coverTitle.split(' ').slice(0, -1).join(' ')}{' '}
                <span className="serif text-accent">{t.coverTitle.split(' ').slice(-1)}</span>
              </h2>
              <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                {t.coverNote}
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {t.cover.map((item, i) => {
              const Icon = coverIcons[i] ?? ShieldCheck
              return (
                <Reveal key={item.title} delay={i * 70}>
                  <article className="border-t border-border pt-5">
                    <span className="grid size-9 place-items-center rounded-full border border-border text-accent">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <h3 className="mt-5 text-[13.5px] font-medium">{item.title}</h3>
                    <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">{item.body}</p>
                  </article>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20" aria-labelledby="math-title">
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <p className="eyebrow">{t.mathEyebrow}</p>
              <h2 id="math-title" className="display-md mt-4">
                {t.mathTitle.split(' ')[0]}{' '}
                <span className="serif text-accent">{t.mathTitle.split(' ').slice(1).join(' ')}</span>
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground lg:pt-8">
              {t.mathBody}
            </p>
          </div>
        </Reveal>
      </section>

      <section className="container-page pb-16 sm:pb-20" aria-label="Frequently asked questions">
        <div className="border-t border-border pt-10">
          <h2 className="display-md max-w-lg">
            {t.faqTitle.split(' ')[0]}{' '}
            <span className="serif text-accent">{t.faqTitle.split(' ').slice(1).join(' ')}</span>
          </h2>
          <div className="mt-8 grid gap-x-12 gap-y-7 sm:grid-cols-2">
            {t.faq.map((item) => (
              <article key={item.q} className="border-t border-border pt-4">
                <h3 className="text-[13.5px] font-medium leading-snug">{item.q}</h3>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#151412] text-[#f3efe5]" aria-labelledby="pricing-cta">
        <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 opacity-[0.1]" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-28 top-1/2 size-[32rem] -translate-y-1/2 rounded-full border border-white/10"
        >
          <div className="absolute inset-10 rounded-full border border-white/10" />
          <div className="absolute inset-24 rounded-full border border-[#d9a75f]/25" />
          <div className="absolute inset-[8.25rem] grid place-items-center rounded-full bg-[#d9a75f]/10">
            <div className="size-3 rounded-full bg-[#d9a75f]" />
          </div>
        </div>
        <div className="container-page relative py-16 sm:py-20">
          <Reveal>
            <div className="max-w-2xl">
              <h2 id="pricing-cta" className="display-lg">
                {t.ctaTitle.split(' ')[0]}{' '}
                <span className="serif text-[#d9a75f]">{t.ctaTitle.split(' ').slice(1).join(' ')}</span>
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#f3efe5]/55">{t.ctaBody}</p>
              <Link
                href="/enterprise?tab=create"
                className="btn mt-7 bg-[#f3efe5] text-[#171511] hover:bg-[#d9a75f] hover:text-[#1a1205]"
              >
                {t.ctaButton} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
