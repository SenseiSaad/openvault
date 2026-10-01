'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { FileText, LayoutDashboard, Loader2, LogOut, ScrollText, Settings, Share2, Sparkles, Users } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Logo } from '@/components/logo'

const NAV = [
  { href: '/workspace', label: 'Overview', icon: LayoutDashboard, adminOnly: false, exact: true },
  { href: '/workspace/chat', label: 'Ask AI', icon: Sparkles, adminOnly: false, exact: false },
  { href: '/workspace/documents', label: 'Documents', icon: FileText, adminOnly: false, exact: false },
  { href: '/workspace/shared', label: 'Shared with me', icon: Share2, adminOnly: false, exact: false },
  { href: '/workspace/members', label: 'Members', icon: Users, adminOnly: true, exact: false },
  { href: '/workspace/audit', label: 'Audit log', icon: ScrollText, adminOnly: true, exact: false },
  { href: '/workspace/settings', label: 'AI settings', icon: Settings, adminOnly: true, exact: false },
]

// Authenticated, tenant-scoped shell for the enterprise workspace. Gates on a
// non-public role client-side and redirects guests to the enterprise sign-in.
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isEnterprise, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !isEnterprise) {
      router.replace('/enterprise?next=' + encodeURIComponent(pathname || '/workspace'))
    }
  }, [loading, isEnterprise, router, pathname])

  if (loading || !isEnterprise || !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f6f2] text-[#77746c]">
        <span className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" /> Loading your workspace…</span>
      </main>
    )
  }

  const isAdmin = user.role === 'admin'
  const items = NAV.filter((n) => !n.adminOnly || isAdmin)
  const active = (n: (typeof NAV)[number]) => (n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(n.href + '/'))

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#1d1d1b]">
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        {/* Sidebar (desktop) / top bar (mobile) */}
        <aside className="lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-[#e6e3dc]">
          <div className="flex items-center justify-between px-6 py-5 lg:px-6">
            <Logo />
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
              <p className="truncate font-medium text-[#1d1d1b]">{user.full_name || user.username || user.email}</p>
              <p className="mt-0.5 capitalize text-[#8c8a83]">{user.role}</p>
              <div className="mt-3 flex flex-col gap-2">
                <Link href="/" className="text-[#65645f] hover:text-[#1d1d1b]">← Back to library</Link>
                <button onClick={logout} className="flex items-center gap-1.5 text-[#9a3b2c] hover:opacity-80"><LogOut className="size-3.5" /> Log out</button>
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
