'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowRight,
  Building2,
  Check,
  Download,
  FileText,
  Globe,
  Layers,
  Loader2,
  Lock,
  Mail,
  Megaphone,
  Phone,
  Plus,
  ScrollText,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import {
  adminApi,
  analyticsApi,
  companyApi2,
  workApi,
  type Analytics,
  type Announcement,
  type AuditRow,
  type CompanyProfile,
  type EnterpriseDoc,
  type LlmStatus,
  type User,
} from '@/lib/api'
import { formatDate, titleFromName } from '@/lib/utils'
import { toast } from '@/components/toaster'
import { t } from '@/lib/i18n'

export default function WorkspaceOverviewPage() {
  const { user, language } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [docs, setDocs] = useState<EnterpriseDoc[]>([])
  const [llm, setLlm] = useState<LlmStatus | null>(null)
  const [members, setMembers] = useState<User[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // New announcement modal
  const [showAnnounceModal, setShowAnnounceModal] = useState(false)
  const [announceTitle, setAnnounceTitle] = useState('')
  const [announceBody, setAnnounceBody] = useState('')
  const [postingAnnounce, setPostingAnnounce] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [docsRes, llmRes, announceRes] = await Promise.all([
        workApi.documents(1, 50),
        workApi.llmStatus().catch(() => null),
        companyApi2.announcements().catch(() => []),
      ])
      setDocs(docsRes.results || [])
      setLlm(llmRes)
      setAnnouncements(announceRes)

      if (isAdmin) {
        try {
          const [usersRes, auditRes, analyticsRes] = await Promise.all([
            adminApi.users(),
            adminApi.audit(1, 10),
            analyticsApi.get(30).catch(() => null),
          ])
          setMembers(usersRes)
          setAudit(auditRes.results || [])
          setAnalytics(analyticsRes)
        } catch {
          setMembers([])
          setAudit([])
          setAnalytics(null)
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

  async function onPostAnnouncement(e: React.FormEvent) {
    e.preventDefault()
    if (!announceTitle.trim() || !announceBody.trim()) return
    setPostingAnnounce(true)
    try {
      const created = await companyApi2.addAnnouncement({
        title: announceTitle.trim(),
        body: announceBody.trim(),
      })
      setAnnouncements((prev) => [created, ...prev])
      setAnnounceTitle('')
      setAnnounceBody('')
      setShowAnnounceModal(false)
      toast.success('Announcement broadcasted.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not post announcement.')
    } finally {
      setPostingAnnounce(false)
    }
  }

  async function onDeleteAnnouncement(id: number) {
    try {
      await companyApi2.removeAnnouncement(id)
      setAnnouncements((prev) => prev.filter((a) => a.id !== id))
      toast.success('Announcement removed.')
    } catch {
      toast.error('Could not remove announcement.')
    }
  }

  const stats = useMemo(() => {
    const total = docs.length
    const restricted = docs.filter((d) => d.access_scope === 'restricted').length
    return {
      total,
      restricted,
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
    <div className="mx-auto max-w-5xl pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#6b6862]">Overview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#1d1d1b] sm:text-4xl">
            {t('welcomeBack', language)}{' '}
            <span className="font-serif font-normal italic">{greetingName}</span>
          </h1>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-[#6b6862]">
            Here&apos;s a snapshot of your company&apos;s knowledge base: documents, downloads, and AI search activity.
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

          {/* Quick Stats Grid */}
          <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { icon: FileText, tint: '#dfe7f7', label: 'Total documents', value: stats.total.toLocaleString() },
              { icon: Lock, tint: '#fff0d3', label: 'Restricted files', value: stats.restricted.toLocaleString(), hint: `${(stats.total - stats.restricted).toLocaleString()} company-wide` },
              { icon: Download, tint: '#fff0d3', label: 'Total downloads', value: stats.downloads.toLocaleString() },
              { icon: Layers, tint: '#dfe7f7', label: 'Indexed chunks', value: stats.chunks.toLocaleString() },
              ...(isAdmin ? [{ icon: Users, tint: '#e7e2ff', label: 'Team members', value: members.length.toLocaleString() }] : []),
            ].map((data, i) => (
              <StatCard key={data.label} {...data} index={i} />
            ))}
          </section>

          {/* Analytics Cards (Admin) */}
          {isAdmin && analytics && (
            <section className="mt-6 rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-6 shadow-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-[#6b6862]" />
                  <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6b6862]">
                    AI Analytics &amp; Usage (Past 30 Days)
                  </h2>
                </div>
                <span className="text-[11px] text-[#6b6862]">
                  Avg Response Latency: {Math.round(analytics.totals.avg_latency_ms || 0)}ms
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-2xl border border-[#eae7df] bg-[#faf8f3] p-3.5">
                  <p className="text-[11px] text-[#6b6862]">Total Asks</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-[#1d1d1b]">
                    {analytics.totals.asks}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#eae7df] bg-[#faf8f3] p-3.5">
                  <p className="text-[11px] text-[#6b6862]">Unanswered</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-[#9a3b2c]">
                    {analytics.totals.unanswered}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#eae7df] bg-[#faf8f3] p-3.5">
                  <p className="text-[11px] text-[#6b6862]">Policy Flags</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-[#8a6316]">
                    {analytics.totals.flagged}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#eae7df] bg-[#faf8f3] p-3.5">
                  <p className="text-[11px] text-[#6b6862]">Satisfaction</p>
                  <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
                    <span className="text-[#3f6b45]">👍 {analytics.ratings.up}</span>
                    <span className="text-[#9a3b2c]">👎 {analytics.ratings.down}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#eae7df] bg-[#faf8f3] p-3.5">
                  <p className="text-[11px] text-[#6b6862]">This Month&apos;s Asks</p>
                  <p className="mt-1 text-base font-bold text-[#1d1d1b]">
                    {analytics.usage.asks_this_month} /{' '}
                    {analytics.usage.monthly_ask_limit ? analytics.usage.monthly_ask_limit.toLocaleString() : '∞'}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Announcements Section */}
          <section className="mt-6 rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#f0ede6] pb-4">
              <div className="flex items-center gap-2">
                <Megaphone className="size-4 text-[#1d1d1b]" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6b6862]">
                  {t('announcements', language)}
                </h2>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowAnnounceModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1d1d1b] px-3.5 py-1 text-xs font-medium text-white hover:bg-[#3c3b37]"
                >
                  <Plus className="size-3" /> Post Announcement
                </button>
              )}
            </div>

            <div className="mt-4">
              {announcements.length === 0 ? (
                <p className="text-xs text-[#8c8a83]">{t('noAnnouncements', language)}</p>
              ) : (
                <ul className="space-y-3">
                  {announcements.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-[#eae7df] bg-[#faf8f3] p-4 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#1d1d1b]">{a.title}</p>
                        <p className="mt-1 leading-relaxed text-[#4f4d47] whitespace-pre-wrap">{a.body}</p>
                        <p className="mt-2 text-[10px] text-[#8c8a83]">
                          {a.created_by_name ? `By ${a.created_by_name} · ` : ''}
                          {formatDate(a.created_at)}
                        </p>
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => onDeleteAnnouncement(a.id)}
                          className="rounded p-1 text-[#9a3b2c] hover:bg-[#fbe4e0]"
                          title="Delete announcement"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {isAdmin ? (
            <section className="mt-6 rounded-3xl border border-[#d6dfef] bg-[#f0f4fb] p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white shadow-sm">
                  <ShieldCheck className="size-5 text-[#2b4c7e]" aria-hidden />
                </span>
                <h2 className="text-sm font-semibold text-[#1d1d1b]">CPA & Audit Readiness</h2>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="flex gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-[#2b4c7e]" />
                  <div>
                    <p className="text-sm font-medium text-[#1d1d1b]">Evidence by document</p>
                    <p className="text-xs text-[#5c7299]">every file is owned by one company</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-[#2b4c7e]" />
                  <div>
                    <p className="text-sm font-medium text-[#1d1d1b]">Role-aware access</p>
                    <p className="text-xs text-[#5c7299]">restricted files only visible to named people</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-[#2b4c7e]" />
                  <div>
                    <p className="text-sm font-medium text-[#1d1d1b]">Share and revoke logs</p>
                    <p className="text-xs text-[#5c7299]">every share/unshare is recorded</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-[#2b4c7e]" />
                  <div>
                    <p className="text-sm font-medium text-[#1d1d1b]">Audit-ready activity</p>
                    <p className="text-xs text-[#5c7299]">complete activity trail for admins</p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <RecentUploads docs={recent} />
            {isAdmin ? <RecentActivity rows={recentAudit} /> : null}
          </section>

          <section className="mt-6">
            <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-[#6b6862]">Quick actions</h2>
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
                desc="Upload files and choose company-wide, department, or restricted access."
              />
              <ActionCard
                href="/workspace/documents"
                icon={Lock}
                title="Access controls"
                desc="Upload files as company-wide or restrict to named people or specific departments."
              />
              <ActionCard
                href="/workspace/shared"
                icon={Share2}
                title="Shared with me"
                desc="View documents that other companies have specifically shared with you."
              />
              <ActionCard
                href="/workspace/documents"
                icon={Share2}
                title="Share with a partner"
                desc="Use a registered company code to grant one employee access to one file."
              />
              <ActionCard
                href="/workspace/audit"
                icon={ShieldCheck}
                title="CPA evidence trail"
                desc="Review the activity record for uploads, shares, downloads, and member changes."
              />
              {isAdmin ? (
                <>
                  <ActionCard
                    href="/workspace/members"
                    icon={Users}
                    title="Manage team"
                    desc="Invite teammates and assign their roles and departments."
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

      {/* Post Announcement Modal */}
      {showAnnounceModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={() => setShowAnnounceModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#eae7df] pb-3">
              <h2 className="text-sm font-semibold text-[#1d1d1b]">Post Announcement</h2>
              <button
                type="button"
                onClick={() => setShowAnnounceModal(false)}
                className="rounded-lg p-1 text-[#6b6862] hover:bg-[#efece4]"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={onPostAnnouncement} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#1d1d1b]">Title</label>
                <input
                  required
                  value={announceTitle}
                  onChange={(e) => setAnnounceTitle(e.target.value)}
                  placeholder="e.g. Office Closed on Friday"
                  className="h-11 w-full rounded-xl border border-[#d8d5cc] bg-white px-3.5 text-xs outline-none focus:border-[#1d1d1b]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#1d1d1b]">Message</label>
                <textarea
                  required
                  rows={4}
                  value={announceBody}
                  onChange={(e) => setAnnounceBody(e.target.value)}
                  placeholder="Write the company-wide announcement body…"
                  className="w-full resize-none rounded-xl border border-[#d8d5cc] bg-white p-3 text-xs outline-none focus:border-[#1d1d1b]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAnnounceModal(false)}
                  className="rounded-full border border-[#dcdad3] px-4 py-2 text-xs font-medium text-[#6b6862] hover:bg-[#efece4]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={postingAnnounce}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1d1d1b] px-5 py-2 text-xs font-medium text-white hover:bg-[#3c3b37] disabled:opacity-50"
                >
                  {postingAnnounce ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function LlmPill({ llm, loading }: { llm: LlmStatus | null; loading: boolean }) {
  if (loading) {
    return (
      <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#e6e3dc] bg-[#fffdfa] px-3.5 py-2 text-xs font-medium text-[#6b6862]">
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
          : 'border-[#e6e3dc] bg-[#f2f0ec] text-[#6b6862]'
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
          <p className="mt-0.5 text-xs uppercase tracking-[0.12em] text-[#6b6862]">Company profile</p>
          <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#f0ede5] px-3 py-1 text-xs font-semibold tracking-[0.16em] text-[#4f4d47]">
            Company code <span className="font-mono">{company.access_code || '—'}</span>
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2 text-[#4f4d47]">
          <Users className="size-4 shrink-0 text-[#6b6862]" aria-hidden />
          <span>{seats}</span>
        </div>
        {websiteHref ? (
          <div className="flex items-center gap-2 text-[#4f4d47]">
            <Globe className="size-4 shrink-0 text-[#6b6862]" aria-hidden />
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
            <Mail className="size-4 shrink-0 text-[#6b6862]" aria-hidden />
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
            <Phone className="size-4 shrink-0 text-[#6b6862]" aria-hidden />
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
  index = 0,
}: {
  icon: LucideIcon
  tint: string
  label: string
  value: string
  hint?: string
  index?: number
}) {
  return (
    <div
      className="animate-[fade-in-up_0.5s_ease-out_both] rounded-[22px] border border-[#dcdad3] bg-[#fffdfa] p-6"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <span className="grid size-10 place-items-center rounded-xl" style={{ backgroundColor: tint }}>
        <Icon className="size-5 text-[#20211f]" aria-hidden />
      </span>
      <p className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#1d1d1b]">{value}</p>
      <p className="mt-1 text-sm text-[#74726c]">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-[#6b6862]">{hint}</p> : null}
    </div>
  )
}

function VisibilityBadge({ scope }: { scope: EnterpriseDoc['access_scope'] }) {
  if (scope === 'restricted') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fff0d3] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[#8a6316]">
        <Lock className="size-3" aria-hidden /> Restricted
      </span>
    )
  }
  if (scope === 'department') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e8edfb] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[#2d529f]">
        <Users className="size-3" aria-hidden /> Department
      </span>
    )
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e6f1e4] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[#4a7a5a]">
      <Users className="size-3" aria-hidden /> Company-wide
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
                <p className="mt-0.5 flex items-center gap-2 text-xs text-[#6b6862]">
                  <span className="truncate">{d.category || 'Uncategorised'}</span>
                  <span aria-hidden>·</span>
                  <span className="shrink-0">{formatDate(d.created_at)}</span>
                </p>
              </div>
              <VisibilityBadge scope={d.access_scope} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-[#6b6862]">No documents yet. Upload your first file to get started.</p>
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
                <span className="shrink-0 text-xs text-[#6b6862]">{formatDate(r.created_at)}</span>
              </div>
              {r.detail ? <p className="mt-1.5 truncate text-sm text-[#4f4d47]">{r.detail}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-[#6b6862]">No activity recorded yet.</p>
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
        <p className="mt-1 text-xs leading-relaxed text-[#6b6862]">{desc}</p>
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
