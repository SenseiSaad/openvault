import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Early-access pricing',
  description:
    'OpenVault is in early access. USD plans and local payment options are being finalized and will be published before general availability.',
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
