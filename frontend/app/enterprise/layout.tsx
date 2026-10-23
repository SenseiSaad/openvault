import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Enterprise access',
  description:
    'Sign in to your organization workspace or create a new OpenVault organization. Access is private, permission-aware, and audited by default.',
}

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  return children
}
