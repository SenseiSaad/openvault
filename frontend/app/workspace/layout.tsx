'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import {
  ChevronDown,
  FileText,
  Gauge,
  Languages,
  LayoutDashboard,
  Loader2,
  LogOut,
  QrCode,
  ScrollText,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { adminApi, type AdminCompany } from '@/lib/api'
import { makeT } from '@/lib/i18n'

// Authenticated, tenant-scoped shell for the enterprise workspace. Gates on a
// signed-in session client-side and redirects guests to the enterprise sign-in.
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isEnterprise, logout, refreshUser, isPlatformAdmin, language, setLanguage } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const t = makeT(language)

  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    if (isPlatformAdmin) {
      adminApi.companies().then(setCompanies).catch(() => setCompanies([]))
    }
  }, [isPlatformAdmin])

  useEffect(() => {
    if (!loading && !isEnterprise) {
      router.replace('/enterprise?next=' + encodeURIComponent(pathname || '/workspace'))
    }
  }, [loading, isEnterprise, router, pathname])

  useEffect(() => {
    const titles: Record<string, string> = {
      '/workspace': 'Overview',
      '/workspace/chat': 'Ask AI',
      '/workspace/documents': 'Documents',
      '/workspace/shared': 'Shared with me',
      '/workspace/attendance': 'Attendance',
      '/workspace/members': 'Members',
      '/workspace/audit': 'Audit log',
      '/workspace/usage': 'Usage & plan',
      '/workspace/settings': 'Settings',
    }
    const key = Object.keys(titles)
      .filter((href) => href !== '/workspace' && pathname.startsWith(href))
      .sort((a, b) => b.length - a.length)[0]
    const section = titles[pathname] ?? (key ? titles[key] : 'Workspace')
    const desired = `${section} · OpenVault`

    // The authenticated shell owns its browser title. Next's metadata manager can
    // overwrite document.title during client navigation, so keep this tab's title
    // stable for as long as the workspace layout is mounted.
    document.title = desired
    let queued = false
    const enforce = () => {
      if (queued) return
      queued = true
      queueMicrotask(() => {
        queued = false
        if (document.title !== desired) document.title = desired
      })
    }
    const observer = new MutationObserver(enforce)
    observer.observe(document.head, { subtree: true, childList: true, characterData: true })
    return () => observer.disconnect()
  }, [pathname])

  if (loading || !isEnterprise || !user) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background text-muted-foreground">
        <span className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" /> {t('loading')}</span>
      </main>
    )
  }

  const isAdmin = user.role === 'admin' || isPlatformAdmin
  const NAV = [
    { href: '/workspace', label: t('overview'), icon: LayoutDashboard, adminOnly: false, exact: true },
    { href: '/workspace/chat', label: t('askAi'), icon: Sparkles, adminOnly: false, exact: false },
    { href: '/workspace/documents', label: t('documents'), icon: FileText, adminOnly: false, exact: false },
    { href: '/workspace/shared', label: t('shared'), icon: Share2, adminOnly: false, exact: false },
    { href: '/workspace/attendance', label: t('attendance'), icon: QrCode, adminOnly: false, exact: false },
    { href: '/workspace/members', label: t('members'), icon: Users, adminOnly: true, exact: false },
    { href: '/workspace/audit', label: t('audit'), icon: ScrollText, adminOnly: true, exact: false },
    { href: '/workspace/usage', label: t('usagePlan'), icon: Gauge, adminOnly: true, exact: false },
    { href: '/workspace/settings', label: t('settings'), icon: Settings, adminOnly: true, exact: false },
  ]
  const items = NAV.filter((n) => !n.adminOnly || isAdmin)
  const active = (n: (typeof NAV)[number]) => (n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(n.href + '/'))

  async function handleSwitchCompany(newCompanyId: number) {
    setSwitching(true)
    try {
      if (newCompanyId === 0) {
        await adminApi.detachCompany()
      } else {
        await adminApi.switchCompany(newCompanyId)
      }
      await refreshUser()
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        {/* Sidebar (desktop) / top bar (mobile) */}
        <aside className="border-b border-border lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-3 px-6 py-5">
            <Logo href="/workspace" />
            <span className="rounded-full border border-border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-muted-foreground lg:hidden">
              Workspace
            </span>
          </div>

          {isPlatformAdmin && (
            <div className="mx-4 mb-3 rounded-xl border border-accent/25 bg-accent-soft p-3 text-xs text-accent lg:mx-4">
              <div className="flex items-center gap-1.5 font-semibold">
                <Shield className="size-3.5" />
                <span>Platform Admin</span>
              </div>
              <div className="mt-2">
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
                  Active Company:
                </label>
                <div className="relative">
                  <select
                    value={user.company_id || 0}
                    onChange={(e) => handleSwitchCompany(Number(e.target.value))}
                    disabled={switching}
                    className="w-full appearance-none rounded-lg border border-border bg-surface py-1.5 pl-2 pr-7 text-xs font-medium text-foreground outline-none focus:border-border-strong"
                  >
                    <option value={0}>All tenants (detached)</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.doc_count} docs)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-2 size-3.5 text-muted-foreground" />
                </div>
              </div>
            </div>
          )}

          <nav aria-label="Workspace" className="flex gap-1 overflow-x-auto px-4 pb-3 no-scrollbar lg:mt-2 lg:flex-col lg:overflow-visible">
            {items.map((n) => {
              const Icon = n.icon
              const on = active(n)
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={on ? 'page' : undefined}
                  className={`flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
                    on
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                  }`}
                >
                  <Icon className="size-4" /> {n.label}
                </Link>
              )
            })}
          </nav>

          {/* Mobile account and appearance controls */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 lg:hidden">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{user.full_name || user.email}</p>
              <p className="mt-0.5 truncate text-[10px] capitalize text-muted-foreground">
                {user.department_name ? `${user.role} · ${user.department_name}` : user.role}
              </p>
            </div>
            <div className="relative">
              <Languages className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'en' | 'ur')}
                aria-label="Reply language"
                className="h-8 appearance-none rounded-lg border border-border bg-surface py-1 pl-7 pr-2 text-[11px] font-medium text-foreground outline-none focus:border-border-strong"
              >
                <option value="en">English</option>
                <option value="ur">Roman Urdu</option>
              </select>
            </div>
            <ThemeToggle variant="segmented" compact />
            <button
              onClick={logout}
              aria-label={t('logout')}
              className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-danger transition-colors hover:bg-danger-soft"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>

          <div className="hidden px-4 pb-5 lg:mt-auto lg:block">
            <div className="mx-2 mb-4 h-px bg-border" />
            <div className="rounded-xl border border-border bg-surface p-3 text-xs">
              <p className="truncate font-medium text-foreground">{user.full_name || user.email}</p>
              <p className="mt-0.5 capitalize text-muted-foreground">
                {user.department_name ? `${user.role} · ${user.department_name}` : user.role}
              </p>
              {/* Reply-language preference: English default, Roman Urdu opt-in. */}
              <div className="mt-3">
                <div className="relative">
                  <Languages className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'en' | 'ur')}
                    aria-label="Reply language"
                    className="w-full appearance-none rounded-lg border border-border bg-surface py-1.5 pl-7 pr-2 text-xs font-medium text-foreground outline-none focus:border-border-strong"
                  >
                    <option value="en">English</option>
                    <option value="ur">Roman Urdu</option>
                  </select>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Appearance</span>
                  <ThemeToggle variant="segmented" compact />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <Link href="/" className="text-muted-foreground hover:text-foreground">{t('backToLanding')}</Link>
                <button onClick={logout} className="flex items-center gap-1.5 text-danger hover:opacity-80">
                  <LogOut className="size-3.5" /> {t('logout')}
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </div>
    </div>
  )
}
