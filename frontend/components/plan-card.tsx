import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import type { Plan } from '@/lib/api'

export type PlanCardProps = {
  plan: Plan
  tagline: string
  blurb: string
  features: string[]
  ctaLabel: string
  ctaKind?: 'start' | 'contact'
  featured?: boolean
  badge?: string
  fromLabel?: string
  perMonthLabel?: string
  className?: string
}

export function PlanCard({
  plan,
  tagline,
  blurb,
  features,
  ctaLabel,
  ctaKind = 'start',
  featured = false,
  badge,
  fromLabel,
  perMonthLabel = '/month',
  className = '',
}: PlanCardProps) {
  return (
    <article
      className={`relative flex flex-col rounded-[1.1rem] border p-5 transition-colors sm:p-6 ${
        featured
          ? 'border-accent/60 bg-surface ring-1 ring-accent/15'
          : 'border-border bg-surface/60 hover:border-border-strong'
      } ${className}`}
    >
      {badge && (
        <span className="absolute -top-2.5 left-5 rounded-full bg-accent px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-accent-foreground">
          {badge}
        </span>
      )}

      <div>
        <h3 className="text-[1.05rem] font-medium tracking-[-0.02em]">{plan.name}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{tagline}</p>
      </div>

      <div className={fromLabel ? 'mt-4' : 'mt-3'}>
        {fromLabel && (
          <p className="mb-1 text-[9.5px] leading-none tracking-[0.04em] text-muted-foreground">
            {fromLabel}
          </p>
        )}
        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-[1.7rem] font-medium tracking-[-0.045em]">
            PKR {plan.price_pkr.toLocaleString('en-PK')}
          </span>
          <span className="text-[11px] text-muted-foreground">{perMonthLabel}</span>
        </div>
      </div>

      <p className="mt-2 min-h-[2.5rem] text-[11.5px] leading-relaxed text-muted-foreground">{blurb}</p>

      <ul className="mt-5 flex flex-1 flex-col gap-2.5 border-t border-border pt-5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-[11.5px] leading-relaxed">
            <Check className="mt-0.5 size-3 shrink-0 text-accent" aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {ctaKind === 'contact' ? (
        <a
          href="mailto:hello@openvault.site"
          className={`mt-6 ${featured ? 'btn btn-primary w-full' : 'btn btn-secondary w-full'}`}
        >
          {ctaLabel} <ArrowRight className="size-3.5" aria-hidden />
        </a>
      ) : (
        <Link
          href="/enterprise?tab=create"
          className={`mt-6 ${featured ? 'btn btn-primary w-full' : 'btn btn-secondary w-full'}`}
        >
          {ctaLabel} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </article>
  )
}

export default PlanCard
