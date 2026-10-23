import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Reset your password · OpenVault' },
  description: 'Request a secure password-reset link for your OpenVault workspace account.',
}

export default function ForgotLayout({ children }: { children: React.ReactNode }) {
  return children
}
