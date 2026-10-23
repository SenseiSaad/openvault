import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { BlueprintSection } from '@/components/infrastructure/blueprint-section'
import { ResilienceSection } from '@/components/infrastructure/resilience-section'
import {
  DataBoundarySection,
  SecurityControlsSection,
} from '@/components/infrastructure/security-boundary-sections'
import { Reveal } from '@/components/reveal'

export const metadata: Metadata = {
  title: 'Deployment infrastructure',
  description:
    'OpenVault launch architecture: AWS Amplify frontend, Render API and data, Cloudflare DNS, and Amazon Bedrock in AWS India.',
}

const FACTS = [
  ['Web', 'AWS Amplify · static export'],
  ['API + data', 'Render · Oregon'],
  ['AI', 'Amazon Bedrock · India profile'],
  ['DNS', 'Cloudflare · custom domains'],
]

export default function InfrastructurePage() {
  return (
    <main id="main-content" className="min-h-screen overflow-x-clip">
      <SiteHeader />

      <section
        className="relative overflow-hidden pb-14 pt-12 sm:pt-16 lg:pb-20 lg:pt-20"
        aria-labelledby="infra-title"
      >
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 -z-10" />
        <div className="container-page">
          <div className="max-w-4xl">
            <p className="animate-fade-up eyebrow" style={{ animationDelay: '80ms' }}>
              Launch infrastructure
            </p>
            <h1
              id="infra-title"
              className="display-xl mt-5 max-w-4xl animate-fade-up"
              style={{ animationDelay: '160ms' }}
            >
              The rails behind
              <br />
              <span className="serif text-accent">the vault.</span>
            </h1>
            <p
              className="mt-7 max-w-2xl animate-fade-up text-[1.02rem] leading-relaxed text-muted-foreground sm:text-lg"
              style={{ animationDelay: '260ms' }}
            >
              OpenVault&apos;s launch setup uses AWS Amplify for the statically exported Next.js
              frontend, Render for the Django API and persistent data, and Amazon Bedrock for
              permission-filtered AI. Cloudflare manages DNS for the custom domains.
            </p>
            <p
              className="mt-4 animate-fade-up font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground"
              style={{ animationDelay: '320ms' }}
            >
              Launch topology · Amplify + Render + Bedrock
            </p>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
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

      <BlueprintSection />
      <ResilienceSection />
      <SecurityControlsSection />
      <DataBoundarySection />

      <section className="container-page pb-16 sm:pb-20">
        <Reveal>
          <div className="flex flex-col gap-6 rounded-xl border border-border bg-surface/70 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
            <div>
              <p className="eyebrow">Next</p>
              <h2 className="display-md mt-3">See the product these rails support.</h2>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Link href="/enterprise?tab=create" className="btn btn-primary">
                Create an organization <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/policy" className="btn btn-secondary">
                Security model
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </main>
  )
}
