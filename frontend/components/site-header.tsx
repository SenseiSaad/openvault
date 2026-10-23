'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Logo } from './logo'
import { ThemeToggle } from './theme-toggle'

const NAV = [
  { href: '/#system', label: 'Platform', anchor: '#system' },
  { href: '/#how-it-works', label: 'How it works', anchor: '#how-it-works' },
  { href: '/#security', label: 'Security', anchor: '#security' },
  { href: '/infrastructure', label: 'Infrastructure' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
]

export function SiteHeader() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const firstLinkRef = useRef<HTMLAnchorElement>(null)
  const currentLinkRef = useRef<HTMLAnchorElement>(null)

  const active = (href: string) =>
    !href.includes('#') && (pathname === href || pathname.startsWith(href + '/'))
  const currentPageItem = NAV.find((item) => active(item.href))
  const currentPageLabel = currentPageItem?.label ?? (pathname === '/' ? 'Home' : 'OpenVault')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    const onResize = () => {
      if (window.innerWidth >= 1024) setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    const initialFocus = currentLinkRef.current ?? firstLinkRef.current
    initialFocus?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
    }
  }, [menuOpen])

  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <header
        className={`sticky top-0 z-50 transition-colors duration-300 ${
          scrolled || menuOpen
            ? 'border-b border-border bg-background/85 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="container-page flex h-[4.5rem] items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo />
            {currentPageItem && (
              <span className="flex min-w-0 items-center gap-2 border-l border-border pl-3 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:text-[10px] lg:hidden">
                <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span className="truncate">{currentPageItem.label}</span>
              </span>
            )}
          </div>

          <nav aria-label="Main navigation" className="hidden items-center gap-6 lg:flex xl:gap-7">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="nav-link"
                data-active={active(item.href)}
                aria-current={active(item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            {user ? (
              <>
                <button
                  onClick={logout}
                  className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
                >
                  Log out
                </button>
                <Link href="/workspace" className="btn btn-primary btn-sm hidden sm:inline-flex">
                  Open workspace <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </>
            ) : (
              <>
                <Link href="/enterprise?role=employee" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:block">
                  Sign in
                </Link>
                <Link href="/enterprise?tab=create" className="btn btn-primary btn-sm hidden sm:inline-flex">
                  Get started <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </>
            )}

            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="grid size-9 place-items-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-2 lg:hidden"
              aria-label={
                menuOpen
                  ? 'Close navigation menu'
                  : `Open navigation menu. Current page: ${currentPageLabel}`
              }
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
            >
              {menuOpen ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div
          id="mobile-navigation"
          className="fixed inset-x-0 top-[4.5rem] z-40 flex h-[calc(100dvh-4.5rem)] flex-col border-t border-border bg-background lg:hidden"
        >
          <nav aria-label="Mobile navigation" className="container-page flex flex-1 flex-col gap-1 overflow-y-auto py-6">
            <div className="mb-2 border-b border-border pb-5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Current page
              </p>
              <p className="mt-1 text-lg font-medium tracking-[-0.025em]">{currentPageLabel}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Choose a destination. Links open in this tab.
              </p>
            </div>

            {NAV.map((item, index) => {
              const isCurrent = active(item.href)
              return (
                <Link
                  key={item.href}
                  ref={isCurrent ? currentLinkRef : index === 0 ? firstLinkRef : undefined}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`group flex items-center justify-between border-b border-border py-4 text-[1.35rem] font-medium tracking-[-0.035em] text-foreground ${
                    isCurrent
                      ? 'border-l-2 border-l-accent bg-surface/60 pl-3'
                      : 'pl-1'
                  }`}
                >
                  <span>{item.label}</span>
                  {isCurrent ? (
                    <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-accent">
                      You are here
                    </span>
                  ) : (
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden />
                  )}
                </Link>
              )
            })}

            <div className="mt-auto pt-8">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Appearance</p>
                <ThemeToggle variant="segmented" />
              </div>

              <div className="mt-5 flex flex-col gap-2.5">
                {user ? (
                  <>
                    <Link href="/workspace" onClick={() => setMenuOpen(false)} className="btn btn-primary w-full">
                      Open workspace <ArrowRight className="size-4" aria-hidden />
                    </Link>
                    <button onClick={() => { logout(); setMenuOpen(false) }} className="btn btn-secondary w-full">
                      <LogOut className="size-4" aria-hidden /> Log out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/enterprise?tab=create" onClick={() => setMenuOpen(false)} className="btn btn-primary w-full">
                      Create your organization <ArrowRight className="size-4" aria-hidden />
                    </Link>
                    <Link href="/enterprise?role=employee" onClick={() => setMenuOpen(false)} className="btn btn-secondary w-full">
                      Sign in to your workspace
                    </Link>
                  </>
                )}
              </div>
              <p className="mt-5 pb-4 text-xs leading-relaxed text-muted-foreground">
                Private by default. No public library, no free-user browsing.
              </p>
            </div>
          </nav>
        </div>
      )}
    </>
  )
}

export default SiteHeader
