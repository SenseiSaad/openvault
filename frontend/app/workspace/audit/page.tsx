'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Clock,
  Fingerprint,
  Loader2,
  RefreshCw,
  ScrollText,
  Search,
  Shield,
  Users,
  X,
} from 'lucide-react'
import { adminApi, type AuditRow } from '@/lib/api'
import { useAuth } from '@/lib/auth'

// Shared keyboard focus treatment, matching the rest of OpenVault.
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f6f2]'

// Badge tints rotate deterministically per action string, so a given action
// always reads in the same colour; destructive/failed actions force red.
const BADGE_TINTS: { bg: string; text: string }[] = [
  { bg: '#dfe7f7', text: '#35507e' }, // blue
  { bg: '#f5f0ff', text: '#574a86' }, // purple
  { bg: '#fff8ea', text: '#8a6316' }, // amber
  { bg: '#e3f0e6', text: '#3a6b49' }, // green
  { bg: '#eef0f2', text: '#55565a' }, // neutral
]
const ERROR_TINT = { bg: '#fbe4e0', text: '#9a3b2c' }

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function actionTint(action: string): { bg: string; text: string } {
  if (/delete|remove|revoke|denied|deny|fail|error|disable/.test(action.toLowerCase())) return ERROR_TINT
  return BADGE_TINTS[hashString(action) % BADGE_TINTS.length]
}

// created_at → readable local date + time; falls back to the raw string.
function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const actorLabel = (id: number | null): string => (id === null ? 'system' : `#${id}`)

export default function AuditLogPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [actorFilter, setActorFilter] = useState('all')

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const data = await adminApi.audit()
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the audit trail.')
      if (mode === 'initial') setRows([])
    } finally {
      if (mode === 'refresh') setRefreshing(false)
      else setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) load('initial')
  }, [isAdmin, load])

  // Overview metrics describe the full loaded record (up to 200 rows).
  const summary = useMemo(() => {
    const actions = new Set<string>()
    const actors = new Set<number>()
    let hasSystem = false
    let oldest = ''
    let newest = ''
    for (const r of rows) {
      actions.add(r.action)
      if (r.user_id === null) hasSystem = true
      else actors.add(r.user_id)
      if (!oldest || new Date(r.created_at) < new Date(oldest)) oldest = r.created_at
      if (!newest || new Date(r.created_at) > new Date(newest)) newest = r.created_at
    }
    return { total: rows.length, actions: actions.size, actors: actors.size, hasSystem, oldest, newest }
  }, [rows])

  const actionOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.action))).sort((a, b) => a.localeCompare(b)),
    [rows],
  )
  const actorOptions = useMemo(
    () =>
      Array.from(new Set(rows.filter((r) => r.user_id !== null).map((r) => r.user_id as number))).sort(
        (a, b) => a - b,
      ),
    [rows],
  )

  // All filtering is client-side over the loaded rows; result stays newest-first.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((r) => {
        if (actionFilter !== 'all' && r.action !== actionFilter) return false
        if (actorFilter === 'system' && r.user_id !== null) return false
        if (actorFilter !== 'all' && actorFilter !== 'system' && String(r.user_id) !== actorFilter) return false
        if (q && !`${r.action} ${r.detail} ${r.ip}`.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [rows, search, actionFilter, actorFilter])

  const hasFilters = search.trim() !== '' || actionFilter !== 'all' || actorFilter !== 'all'
  const clearFilters = () => {
    setSearch('')
    setActionFilter('all')
    setActorFilter('all')
  }

  // --- Admin self-guard -----------------------------------------------------
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <div className="rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-8 text-center sm:p-10">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#eef0f2] text-[#55565a]">
            <Shield className="size-6" aria-hidden />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">Admins only</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[#77746c]">
            The audit log is limited to organization administrators. If you need access, ask an
            admin on your team to grant it.
          </p>
          <Link
            href="/workspace"
            className={`mt-6 inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#3c3b37] ${focusRing}`}
          >
            <ArrowLeft className="size-4" aria-hidden /> Back to workspace
          </Link>
        </div>
      </div>
    )
  }

  const selectClass =
    `h-11 appearance-none rounded-xl border border-[#d8d5cc] bg-[#fffdfa] pl-3.5 pr-9 text-sm text-[#1d1d1b] outline-none transition-colors hover:border-[#b8b5ac] focus:border-[#1d1d1b] ${focusRing}`

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">
              Security &amp; compliance
            </p>
            <h1 className="mt-3 flex items-center gap-2.5 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              <ScrollText className="size-7 shrink-0 text-[#1d1d1b]" aria-hidden />
              Audit <span className="font-serif font-normal italic">trail.</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#77746c]">
              The immutable record of who did what across your organization: uploads, downloads,
              logins, member changes, and visibility toggles, newest first.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load('refresh')}
            disabled={loading || refreshing}
            aria-label="Refresh audit log"
            className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[#dcdad3] bg-[#fffdfa] px-4 text-sm font-medium text-[#1d1d1b] transition-colors hover:border-[#1d1d1b] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
          >
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-[#98958c]">
          <Shield className="size-3.5 shrink-0" aria-hidden />
          Read-only, tamper-evident record; entries cannot be edited or deleted.
        </p>
      </header>

      {/* Summary strip */}
      <section aria-label="Audit overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4">
          <div className="flex items-center gap-1.5 text-[#98958c]">
            <ScrollText className="size-3.5" aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Total events</span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-[-0.02em]">{summary.total}</p>
          <p className="mt-0.5 text-xs text-[#98958c]">loaded · max 200</p>
        </div>
        <div className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4">
          <div className="flex items-center gap-1.5 text-[#98958c]">
            <Activity className="size-3.5" aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Actions</span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-[-0.02em]">{summary.actions}</p>
          <p className="mt-0.5 text-xs text-[#98958c]">distinct types</p>
        </div>
        <div className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4">
          <div className="flex items-center gap-1.5 text-[#98958c]">
            <Users className="size-3.5" aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Actors</span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-[-0.02em]">{summary.actors}</p>
          <p className="mt-0.5 text-xs text-[#98958c]">{summary.hasSystem ? 'users + system' : 'distinct users'}</p>
        </div>
        <div className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4">
          <div className="flex items-center gap-1.5 text-[#98958c]">
            <Clock className="size-3.5" aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Time range</span>
          </div>
          <p className="mt-2 text-sm font-medium leading-snug">
            {summary.oldest ? formatDay(summary.oldest) : '-'}
            <span className="text-[#98958c]"> → </span>
            {summary.newest ? formatDay(summary.newest) : '-'}
          </p>
          <p className="mt-0.5 text-xs text-[#98958c]">oldest → newest</p>
        </div>
      </section>

      {/* Toolbar: all filtering is client-side over the loaded rows */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex h-11 flex-1 items-center rounded-xl border border-[#d8d5cc] bg-[#fffdfa] transition-colors focus-within:border-[#1d1d1b]">
          <Search className="pointer-events-none absolute left-3.5 size-4 text-[#8c8a83]" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search audit events by action, detail, or IP"
            placeholder="Search action, detail, or IP…"
            className="h-full w-full rounded-xl bg-transparent pl-10 pr-9 text-sm outline-none placeholder:text-[#aaa8a1]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className={`absolute right-2.5 grid size-6 place-items-center rounded-full text-[#8c8a83] hover:bg-[#efece4] hover:text-[#1d1d1b] ${focusRing}`}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <label htmlFor="action-filter" className="sr-only">Filter by action</label>
            <select id="action-filter" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className={selectClass}>
              <option value="all">All actions</option>
              {actionOptions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#8c8a83]" aria-hidden />
          </div>
          <div className="relative">
            <label htmlFor="actor-filter" className="sr-only">Filter by actor</label>
            <select id="actor-filter" value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} className={selectClass}>
              <option value="all">All actors</option>
              {summary.hasSystem && <option value="system">System</option>}
              {actorOptions.map((id) => <option key={id} value={String(id)}>User #{id}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#8c8a83]" aria-hidden />
          </div>
        </div>
      </section>

      {/* Result count + clear */}
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="text-[#8c8a83]" aria-live="polite">
          {loading
            ? 'Loading…'
            : `Showing ${visible.length} of ${rows.length} ${rows.length === 1 ? 'event' : 'events'}`}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[#74726c] transition-colors hover:text-[#1d1d1b] ${focusRing}`}
          >
            <X className="size-4" /> Clear filters
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-[#fbe4e0] px-4 py-3 text-sm text-[#9a3b2c]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => load('refresh')}
            className="ml-auto shrink-0 font-medium underline underline-offset-2 hover:opacity-80"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-12 text-center text-sm text-[#77746c]">
          <Loader2 className="mx-auto size-5 animate-spin" aria-hidden />
          <p className="mt-3">Loading the audit trail…</p>
        </div>
      ) : rows.length === 0 ? (
        error ? null : (
          <div className="rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-12 text-center">
            <p className="font-serif text-2xl italic">Nothing logged yet.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#98958c]">
              As your team uploads, downloads, and signs in, every action will appear here.
            </p>
          </div>
        )
      ) : visible.length === 0 ? (
        <div className="rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-12 text-center">
          <p className="font-serif text-2xl italic">No events match…</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#98958c]">
            Try a different search term, or clear the filters to see the whole record.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className={`mt-6 inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#3c3b37] ${focusRing}`}
          >
            <X className="size-4" aria-hidden /> Clear filters
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] md:block">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Audit log, newest first</caption>
              <thead>
                <tr className="border-b border-[#e6e3dc] text-xs uppercase tracking-[0.08em] text-[#98958c]">
                  <th scope="col" className="px-4 py-3 font-semibold">Time</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Action</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Detail</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Actor</th>
                  <th scope="col" className="px-4 py-3 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const tint = actionTint(r.action)
                  return (
                    <tr key={r.id} className="border-b border-[#eae7df] align-top last:border-0 hover:bg-[#faf9f5]">
                      <td className="whitespace-nowrap px-4 py-3 text-[#77746c]">
                        <span className="flex items-center gap-1.5">
                          <Clock className="size-3.5 text-[#b0ada4]" aria-hidden />
                          {formatWhen(r.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block rounded-full px-2.5 py-1 text-xs font-medium"
                          style={{ backgroundColor: tint.bg, color: tint.text }}
                        >
                          {r.action}
                        </span>
                      </td>
                      <td className="max-w-[22rem] px-4 py-3 text-[#3f3e3a]">
                        <span className="block truncate" title={r.detail}>{r.detail || '-'}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`font-mono text-xs ${r.user_id === null ? 'text-[#98958c]' : 'text-[#1d1d1b]'}`}>
                          {actorLabel(r.user_id)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[#77746c]">{r.ip || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile stacked cards */}
          <ul className="space-y-3 md:hidden">
            {visible.map((r) => {
              const tint = actionTint(r.action)
              return (
                <li key={r.id} className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-block rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{ backgroundColor: tint.bg, color: tint.text }}
                    >
                      {r.action}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-[#98958c]">
                      <Clock className="size-3" aria-hidden />
                      {formatWhen(r.created_at)}
                    </span>
                  </div>
                  <p className="mt-2.5 break-words text-sm text-[#3f3e3a]">{r.detail || '-'}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#98958c]">
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3" aria-hidden />
                      <span className="font-mono">{actorLabel(r.user_id)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Fingerprint className="size-3" aria-hidden />
                      <span className="font-mono">{r.ip || '-'}</span>
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
