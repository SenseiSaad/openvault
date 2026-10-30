import Link from 'next/link'
import { ArrowRight, Check, CreditCard, Globe2, ShieldCheck } from 'lucide-react'
import { Reveal } from '@/components/reveal'

const EARLY_ACCESS_POINTS = [
  'Permission-aware AI with source citations',
  'Tenant isolation and per-person access',
  'Audit trail and cross-company sharing',
  'USD plans with local payment options',
]

export function PricingPreview() {
  return (
    <section
      id="pricing"
      className="scroll-mt-24 py-20 sm:py-24 lg:py-28"
      aria-labelledby="pricing-heading"
    >
      <div className="container-page">
        <Reveal>
          <div className="grid gap-8 rounded-[1.25rem] border border-border bg-surface/60 p-6 sm:p-9 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:p-11">
            <div>
              <p className="eyebrow">Pricing</p>
              <h2 id="pricing-heading" className="display-lg mt-5">
                Simple pricing.
                <br />
                <span className="serif text-accent">Coming soon.</span>
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                OpenVault is in early access and will be fully available soon. We are finalizing
                USD plans that cover Bedrock usage, hosting and storage without a large markup,
                with local payment options for Pakistan. Prices will be published before general
                availability.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Globe2 className="size-3.5 text-accent" aria-hidden /> USD pricing
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CreditCard className="size-3.5 text-accent" aria-hidden /> Local payments
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-accent" aria-hidden /> Early-access terms
                </span>
              </div>
              <Link href="/pricing" className="link-arrow mt-6">
                See early-access details <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>

            <div className="rounded-[1rem] border border-border bg-background/60 p-5 sm:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Early access includes
              </p>
              <ul className="mt-4 space-y-3">
                {EARLY_ACCESS_POINTS.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[12px] leading-relaxed">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href="mailto:hello@openvault.site?subject=OpenVault%20early%20access"
                className="btn btn-primary mt-6 w-full"
              >
                Request early access <ArrowRight className="size-3.5" aria-hidden />
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export default PricingPreview
