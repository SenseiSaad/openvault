import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Simple, honest pricing for private company knowledge. Every OpenVault plan includes tenant isolation, permission-aware AI, and an audit trail.',
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
