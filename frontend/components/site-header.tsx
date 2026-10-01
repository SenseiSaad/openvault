'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ArrowRight, Menu, X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Logo } from './logo'
import { AuthDialog } from './auth-dialog'

const NAV = [
  { href: '/discover', label: 'Discover' },
  { href: '/publishers', label: 'Publishers' },
  { href: '/about', label: 'About' },
  { href: '/help', label: 'Help' },
  { href: '/policy', label: 'Policy' },
]

// Shared top navigation for every public page. Auth-aware: shows sign-in
// actions for guests, and the account + workspace shortcuts once signed in.
export function SiteHeader() {
  const { user, isEnterprise, logout } = useAuth()
  const pathname = usePathname()
  const [authOpen, setAuthOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const active = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const displayName = user?.username || user?.full_name || user?.email

  return (
    <>
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-[#65645f] md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={active(n.href) ? 'text-[#1d1d1b]' : 'hover:text-[#1d1d1b]'}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {isEnterprise && (
                <Link href="/workspace" className="hidden rounded-full px-4 py-2 text-sm text-[#65645f] hover:bg-white md:block">Workspace</Link>
              )}
              <Link href="/favorites" className="hidden rounded-full px-4 py-2 text-sm text-[#65645f] hover:bg-white md:block">Favourites</Link>
              <span className="hidden max-w-[12ch] truncate text-sm text-[#65645f] lg:block">Hi, {displayName}</span>
              <button onClick={logout} className="rounded-full bg-[#1d1d1b] px-5 py-2.5 text-sm text-white hover:bg-[#3c3b37]">Log out</button>
            </>
          ) : (
            <>
              <button onClick={() => setAuthOpen(true)} className="hidden rounded-full px-4 py-2 text-sm text-[#65645f] hover:bg-white md:block">Log in</button>
              <button onClick={() => setAuthOpen(true)} className="rounded-full bg-[#1d1d1b] px-5 py-2.5 text-sm text-white hover:bg-[#3c3b37]">Join OpenVault <ArrowRight className="ml-1 inline size-3.5" /></button>
            </>
          )}
          <button onClick={() => setMenuOpen(!menuOpen)} className="ml-1 grid size-10 place-items-center rounded-full border border-[#deddd8] md:hidden" aria-label="Toggle menu" aria-expanded={menuOpen}>
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="mx-6 flex flex-col gap-4 rounded-2xl bg-white p-5 text-sm shadow-sm md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className={active(n.href) ? 'font-medium text-[#1d1d1b]' : 'text-[#65645f]'}>{n.label}</Link>
          ))}
          <div className="h-px bg-[#eae7df]" />
          {user ? (
            <>
              {isEnterprise && <Link href="/workspace" onClick={() => setMenuOpen(false)}>Workspace</Link>}
              <Link href="/favorites" onClick={() => setMenuOpen(false)}>Favourites</Link>
              <button className="text-left text-[#9a3b2c]" onClick={() => { logout(); setMenuOpen(false) }}>Log out</button>
            </>
          ) : (
            <button className="text-left font-medium" onClick={() => { setAuthOpen(true); setMenuOpen(false) }}>Log in / Join OpenVault</button>
          )}
        </div>
      )}

      {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} />}
    </>
  )
}

export default SiteHeader
