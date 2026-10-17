'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import {
  Building2,
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

  if (loading || !isEnterprise || !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f6f2] text-[#6b6862]">
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
    <div className="min-h-screen bg-[#f7f6f2] text-[#1d1d1b]">
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        {/* Sidebar (desktop) / top bar (mobile) */}
        <aside className="lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-[#e6e3dc]">
          <div className="flex flex-col gap-3 px-6 py-5 lg:px-6">
            <Logo />

            {isPlatformAdmin && (
              <div className="rounded-xl border border-[#e2d5bc] bg-[#fbf6ea] p-2.5 text-xs text-[#876527]">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Shield className="size-3.5" />
                  <span>Platform Admin</span>
                </div>
                <div className="mt-2">
                  <label className="text-[10px] uppercase tracking-wider text-[#6b6862] block mb-1">
                    Active Company:
                  </label>
                  <div className="relative">
                    <select
                      value={user.company_id || 0}
                      onChange={(e) => handleSwitchCompany(Number(e.target.value))}
                      disabled={switching}
                      className="w-full appearance-none rounded-lg border border-[#d8d5cc] bg-white py-1.5 pl-2 pr-7 text-xs font-medium text-[#1d1d1b] outline-none"
                    >
                      <option value={0}>All tenants (detached)</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.doc_count} docs)
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-2 size-3.5 text-[#6b6862]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <nav className="flex gap-1 overflow-x-auto px-4 pb-3 no-scrollbar lg:mt-2 lg:flex-col lg:overflow-visible lg:px-4">
            {items.map((n) => {
              const Icon = n.icon
              const on = active(n)
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm transition ${on ? 'bg-[#1d1d1b] text-white' : 'text-[#65645f] hover:bg-white'}`}
                >
                  <Icon className="size-4" /> {n.label}
                </Link>
              )
            })}
          </nav>
          <div className="hidden px-4 lg:mt-auto lg:block">
            <div className="mx-2 my-4 h-px bg-[#e6e3dc]" />
            <div className="rounded-xl bg-white p-3 text-xs">
              <p className="truncate font-medium text-[#1d1d1b]">{user.full_name || user.email}</p>
              <p className="mt-0.5 capitalize text-[#6b6862]">{user.department_name ? `${user.role} · ${user.department_name}` : user.role}</p>
              {/* Reply-language preference: English default, Roman Urdu opt-in. */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Languages className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[#6b6862]" />
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'en' | 'ur')}
                    aria-label="Reply language"
                    className="w-full appearance-none rounded-lg border border-[#d8d5cc] bg-white py-1.5 pl-7 pr-2 text-xs font-medium text-[#1d1d1b] outline-none"
                  >
                    <option value="en">English</option>
                    <option value="ur">Roman Urdu</option>
                  </select>
                </div>
                <ThemeToggle />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Link href="/" className="text-[#65645f] hover:text-[#1d1d1b]">{t('backToLanding')}</Link>
                <button onClick={logout} className="flex items-center gap-1.5 text-[#9a3b2c] hover:opacity-80"><LogOut className="size-3.5" /> {t('logout')}</button>
              </div>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1 px-6 py-6 lg:px-10 lg:py-10">{children}</div>
      </div>
    </div>
  )
}
