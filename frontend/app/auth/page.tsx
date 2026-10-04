import Link from 'next/link'
import { ArrowLeft, ArrowRight, Building2, BriefcaseBusiness, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/logo'

const options = [
  { icon: Building2, title: 'Register as enterprise', body: 'Create your organization workspace and become its first employer admin.', href: '/enterprise?tab=create', cta: 'Register organization', dark: true },
  { icon: BriefcaseBusiness, title: 'Login as employee', body: 'Access the documents and AI answers your organization has assigned to you.', href: '/enterprise?role=employee', cta: 'Employee login', dark: false },
  { icon: ShieldCheck, title: 'Login as employer admin', body: 'Manage people, permissions, partner sharing, and compliance activity.', href: '/enterprise?role=admin', cta: 'Admin login', dark: false },
]

export default function AuthPage() {
  return (
    <main className="min-h-screen bg-[#f7f6f2] px-6 py-8 text-[#1d1d1b] lg:px-10">
      <header className="mx-auto flex max-w-6xl items-center justify-between"><Logo /><Link href="/" className="inline-flex items-center gap-2 text-sm text-[#77746c] hover:text-[#1d1d1b]"><ArrowLeft className="size-4" /> Back to landing</Link></header>
      <section className="mx-auto max-w-6xl py-16 sm:py-24"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9b9890]">OpenVault access</p><h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[.95] tracking-[-0.07em] sm:text-7xl">Your company&apos;s knowledge, <span className="font-serif font-normal italic">securely inside.</span></h1><p className="mt-6 max-w-xl text-lg leading-relaxed text-[#77746c]">There is no public library or free-user browsing area. Choose the enterprise path that matches your role.</p><div className="mt-12 grid gap-5 md:grid-cols-3">{options.map(({ icon: Icon, title, body, href, cta, dark }) => <Link key={title} href={href} className={`group rounded-[26px] p-7 transition hover:-translate-y-1 hover:shadow-lg ${dark ? 'bg-[#1d1d1b] text-white' : 'border border-[#dcdad3] bg-[#fffdfa]'}`}><span className={`grid size-11 place-items-center rounded-2xl ${dark ? 'bg-white/10' : 'bg-[#f0ede5]'}`}><Icon className="size-5" aria-hidden /></span><h2 className="mt-12 text-2xl font-semibold tracking-[-0.04em]">{title}</h2><p className={`mt-3 min-h-20 text-sm leading-relaxed ${dark ? 'text-white/60' : 'text-[#77746c]'}`}>{body}</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">{cta}<ArrowRight className="size-4 transition group-hover:translate-x-1" /></span></Link>)}</div></section>
    </main>
  )
}
