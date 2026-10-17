'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BrainCircuit,
  Check,
  Cpu,
  HardDrive,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { adminApi, type Plan } from '@/lib/api'
import { FALLBACK_PLANS, PLAN_COPY, formatPKR, storageLabel } from '@/lib/pricing'
import { PRICING_CONTENT, type PricingLang } from '@/lib/pricing-i18n'

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f6f2]'
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
    <main className="min-h-screen bg-[#f7f6f2] text-[#1d1d1b]">
      <SiteHeader />

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-6 pb-14 pt-12 lg:px-10 lg:pt-16">
        <div className="pointer-events-none absolute left-0 top-0 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-[#dfe7f7] opacity-60 blur-3xl mix-blend-multiply" />
        <div className="pointer-events-none absolute right-10 top-16 -z-10 h-72 w-72 translate-x-1/3 rounded-full bg-[#e7e2ff] opacity-60 blur-3xl mix-blend-multiply" />

        <div className="max-w-3xl">
          <p className="mb-5 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-[#6b6862]">
            <span>{t.eyebrow}</span>
            <button
              type="button"
              onClick={toggleLang}
              className={`rounded-full border border-[#dcdad3] bg-[#fffdfa] px-3 py-1 normal-case tracking-normal text-[#6b6862] transition hover:border-[#1d1d1b] hover:text-[#1d1d1b] ${FOCUS}`}
            >
              {t.langToggle}
            </button>
          </p>
          <h1 className="text-[clamp(2.8rem,6vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.07em]">
            {t.titleA}
            <br />
            <span className="font-serif font-normal italic">{t.titleB}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#5d5b55]">{t.lede}</p>
          {live && plans && (
            <p className="mt-4 flex items-center gap-2 text-xs text-[#6b6862]">
              <Check className="size-3.5 text-[#4a7a5a]" aria-hidden />
              {t.liveNote}
            </p>
          )}
        </div>
      </section>

      {/* Tier cards */}
      <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-10" aria-label="Plans">
        {plans == null ? (
          <p className="flex items-center gap-2 text-sm text-[#6b6862]">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Loading plans…
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((p) => {
              const copy = PLAN_COPY[p.name] ?? {
                tagline: '',
                blurb: '',
                cta: 'start' as const,
              }
              const isEnterprise = p.name === 'Enterprise'
              return (
                <article
                  key={p.id}
                  className={`relative flex flex-col rounded-[26px] border p-7 transition-transform duration-300 hover:scale-[1.015] ${
                    copy.highlight
                      ? 'border-[#1d1d1b] bg-white shadow-sm ring-2 ring-[#1d1d1b]/10'
                      : 'border-[#dcdad3] bg-[#fffdfa]'
                  }`}
                >
                  {copy.highlight && (
                    <span className="absolute -top-3 left-6 rounded-full bg-[#1d1d1b] px-3 py-1 text-[11px] font-semibold text-white">
                      {t.bestValue}
                    </span>
                  )}
                  <h2 className="text-xl font-semibold tracking-[-0.03em]">{p.name}</h2>
                  <p className="mt-1 text-xs text-[#6b6862]">{copy.tagline}</p>

                  <p className="mt-5 text-3xl font-bold tracking-tight">
                    {isEnterprise && (
                      <span className="mr-1.5 text-xs font-medium text-[#6b6862]">{t.fromLabel}</span>
                    )}
                    PKR {formatPKR(p.price_pkr)}
                    <span className="text-sm font-normal text-[#6b6862]">{t.perMonth}</span>
                  </p>
                  <p className="mt-2 min-h-10 text-xs leading-relaxed text-[#5d5b55]">{copy.blurb}</p>

                  <ul className="mt-5 flex-1 space-y-2.5 text-sm text-[#4f4d47]">
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-[#4a7a5a]" aria-hidden />
                      {t.members(p.max_members)}
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-[#4a7a5a]" aria-hidden />
                      {t.docs(p.max_documents)}
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-[#4a7a5a]" aria-hidden />
                      {storageLabel(p.storage_mb)}
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-[#4a7a5a]" aria-hidden />
                      {t.asks(p.monthly_ask_limit)}
                    </li>
                    {p.allow_versions && (
                      <li className="flex items-start gap-2.5">
                        <Check className="mt-0.5 size-4 shrink-0 text-[#4a7a5a]" aria-hidden />
                        {t.versioning}
                      </li>
                    )}
                    {p.allow_departments && (
                      <li className="flex items-start gap-2.5">
                        <Check className="mt-0.5 size-4 shrink-0 text-[#4a7a5a]" aria-hidden />
                        {t.departments}
                      </li>
                    )}
                    {p.allow_custom_llm && (
                      <li className="flex items-start gap-2.5">
                        <Check className="mt-0.5 size-4 shrink-0 text-[#4a7a5a]" aria-hidden />
                        {t.byoKey}
                      </li>
                    )}
                  </ul>

                  {copy.cta === 'contact' ? (
                    <a
                      href="mailto:hello@openvault.site"
                      className={`mt-7 inline-flex items-center justify-center gap-2 rounded-full border border-[#1d1d1b] px-5 py-3 text-sm font-semibold transition hover:bg-[#1d1d1b] hover:text-white ${FOCUS}`}
                    >
                      {t.contactUs} <ArrowRight className="size-4" aria-hidden />
                    </a>
                  ) : (
                    <Link
                      href="/enterprise?tab=create"
                      className={`mt-7 inline-flex items-center justify-center gap-2 rounded-full ${
                        copy.highlight
                          ? 'bg-[#1d1d1b] text-white hover:bg-[#3c3b37]'
                          : 'border border-[#dcdad3] bg-[#fffdfa] hover:border-[#1d1d1b]'
                      } px-5 py-3 text-sm font-semibold transition ${FOCUS}`}
                    >
                      {t.getStarted} <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* What the subscription covers */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10" aria-label="Coverage">
        <h2 className="max-w-xl text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
          {t.coverTitle.split(' ').slice(0, -1).join(' ')}{' '}
          <span className="font-serif font-normal italic">{t.coverTitle.split(' ').slice(-1)}</span>
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {t.cover.map((item, i) => {
            const Icon = coverIcons[i] ?? ShieldCheck
            return (
              <div key={item.title} className="rounded-[26px] border border-[#dcdad3] bg-[#fffdfa] p-6">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#f4f2ec]">
                  <Icon className="size-5 text-[#1d1d1b]" aria-hidden />
                </span>
                <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#6b6862]">{item.body}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* The honest math */}
      <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-10">
        <div className="rounded-[26px] border border-[#dcdad3] bg-[#fffdfa] p-8 sm:p-10">
          <h2 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
            {t.mathTitle.split(' ')[0]}{' '}
            <span className="font-serif font-normal italic">{t.mathTitle.split(' ').slice(1).join(' ')}</span>
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#5d5b55]">{t.mathBody}</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-4xl px-6 pb-20 lg:px-10" aria-label="FAQ">
        <h2 className="text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
          {t.faqTitle.split(' ')[0]}{' '}
          <span className="font-serif font-normal italic">{t.faqTitle.split(' ').slice(1).join(' ')}</span>
        </h2>
        <div className="mt-8 divide-y divide-[#e6e3dc] border-y border-[#e6e3dc]">
          {t.faq.map((item) => (
            <div key={item.q} className="py-5">
              <h3 className="text-sm font-semibold">{item.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#6b6862]">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-7xl px-6 pb-24 lg:px-10">
        <div className="rounded-[26px] bg-[#1d1d1b] p-10 text-white sm:p-14">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
            {t.ctaTitle.split(' ')[0]}{' '}
            <span className="font-serif font-normal italic">{t.ctaTitle.split(' ').slice(1).join(' ')}</span>
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#c9c7c1]">{t.ctaBody}</p>
          <Link
            href="/enterprise?tab=create"
            className={`mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#1d1d1b] transition hover:bg-[#eae7df] ${FOCUS}`}
          >
            {t.ctaButton} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}