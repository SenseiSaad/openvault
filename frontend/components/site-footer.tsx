import Link from 'next/link'
import { Check } from 'lucide-react'
import { Logo } from './logo'

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Platform',
    links: [
      { href: '/about', label: 'About OpenVault' },
      { href: '/help', label: 'How it works' },
      { href: '/policy', label: 'Privacy & security' },
    ],
  },
  {
    title: 'Access',
    links: [
      { href: '/enterprise?role=employee', label: 'Log in' },
      { href: '/enterprise?tab=create', label: 'Get Started' },
    ],
  },
  {
    title: 'Workspace',
    links: [
      { href: '/workspace', label: 'Employer dashboard' },
      { href: '/workspace/documents', label: 'Secure documents' },
      { href: '/workspace/shared', label: 'Shared with me' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-[#e6e3dc] bg-[#f7f6f2] px-6 py-14 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-[#77746c]">
            A private company knowledge system for secure documents, AI assisted answers, cross company collaboration, and CPA ready evidence trails.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">{col.title}</p>
            <ul className="flex flex-col gap-3 text-sm text-[#65645f]">
              {col.links.map((l) => (
                <li key={l.label}><Link href={l.href} className="hover:text-[#1d1d1b]">{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 flex max-w-7xl flex-col justify-between gap-4 border-t border-[#e6e3dc] pt-6 text-xs text-[#89877f] sm:flex-row">
        <span>© 2026 OpenVault. Private by default.</span>
        <span className="flex items-center gap-1.5"><Check className="size-3" /> Built for accountable teams</span>
      </div>
    </footer>
  )
}

export default SiteFooter
