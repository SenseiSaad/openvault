import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Access',
  description:
    'Choose your OpenVault enterprise access path. Register a company, sign in as an employee, or sign in as an employer admin.',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children
}
