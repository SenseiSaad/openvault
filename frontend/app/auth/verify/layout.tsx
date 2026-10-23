import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Verify your email · OpenVault' },
  description: 'Verify the email address attached to your OpenVault workspace account.',
}

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children
}
