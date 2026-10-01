'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowRight,
  Building2,
  Download,
  FileText,
  Globe,
  Layers,
  Loader2,
  Lock,
  Mail,
  Phone,
  ScrollText,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
  adminApi,
  workApi,
  type AuditRow,
  type CompanyProfile,
  type EnterpriseDoc,
  type LlmStatus,
  type User,
} from '@/lib/api'
import { formatDate, titleFromName } from '@/components/doc-card'

export default function WorkspaceOverviewPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [docs, setDocs] = useState<EnterpriseDoc[]>([])
  const [llm, setLlm] = useState<LlmStatus | null>(null)
  const [members, setMembers] = useState<User[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // One fetch for everything the dashboard needs. Admin-only endpoints are
  // called only when the caller is an admin, and their failure is swallowed
  // so the core document view still renders for a non-admin member.
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [docsRes, llmRes] = await Promise.all([
        workApi.documents(),
        workApi.llmStatus().catch(() => null),
      ])
      setDocs(docsRes)
      setLlm(llmRes)

      if (isAdmin) {
        try {
          const [usersRes, auditRes] = await Promise.all([
            adminApi.users(),
            adminApi.audit(),
          ])
          setMembers(usersRes)
          setAudit(auditRes)
        } catch {
          setMembers([])
          setAudit([])
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong loading your workspace.')
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    if (!user) return
    void load()
  }, [user, load])

  const stats = useMemo(() => {
    const total = docs.length
    const published = docs.filter((d) => d.is_public).length
    return {
      total,
      published,
      hidden: total - published,
      downloads: docs.reduce((s, d) => s + (d.downloads || 0), 0),
      chunks: docs.reduce((s, d) => s + (d.num_chunks || 0), 0),
    }
  }, [docs])

  const recent = useMemo(
    () =>
      [...docs]
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        .slice(0, 5),
    [docs],
  )

  const recentAudit = useMemo(() => audit.slice(0, 6), [audit])
  const greetingName = user?.full_name || user?.username || user?.email || 'there'

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#8c8a83]">Overview</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#1d1d1b] sm:text-4xl">
            Welcome back,{' '}
            <span className="font-serif font-normal italic">{greetingName}</span>
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[#77746c]">
            Here&apos;s a snapshot of your company&apos;s knowledge base: documents, downloads, and everything indexed for AI search.
          </p>
        </div>
        <LlmPill llm={llm} loading={loading} />
      </header>

      {error ? (
        <div className="mt-8 rounded-3xl border border-[#f0c8c0] bg-[#fbe4e0] p-6 text-sm text-[#9a3b2c]">
          <p className="font-medium">Couldn&apos;t load your workspace.</p>
          <p className="mt-1 opacity-80">{error}</p>
          <button
            onClick={() => void load()}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#9a3b2c] px-4 py-2 text-xs font-medium text-white transition hover:opacity-90"
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <LoadingState admin={!!isAdmin} />
      ) : (
        <>
          {user?.company ? (
            <CompanyCard
              company={user.company}
              memberCount={isAdmin ? members.length : null}
            />
          ) : null}

          <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={FileText} tint="#dfe7f7" label="Total documents" value={stats.total.toLocaleString()} />
            <StatCard
              icon={Globe}
              tint="#e7e2ff"
              label="Published"
              value={stats.published.toLocaleString()}
              hint={`${stats.hidden.toLocaleString()} private`}
            />
            <StatCard icon={Download} tint="#fff0d3" label="Total downloads" value={stats.downloads.toLocaleString()} />
            <StatCard icon={Layers} tint="#dfe7f7" label="Indexed chunks" value={stats.chunks.toLocaleString()} />
            {isAdmin ? (
              <StatCard icon={Users} tint="#e7e2ff" label="Team members" value={members.length.toLocaleString()} />
            ) : null}
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <RecentUploads docs={recent} />
            {isAdmin ? <RecentActivity rows={recentAudit} /> : null}
          </section>

          <section className="mt-6">
            <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-[#8c8a83]">Quick actions</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ActionCard
                href="/workspace/chat"
                icon={Sparkles}
                title="Ask AI"
                desc="Chat with your knowledge base and get sourced answers."
              />
              <ActionCard
                href="/workspace/documents"
                icon={FileText}
                title="Manage documents"
                desc="Upload, publish, and organise your company files."
              />
              {isAdmin ? (
                <>
                  <ActionCard
                    href="/workspace/members"
                    icon={Users}
                    title="Manage team"
                    desc="Invite teammates and assign their roles."
                  />
                  <ActionCard
                    href="/workspace/audit"
                    icon={ScrollText}
                    title="View audit log"
                    desc="Review every action taken across your company."
                  />
                </>
              ) : null}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function LlmPill({ llm, loading }: { llm: LlmStatus | null; loading: boolean }) {
  if (loading) {
    return (
      <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#e6e3dc] bg-[#fffdfa] px-3.5 py-2 text-xs font-medium text-[#77746c]">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Checking AI…
      </span>
    )
  }
  const online = !!llm?.online
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium ${
        online
          ? 'border-[#cfe3d1] bg-[#e8f2e8] text-[#3f6b45]'
          : 'border-[#e6e3dc] bg-[#f2f0ec] text-[#77746c]'
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${online ? 'bg-[#4a8a5c]' : 'bg-[#b9b6ae]'}`}
        aria-hidden
      />
      {online ? `AI online · ${llm?.model || 'model'}` : 'AI offline'}
    </span>
  )
}

function CompanyCard({
  company,
  memberCount,
}: {
  company: CompanyProfile
  memberCount: number | null
}) {
  const website = company.website?.trim()
  const websiteHref = website
    ? website.startsWith('http')
      ? website
      : `https://${website}`
    : null
  const websiteLabel = website ? website.replace(/^https?:\/\//, '') : null

  const seats =
    company.max_employees == null
      ? 'Unlimited members'
      : memberCount != null
        ? `${memberCount} / ${company.max_employees} members`
        : `Up to ${company.max_employees} members`

  return (
    <section className="mt-8 rounded-3xl border border-[#dcdad3] bg-[#fffdfa] p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f4f2ec]">
          <Building2 className="size-5 text-[#20211f]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[#1d1d1b]">{company.name}</h2>
          <p className="mt-0.5 text-xs uppercase tracking-[0.12em] text-[#98958c]">Company profile</p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2 text-[#4f4d47]">
          <Users className="size-4 shrink-0 text-[#98958c]" aria-hidden />
          <span>{seats}</span>
        </div>
        {websiteHref ? (
          <div className="flex items-center gap-2 text-[#4f4d47]">
            <Globe className="size-4 shrink-0 text-[#98958c]" aria-hidden />
            <a
              href={websiteHref}
              target="_blank"
              rel="noreferrer noopener"
              className="truncate text-[#37589c] transition hover:underline"
            >
              {websiteLabel}
            </a>
          </div>
        ) : null}
        {company.contact_email ? (
          <div className="flex items-center gap-2 text-[#4f4d47]">
            <Mail className="size-4 shrink-0 text-[#98958c]" aria-hidden />
            <a
              href={`mailto:${company.contact_email}`}
              className="truncate transition hover:text-[#1d1d1b]"
            >
              {company.contact_email}
            </a>
          </div>
        ) : null}
        {company.phone ? (
          <div className="flex items-center gap-2 text-[#4f4d47]">
            <Phone className="size-4 shrink-0 text-[#98958c]" aria-hidden />
            <span className="truncate">{company.phone}</span>
          </div>
        ) : null}
      </dl>
    </section>
  )
}

function StatCard({
  icon: Icon,
  tint,
  label,
  value,
  hint,
}: {
  icon: LucideIcon
  tint: string
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-[22px] border border-[#dcdad3] bg-[#fffdfa] p-6">
      <span className="grid size-10 place-items-center rounded-xl" style={{ backgroundColor: tint }}>
        <Icon className="size-5 text-[#20211f]" aria-hidden />
      </span>
      <p className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#1d1d1b]">{value}</p>
      <p className="mt-1 text-sm text-[#74726c]">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-[#98958c]">{hint}</p> : null}
    </div>
  )
}

function VisibilityBadge({ isPublic }: { isPublic: boolean }) {
  return isPublic ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#dfe7f7] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[#2c4a7a]">
      <Globe className="size-3" aria-hidden /> Public
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#efece6] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[#77746c]">
      <Lock className="size-3" aria-hidden /> Private
    </span>
  )
}

function RecentUploads({ docs }: { docs: EnterpriseDoc[] }) {
  return (
    <div className="rounded-3xl border border-[#dcdad3] bg-[#fffdfa] p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#1d1d1b]">Recent uploads</h2>
        <Link
          href="/workspace/documents"
          className="inline-flex items-center gap-1 text-xs text-[#74726c] transition hover:text-[#1d1d1b]"
        >
          View all <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {docs.length ? (
        <ul className="mt-4 divide-y divide-[#eceae3]">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#f4f2ec]">
                <FileText className="size-4 text-[#74726c]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#1d1d1b]">{titleFromName(d.filename)}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-[#98958c]">
                  <span className="truncate">{d.category || 'Uncategorised'}</span>
                  <span aria-hidden>·</span>
                  <span className="shrink-0">{formatDate(d.created_at)}</span>
                </p>
              </div>
              <VisibilityBadge isPublic={d.is_public} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-[#98958c]">No documents yet. Upload your first file to get started.</p>
      )}
    </div>
  )
}

function RecentActivity({ rows }: { rows: AuditRow[] }) {
  return (
    <div className="rounded-3xl border border-[#dcdad3] bg-[#fffdfa] p-6">
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-[#74726c]" aria-hidden />
        <h2 className="text-sm font-semibold text-[#1d1d1b]">Recent activity</h2>
      </div>
      {rows.length ? (
        <ul className="mt-4 divide-y divide-[#eceae3]">
          {rows.map((r) => (
            <li key={r.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-[#f4f2ec] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[#74726c]">
                  {prettyAction(r.action)}
                </span>
                <span className="shrink-0 text-xs text-[#98958c]">{formatDate(r.created_at)}</span>
              </div>
              {r.detail ? <p className="mt-1.5 truncate text-sm text-[#4f4d47]">{r.detail}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-[#98958c]">No activity recorded yet.</p>
      )}
    </div>
  )
}

function prettyAction(action: string) {
  return action.replace(/[._]/g, ' ').trim() || 'activity'
}

function ActionCard({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string
  icon: LucideIcon
  title: string
  desc: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-[22px] border border-[#dcdad3] bg-[#fffdfa] p-5 transition hover:-translate-y-0.5 hover:shadow-sm"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f4f2ec]">
        <Icon className="size-5 text-[#20211f]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-medium text-[#1d1d1b]">
          {title}
          <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[#77746c]">{desc}</p>
      </div>
    </Link>
  )
}

function LoadingState({ admin }: { admin: boolean }) {
  return (
    <div className="animate-pulse">
      <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: admin ? 5 : 4 }).map((_, i) => (
          <div key={i} className="rounded-[22px] border border-[#dcdad3] bg-[#fffdfa] p-6">
            <div className="size-10 rounded-xl bg-[#efece6]" />
            <div className="mt-4 h-7 w-16 rounded bg-[#efece6]" />
            <div className="mt-2 h-3 w-24 rounded bg-[#efece6]" />
          </div>
        ))}
      </section>
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        {Array.from({ length: admin ? 2 : 1 }).map((_, i) => (
          <div key={i} className="rounded-3xl border border-[#dcdad3] bg-[#fffdfa] p-6">
            <div className="h-4 w-32 rounded bg-[#efece6]" />
            <div className="mt-5 space-y-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-[#efece6]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded bg-[#efece6]" />
                    <div className="h-2.5 w-1/3 rounded bg-[#efece6]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
