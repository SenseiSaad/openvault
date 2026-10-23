'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles, AlertTriangle, Check, HardDrive, Users, Building2, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { usageApi, type UsageReport } from '@/lib/api'
import { formatPKR, storageLabel, PLAN_COPY } from '@/lib/pricing'

function limitLabel(used: number, remaining: number | null, limit: number | null) {
  if (limit === null) return `${used.toLocaleString()} used · unlimited`
  return `${used.toLocaleString()} used · ${remaining?.toLocaleString() ?? 0} left of ${limit.toLocaleString()}`
}

function pct(used: number, limit: number | null) {
  if (!limit) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

export default function WorkspaceUsagePage() {
  const { user } = useAuth()
  const [data, setData] = useState<UsageReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    usageApi
      .get()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load usage data.'))
      .finally(() => setLoading(false))
  }, [user])

  if (loading) return <main className="text-[#6b6862]"><Loader2 className="size-4 animate-spin" /></main>
  if (error)
    return (
      <main className="mx-auto max-w-5xl pb-10 text-sm text-[#9a3b2c]">
        <p className="font-medium">Couldn&apos;t load your usage.</p>
        <p className="mt-1 opacity-80">{error}</p>
      </main>
    )
  if (!data) return null

  const { plan, usage, upgrades } = data
  const asksLeft = usage.asks.remaining ?? null
  const asksPct = pct(usage.asks.used, asksLeft === null ? null : usage.asks.limit)
  const docsPct = pct(usage.documents.used, usage.documents.limit)
  const storagePct = pct(Math.round(usage.storage.used_mb), usage.storage.limit_mb)
  const membersPct = pct(usage.members.used, usage.members.limit)

  return (
    <div className="mx-auto max-w-5xl pb-10">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#6b6862]">Usage &amp; plan</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#1d1d1b] sm:text-4xl">
          Current plan{' '}
          <span className="font-serif font-normal italic">{plan.name}</span>
        </h1>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-[#6b6862]">
          PKR {formatPKR(plan.price_pkr)}/{plan.billing_period}. Meters reset on the 1st of each month.
        </p>
      </header>

      {/* Meter cards */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <MeterCard
          icon={<Sparkles className="size-5" />}
          title="AI questions"
          subtitle={asksLeft === null ? 'Unlimited asks this month' : `${asksLeft.toLocaleString()} left`}
          pct={asksPct}
          used={limitLabel(usage.asks.used, usage.asks.remaining, usage.asks.limit)}
          tone={asksLeft !== null && asksLeft <= 10 ? 'danger' : 'normal'}
        />
        <MeterCard
          icon={<HardDrive className="size-5" />}
          title="Storage"
          subtitle={`${usage.storage.used_mb.toLocaleString()} MB used`}
          pct={storagePct}
          used={storageLabel(usage.storage.limit_mb)}
          tone={storagePct === 100 ? 'danger' : storagePct > 80 ? 'warning' : 'normal'}
        />
        <MeterCard
          icon={<Building2 className="size-5" />}
          title="Documents"
          subtitle={usage.documents.remaining != null ? `${usage.documents.remaining.toLocaleString()} slots left` : 'No cap'}
          pct={docsPct}
          used={limitLabel(usage.documents.used, usage.documents.remaining, usage.documents.limit)}
        />
        <MeterCard
          icon={<Users className="size-5" />}
          title="Team members"
          subtitle={usage.members.remaining != null ? `${usage.members.remaining.toLocaleString()} seats left` : 'No cap'}
          pct={membersPct}
          used={limitLabel(usage.members.used, usage.members.remaining, usage.members.limit)}
        />
      </section>

      {/* Plan features + upgrade */}
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-6 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6b6862]">What this plan includes</h2>
          <ul className="mt-4 space-y-2.5 text-sm text-[#4f4d47]">
            <PlanFeature enabled={plan.allow_departments} label="Departments" />
            <PlanFeature enabled={plan.allow_versions} label="Document versioning" />
            <PlanFeature enabled={plan.allow_custom_llm} label="Bring-your-own AI key" />
          </ul>
          {plan.allow_departments && <p className="mt-3 text-xs text-[#6b6862]">{usage.departments.used} department(s) created.</p>}
        </div>

        <div className="rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-6 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6b6862]">Upgrade</h2>
          {upgrades.length ? (
            <ul className="mt-4 space-y-3">
              {upgrades.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#eae7df] bg-[#faf8f3] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1d1d1b]">{u.name}</p>
                    <p className="text-xs text-[#74726c]">{PLAN_COPY[u.name]?.blurb ?? 'More capacity.'}</p>
                  </div>
                  <a
                    href={`mailto:hello@openvault.site?subject=${encodeURIComponent(`Upgrade to ${u.name}`)}`}
                    className="inline-flex items-center gap-1 rounded-full bg-[#1d1d1b] px-4 py-2 text-xs font-medium text-white hover:bg-[#3c3b37]"
                  >
                    {formatPKR(u.price_pkr)}/mo <ArrowUpRight className="size-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-[#6b6862]">
              You&apos;re on our top tier. For custom capacity, write to{' '}
              <a className="text-[#37589c] underline" href="mailto:hello@openvault.site">hello@openvault.site</a>.
            </p>
          )}
          <p className="mt-4 border-t border-[#f0ede6] pt-3 text-xs leading-relaxed text-[#8c8a83]">
            Upgrades are activated manually by our team after payment via bank transfer,
            JazzCash, or Easypaisa — your limits go up the same business day. See full
            breakdown on the{' '}
            <Link href="/pricing" className="text-[#37589c] underline">pricing page</Link>.
          </p>
        </div>
      </section>
    </div>
  )
}

function MeterCard({ icon, title, subtitle, pct, used, tone = 'normal' }: { icon: React.ReactNode; title: string; subtitle: string; pct: number; used: string; tone?: 'normal' | 'warning' | 'danger' }) {
  const barColor = tone === 'danger' ? 'bg-[#c0563f]' : tone === 'warning' ? 'bg-[#d6a545]' : 'bg-[#1d1d1b]'
  const dotColor = tone === 'danger' ? 'text-[#c0563f]' : tone === 'warning' ? 'text-[#d6a545]' : 'text-[#4a8a5c]'
  return (
    <div className="rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-6 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-[#f4f2ec] text-[#20211f]">{icon}</span>
        <p className="text-sm font-semibold text-[#1d1d1b]">{title}</p>
      </div>
      <p className={`mt-4 flex items-center gap-1.5 text-xs ${dotColor}`}>
        {tone === 'danger' && <AlertTriangle className="size-3.5" />}
        {tone === 'warning' && <AlertTriangle className="size-3.5" />}
        {tone === 'normal' && <Check className="size-3.5" />}
        {subtitle}
      </p>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#efece6]">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-[11px] text-[#8c8a83]">{used}</p>
    </div>
  )
}

function PlanFeature({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2.5">
      {enabled ? (
        <span className="grid size-5 place-items-center rounded-full bg-[#e8f2e8] text-[#3f6b45]"><Check className="size-3" /></span>
      ) : (
        <span className="grid size-5 place-items-center rounded-full bg-surface-2 text-muted-foreground"><span className="size-1 rounded-full" /></span>
      )}
      <span className={enabled ? '' : 'text-muted-foreground'}>{label}</span>
    </li>
  )
}
