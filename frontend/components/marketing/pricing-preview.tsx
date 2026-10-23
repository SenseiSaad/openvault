'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { adminApi, type Plan } from '@/lib/api'
import { FALLBACK_PLANS, PLAN_COPY, storageLabel } from '@/lib/pricing'
import { PlanCard } from '@/components/plan-card'
import { Reveal } from '@/components/reveal'

function featuresFor(plan: Plan) {
  const features = [
    plan.max_members == null ? 'Unlimited members' : `${plan.max_members} members`,
    plan.max_documents == null ? 'Unlimited documents' : `${plan.max_documents} documents`,
    storageLabel(plan.storage_mb),
    plan.monthly_ask_limit == null
      ? 'Unlimited AI questions'
      : `${plan.monthly_ask_limit.toLocaleString('en-PK')} AI questions / month`,
  ]
  if (plan.allow_versions) features.push('File versioning')
  if (plan.allow_departments) features.push('Departments')
  if (plan.allow_custom_llm) features.push('Bring your own AI key')
  return features
}

export function PricingPreview() {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [live, setLive] = useState(true)

  useEffect(() => {
    adminApi
      .plans()
      .then(setPlans)
      .catch(() => {
        setPlans(FALLBACK_PLANS.map((plan, index) => ({ ...plan, id: -(index + 1) })))
        setLive(false)
      })
  }, [])

  return (
    <section id="pricing" className="scroll-mt-24 py-20 sm:py-24 lg:py-28" aria-labelledby="pricing-heading">
      <div className="container-page">
        <Reveal>
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">Pricing</p>
              <h2 id="pricing-heading" className="display-lg mt-5">
                Priced at cost.
                <br />
                <span className="serif text-accent">Not at a markup.</span>
              </h2>
            </div>
            <div className="max-w-sm lg:pb-1">
              <p className="text-sm leading-relaxed text-muted-foreground">
                One monthly price covers hosting, storage, AI usage, and backups. Every limit below
                is enforced by the server, not just printed on this page.
              </p>
              <Link href="/pricing" className="link-arrow mt-4">
                Compare every plan <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy={plans == null}>
          {plans == null
            ? Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-[24rem] animate-pulse rounded-[1.1rem] border border-border bg-surface/60" />
              ))
            : plans.map((plan) => {
                const copy = PLAN_COPY[plan.name] ?? { tagline: '', blurb: '', cta: 'start' as const }
                return (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    tagline={copy.tagline}
                    blurb={copy.blurb}
                    features={featuresFor(plan)}
                    featured={copy.highlight}
                    badge={copy.highlight ? 'Best value' : undefined}
                    fromLabel={plan.name === 'Enterprise' ? 'from' : undefined}
                    ctaLabel={copy.cta === 'contact' ? 'Contact us' : 'Get started'}
                    ctaKind={copy.cta}
                  />
                )
              })}
        </div>

        <div className="mt-6 flex flex-col gap-2 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            Prices in PKR, billed monthly. The free tier needs no card.
            {!live && ' Standard plan catalogue shown — live pricing is temporarily unavailable.'}
          </p>
          <p>Need a custom tenant or on-prem AI? <a className="text-foreground underline underline-offset-4" href="mailto:hello@openvault.site">Talk to us</a>.</p>
        </div>
      </div>
    </section>
  )
}

export default PricingPreview
