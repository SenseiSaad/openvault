import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Hero } from '@/components/marketing/hero'
import { SectorStrip } from '@/components/marketing/sector-strip'
import { SystemSection } from '@/components/marketing/system-section'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { ProductShowcase } from '@/components/marketing/product-showcase'
import { SecuritySection } from '@/components/marketing/security-section'
import { AwsInfrastructure } from '@/components/marketing/aws-infrastructure'
import { PricingPreview } from '@/components/marketing/pricing-preview'
import { FaqSection } from '@/components/marketing/faq-section'
import { FinalCta } from '@/components/marketing/final-cta'

export default function Page() {
  return (
    <main id="main-content" className="min-h-screen overflow-x-clip">
      <SiteHeader />
      <Hero />
      <SectorStrip />
      <SystemSection />
      <HowItWorks />
      <ProductShowcase />
      <SecuritySection />
      <AwsInfrastructure />
      <PricingPreview />
      <FaqSection />
      <FinalCta />
      <SiteFooter />
    </main>
  )
}
