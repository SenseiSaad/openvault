'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Filter,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { Reveal } from '@/components/reveal'

const TABS = [
  {
    label: 'Ask with citations',
    short: 'Ask',
    description: 'Answers grounded in the documents each person can access.',
  },
  {
    label: 'Control every file',
    short: 'Files',
    description: 'Scope, version, share, and revoke without leaving the vault.',
  },
  {
    label: 'Prove every action',
    short: 'Audit',
    description: 'A searchable audit trail that stands up to review.',
  },
] as const

const DOCUMENTS = [
  {
    name: 'Employee Handbook 2026.pdf',
    meta: 'People · 2.4 MB · v4',
    category: 'People',
    scope: 'Company-wide',
    tone: 'ok',
    people: '42 people',
    viewers: [
      ['A', 'Areeba · Finance'],
      ['H', 'Hira · People Ops'],
      ['S', 'Saad · Admin'],
    ],
  },
  {
    name: 'Vendor Agreement — Acme.pdf',
    meta: 'Finance · 840 KB · v3',
    category: 'Finance',
    scope: 'Department',
    tone: 'info',
    people: 'Finance · 6 people',
    viewers: [
      ['A', 'Areeba · Finance'],
      ['B', 'Bilal · Legal'],
      ['S', 'Saad · Admin'],
    ],
  },
  {
    name: 'Incident Response Plan.pdf',
    meta: 'Security · 1.1 MB · v3',
    category: 'Security',
    scope: 'Selected',
    tone: 'warn',
    people: '7 named people',
    viewers: [
      ['H', 'Hira · Security'],
      ['S', 'Saad · Admin'],
      ['Z', 'Zain · Executive'],
    ],
  },
  {
    name: 'Board Minutes — Sept.pdf',
    meta: 'Executive · 620 KB',
    category: 'Executive',
    scope: 'Selected',
    tone: 'warn',
    people: '4 named people',
    viewers: [
      ['S', 'Saad · Admin'],
      ['Z', 'Zain · Executive'],
    ],
  },
]

const CATEGORIES = ['All categories', ...Array.from(new Set(DOCUMENTS.map((doc) => doc.category)))]

const AUDIT_ROWS = [
  { event: 'Sign-in', actor: 'saad@northstar.pk', time: '09:41:22', ip: '10.0.0.4', kind: 'auth', tone: 'ok' },
  { event: 'Document uploaded', actor: 'saad@northstar.pk', time: '09:44:08', ip: '10.0.0.4', kind: 'upload', tone: 'accent' },
  { event: 'Access granted', actor: 'Hira S. · People Ops', time: '09:52:41', ip: '10.0.0.9', kind: 'access', tone: 'accent' },
  { event: 'Download blocked', actor: 'Viewer role · no permission', time: '10:03:17', ip: '10.0.0.12', kind: 'blocked', tone: 'danger' },
  { event: 'Document previewed', actor: 'Hira S. · People Ops', time: '10:04:02', ip: '10.0.0.9', kind: 'access', tone: 'ok' },
  { event: 'File downloaded', actor: 'Areeba · Finance', time: '10:11:36', ip: '10.0.0.7', kind: 'access', tone: 'ok' },
  { event: 'Member invited', actor: 'saad@northstar.pk', time: '10:16:12', ip: '10.0.0.4', kind: 'access', tone: 'accent' },
]

const AUDIT_FILTERS = [
  { value: 'all', label: 'All events' },
  { value: 'auth', label: 'Sign-ins' },
  { value: 'access', label: 'Access changes' },
  { value: 'blocked', label: 'Blocked' },
]

type AskKey = 'process' | 'timeline' | 'owner'

const ASK_VARIANTS: Record<
  AskKey,
  {
    chip: string
    question: string
    answer: string
    sources: { name: string; meta: string; relevance: string }[]
    stats: string
    steps?: { day: string; body: string }[]
  }
> = {
  process: {
    chip: 'The full process',
    question: "What's our process for a data subject access request?",
    answer:
      'Log the request within 24 hours, verify identity with two data points, and route it to the Privacy Lead. The statutory response window is 30 days; the team aims to complete verification within three.',
    sources: [
      { name: 'Data Protection Policy.pdf', meta: 'Company-wide · p. 9', relevance: '86' },
      { name: 'DSAR Runbook.pdf', meta: 'People Ops · p. 2', relevance: '74' },
    ],
    stats: '8 documents scanned · 3 passed permission filter · 2 cited',
  },
  timeline: {
    chip: '30-day timeline',
    question: 'Walk me through the 30-day DSAR timeline.',
    answer:
      'The clock starts when the request is logged. Identity must be verified before the response window is used, and the Privacy Lead owns the final response.',
    sources: [
      { name: 'DSAR Runbook.pdf', meta: 'People Ops · p. 2', relevance: '91' },
      { name: 'Data Protection Policy.pdf', meta: 'Company-wide · p. 9', relevance: '82' },
    ],
    stats: '8 documents scanned · 2 passed permission filter · 2 cited',
    steps: [
      { day: 'Day 0', body: 'Log the request and acknowledge within 24 hours.' },
      { day: 'Day 3', body: 'Verify identity with two independent data points.' },
      { day: 'Day 30', body: 'Send the complete response before the deadline.' },
    ],
  },
  owner: {
    chip: 'Who verifies?',
    question: 'Who owns identity verification for a DSAR?',
    answer:
      'The Privacy Lead owns the request. People Ops verifies identity using two data points, then records the verification in the case file. Both actions are visible in the audit trail.',
    sources: [{ name: 'DSAR Runbook.pdf', meta: 'People Ops · p. 2', relevance: '88' }],
    stats: '8 documents scanned · 3 passed permission filter · 1 cited',
  },
}

type MenuOption = { value: string; label: string }

function MiniSelect({
  label,
  value,
  options,
  onChange,
  className = '',
}: {
  label: string
  value: string
  options: MenuOption[]
  onChange: (value: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex w-full items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-2 text-[10px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
      >
        <Filter className="size-3 shrink-0" aria-hidden />
        <span className="truncate">{current?.label ?? value}</span>
        <ChevronDown className={`ml-auto size-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute right-0 top-[calc(100%+0.35rem)] z-30 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-surface-elevated p-1 shadow-xl shadow-black/15"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[11px] text-foreground transition-colors hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
            >
              <span className="flex-1">{option.label}</span>
              {option.value === value && <Check className="size-3 text-accent" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ScopeBadge({ scope, tone }: { scope: string; tone: string }) {
  const styles =
    tone === 'ok'
      ? 'bg-ok-soft text-ok'
      : tone === 'info'
        ? 'bg-info-soft text-info'
        : 'bg-warn-soft text-warn'
  return (
    <span className={`inline-flex items-center gap-1 rounded-[3px] px-1.5 py-0.5 text-[10px] font-medium ${styles}`}>
      <LockKeyhole className="size-2.5" aria-hidden /> {scope}
    </span>
  )
}

function AskMock() {
  const [active, setActive] = useState<AskKey>('process')
  const variant = ASK_VARIANTS[active]
  const variants: AskKey[] = ['process', 'timeline', 'owner']

  return (
    <div className="grid min-h-[27rem] gap-0 sm:grid-cols-[1fr_16rem] lg:min-h-[28rem]">
      <div className="flex min-h-0 flex-col border-b border-border sm:border-b-0 sm:border-r">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-full bg-accent text-accent-foreground">
              <Sparkles className="size-3.5" aria-hidden />
            </span>
            <span className="text-[13px] font-medium">Ask OpenVault</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-md border border-border px-2 py-1 text-[10.5px] text-muted-foreground sm:inline-flex">
              Scope: People Ops
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground">
              <ShieldCheck className="size-2.5 text-accent" aria-hidden /> Private
            </span>
          </div>
        </div>

        <div key={active} className="animate-fade-in flex-1 px-5 py-5">
          <div className="flex justify-end">
            <p className="max-w-[82%] rounded-xl rounded-br-sm bg-surface-2 px-3.5 py-2.5 text-[12.5px] leading-relaxed">
              {variant.question}
            </p>
          </div>

          <div className="mt-5 flex gap-3">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-border bg-surface text-accent">
              <Sparkles className="size-3" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] leading-[1.75] text-foreground/85">{variant.answer}</p>

              {variant.steps && (
                <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border pt-3">
                  {variant.steps.map((step) => (
                    <div key={step.day}>
                      <p className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-accent">{step.day}</p>
                      <p className="mt-1 text-[9.5px] leading-relaxed text-muted-foreground">{step.body}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 space-y-1.5">
                {variant.sources.map((source) => (
                  <div
                    key={source.name}
                    className="flex items-center gap-2.5 border-b border-border pb-1.5 last:border-0 last:pb-0"
                  >
                    <FileText className="size-3 shrink-0 text-accent" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{source.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{source.meta}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-foreground">
              Ask next
            </span>
            {variants.map((key) => {
              const item = ASK_VARIANTS[key]
              const isActive = key === active
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActive(key)}
                  className={`rounded-full border px-2.5 py-1 text-[10px] transition-colors ${
                    isActive
                      ? 'border-accent/30 bg-accent-soft text-accent'
                      : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground'
                  }`}
                >
                  {item.chip}
                </button>
              )
            })}
          </div>
        </div>

        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
            <span className="flex-1 text-[11px] text-muted-foreground">
              Ask about your permitted documents…
            </span>
            <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
              <ArrowUp className="size-3" aria-hidden />
            </span>
          </div>
          <p className="mt-2 text-[9.5px] text-muted-foreground">{variant.stats}</p>
        </div>
      </div>

      <aside className="flex flex-col p-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Sources
          </p>
          <span className="text-[9.5px] text-muted-foreground">{variant.sources.length} cited</span>
        </div>

        <div className="mt-3 divide-y divide-border">
          {variant.sources.map((source) => (
            <div key={source.name} className="py-3 first:pt-0">
              <p className="truncate text-[10.5px] font-medium">{source.name}</p>
              <p className="mt-1 text-[9.5px] text-muted-foreground">{source.meta}</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent/70" style={{ width: `${source.relevance}%` }} />
                </div>
                <span className="font-mono text-[8px] text-muted-foreground">{source.relevance}%</span>
              </div>
            </div>
          ))}
        </div>

        {variant.sources.length === 1 && (
          <p className="mt-2 text-[9.5px] leading-relaxed text-muted-foreground">
            Only one permitted source matched this question.
          </p>
        )}

        <div className="mt-5 border-t border-border pt-4">
          <p className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Viewer context
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[9px] font-semibold">
              H
            </span>
            <div className="min-w-0">
              <p className="truncate text-[10.5px] font-medium">Hira S.</p>
              <p className="truncate text-[9px] text-muted-foreground">People Ops · Employee</p>
            </div>
          </div>
          <dl className="mt-3 space-y-1.5 text-[9.5px]">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Download</dt>
              <dd className="text-foreground">Off</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Access</dt>
              <dd className="text-foreground">3 documents</dd>
            </div>
          </dl>
        </div>

        <div className="mt-auto border-t border-border pt-3">
          <p className="flex items-center gap-1.5 text-[10px] font-medium text-ok">
            <Check className="size-3" aria-hidden /> 6 files filtered out
          </p>
          <p className="mt-1.5 text-[9.5px] leading-relaxed text-muted-foreground">
            Outside this user&apos;s access scope, so they never reached the model.
          </p>
        </div>
      </aside>
    </div>
  )
}

function DocumentsMock() {
  const [category, setCategory] = useState('All categories')
  const [selectedName, setSelectedName] = useState(DOCUMENTS[1].name)
  const [downloadsOn, setDownloadsOn] = useState(true)
  const filtered = category === 'All categories' ? DOCUMENTS : DOCUMENTS.filter((doc) => doc.category === category)
  const selected = filtered.find((doc) => doc.name === selectedName) ?? filtered[0] ?? DOCUMENTS[0]

  return (
    <div className="grid min-h-[27rem] gap-0 lg:min-h-[28rem] lg:grid-cols-[1fr_16rem]">
      <div className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3.5">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
            <Search className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="truncate text-[11px] text-muted-foreground">Search documents…</span>
          </div>
          <MiniSelect
            label="Filter by category"
            value={category}
            options={CATEGORIES.map((item) => ({ value: item, label: item }))}
            onChange={setCategory}
            className="w-[8.8rem]"
          />
        </div>

        <div className="flex flex-1 flex-col">
          <div className="divide-y divide-border">
            {filtered.map((doc) => {
              const isSelected = selected.name === doc.name
              return (
                <button
                  key={doc.name}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedName(doc.name)}
                  className={`flex w-full items-center gap-3 px-4 py-[0.9rem] text-left transition-colors ${
                    isSelected ? 'bg-surface-2/60' : 'hover:bg-surface-2/35'
                  }`}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-surface text-accent">
                    <FileText className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-medium">{doc.name}</p>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{doc.meta}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <ScopeBadge scope={doc.scope} tone={doc.tone} />
                    <p className="mt-1 text-[9.5px] text-muted-foreground">{doc.people}</p>
                  </div>
                  <ChevronRight
                    className={`size-3.5 shrink-0 transition-transform ${
                      isSelected ? 'rotate-90 text-accent' : 'text-muted-foreground'
                    }`}
                    aria-hidden
                  />
                </button>
              )
            })}
          </div>

          {category !== 'All categories' && (
            <div className="flex flex-1 flex-col items-center justify-center border-t border-border px-6 py-7 text-center">
              <span className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground">
                <Filter className="size-3.5" aria-hidden />
              </span>
              <p className="mt-3 text-[11px] font-medium">{category} filter is on</p>
              <p className="mt-1 max-w-[17rem] text-[10px] leading-relaxed text-muted-foreground">
                Showing {filtered.length} of {DOCUMENTS.length} documents. Everything else stays in
                the vault.
              </p>
              <button
                type="button"
                onClick={() => setCategory('All categories')}
                className="mt-3 text-[10px] font-medium text-foreground underline underline-offset-4"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-[10px] text-muted-foreground">
          <span>
            {filtered.length} of 1,240 documents
            {category !== 'All categories' && ` · ${category}`}
          </span>
          <span>{category === 'All categories' ? 'Page 1 of 310' : 'Filtered view'}</span>
        </div>
      </div>

      <aside className="flex flex-col border-t border-border p-4 lg:border-t-0">
        <p className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Selected document
        </p>
        <p className="mt-3 truncate text-[11.5px] font-medium">{selected.name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <ScopeBadge scope={selected.scope} tone={selected.tone} />
          <span className="text-[9.5px] text-muted-foreground">{selected.people}</span>
        </div>

        <div className="mt-4 divide-y divide-border">
          {selected.viewers.map(([initial, name]) => (
            <div key={name} className="flex items-center gap-2 py-2 first:pt-0">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[9px] font-semibold">
                {initial}
              </span>
              <span className="truncate text-[10.5px]">{name}</span>
            </div>
          ))}
        </div>

        <dl className="mt-4 space-y-2 border-t border-border pt-3 text-[9.5px]">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Category</dt>
            <dd className="text-foreground">{selected.category}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Owner</dt>
            <dd className="truncate text-foreground">{selected.viewers[0]?.[1]}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Indexed</dt>
            <dd className="text-foreground">2 days ago</dd>
          </div>
        </dl>

        <p className="mt-3 text-[9.5px] leading-relaxed text-muted-foreground">
          Only these people can open the file. Revoking access removes it from search and retrieval
          immediately.
        </p>

        <div className="mt-auto space-y-3 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] text-muted-foreground">Downloads</span>
            <button
              type="button"
              role="switch"
              aria-checked={downloadsOn}
              aria-label={`Downloads ${downloadsOn ? 'allowed' : 'off'}`}
              onClick={() => setDownloadsOn((value) => !value)}
              className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
                downloadsOn ? 'bg-accent' : 'border border-border bg-surface-2'
              }`}
            >
              <span
                className={`absolute top-0.5 size-3 rounded-full transition-transform ${
                  downloadsOn ? 'right-0.5 bg-accent-foreground' : 'left-0.5 bg-muted-foreground'
                }`}
              />
            </button>
          </div>
          <p className="text-[9.5px] leading-relaxed text-muted-foreground">
            {downloadsOn
              ? 'Download is on. The download event is written to the audit trail.'
              : 'Download is off. They can read the file inside the vault, but not export it.'}
          </p>
        </div>
      </aside>
    </div>
  )
}

function AuditMock() {
  const [filter, setFilter] = useState('all')
  const filtered = filter === 'all' ? AUDIT_ROWS : AUDIT_ROWS.filter((row) => row.kind === filter)

  function exportCsv() {
    const rows = [
      ['Time', 'Event', 'Actor', 'IP'],
      ...filtered.map((row) => [row.time, row.event, row.actor, row.ip]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'openvault-audit-demo.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex min-h-[27rem] flex-col lg:min-h-[28rem]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div>
          <p className="text-[13px] font-medium">Activity audit</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Last 100 events · tenant-scoped · {filtered.length} shown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MiniSelect
            label="Filter audit events"
            value={filter}
            options={AUDIT_FILTERS}
            onChange={setFilter}
            className="w-[9.5rem]"
          />
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-2 text-[10px] text-primary-foreground transition-opacity hover:opacity-85"
          >
            <Download className="size-3" aria-hidden /> Export CSV
          </button>
        </div>
      </div>

      <div className="hidden grid-cols-[1.15fr_1.1fr_0.65fr_0.6fr] gap-4 border-b border-border px-5 py-2 font-mono text-[8.5px] uppercase tracking-[0.14em] text-muted-foreground sm:grid">
        <span>Event</span>
        <span>Actor</span>
        <span>Time</span>
        <span>IP</span>
      </div>

      <div key={filter} className="animate-fade-in flex flex-1 flex-col">
        <div className="divide-y divide-border px-5">
          {filtered.map((row) => (
            <div
              key={row.time}
              className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 transition-colors hover:bg-surface-2/30 sm:grid-cols-[1.15fr_1.1fr_0.65fr_0.6fr]"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${
                    row.tone === 'danger' ? 'bg-danger' : row.tone === 'accent' ? 'bg-accent' : 'bg-ok'
                  }`}
                  aria-hidden
                />
                <span className="truncate text-[11.5px] font-medium">{row.event}</span>
              </div>
              <span className="hidden truncate text-[10.5px] text-muted-foreground sm:block">{row.actor}</span>
              <span className="hidden font-mono text-[9.5px] text-muted-foreground sm:block">{row.time}</span>
              <span className="text-right font-mono text-[9.5px] text-muted-foreground sm:text-left">{row.ip}</span>
            </div>
          ))}
        </div>

        {filter !== 'all' && (
          <div className="flex flex-1 flex-col items-center justify-center border-t border-border px-6 py-6 text-center">
            <span className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground">
              <Filter className="size-3.5" aria-hidden />
            </span>
            <p className="mt-3 text-[11px] font-medium">Event filter is on</p>
            <p className="mt-1 max-w-[17rem] text-[10px] leading-relaxed text-muted-foreground">
              Showing {filtered.length} of {AUDIT_ROWS.length} sampled events. The rest remain in the
              tenant&apos;s audit history.
            </p>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="mt-3 text-[10px] font-medium text-foreground underline underline-offset-4"
            >
              Clear filter
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-[9.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-3 text-accent" aria-hidden /> Signed and tenant-scoped
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-3" aria-hidden /> Admin-only view
        </span>
        <span className="hidden sm:inline">Export includes actor, IP, and timestamp</span>
      </div>
    </div>
  )
}

export function ProductShowcase() {
  const [active, setActive] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const panels = [<AskMock key="ask" />, <DocumentsMock key="docs" />, <AuditMock key="audit" />]

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = TABS.length - 1
    let next = index
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = index === 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    else return
    event.preventDefault()
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <section className="border-y border-border bg-surface/35 py-20 sm:py-24 lg:py-28" aria-labelledby="product-heading">
      <div className="container-page">
        <Reveal>
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">Inside the vault</p>
              <h2 id="product-heading" className="display-lg mt-5">
                One quiet place for
                <br />
                <span className="serif text-accent">the whole workflow.</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground lg:pb-1">
              Ask, control, and prove without stitching a search tool, a shared drive, and an audit
              spreadsheet together. The panels below are interactive.
            </p>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-10 grid gap-4 lg:grid-cols-[15.5rem_1fr] lg:gap-5">
            <div
              role="tablist"
              aria-label="Product tour"
              className="flex gap-2 overflow-x-auto pb-1 no-scrollbar lg:flex-col lg:overflow-visible lg:pb-0"
            >
              {TABS.map((tab, index) => (
                <button
                  key={tab.label}
                  ref={(node) => {
                    tabRefs.current[index] = node
                  }}
                  id={`product-tab-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={active === index}
                  aria-controls="product-panel"
                  tabIndex={active === index ? 0 : -1}
                  onClick={() => setActive(index)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  className={`group min-w-0 flex-1 rounded-xl border px-3.5 py-3 text-left transition-colors lg:min-w-0 lg:flex-none lg:px-4 lg:py-3.5 ${
                    active === index
                      ? 'border-border-strong bg-surface'
                      : 'border-transparent hover:border-border hover:bg-surface/60'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[9px] ${active === index ? 'text-accent' : 'text-muted-foreground'}`}
                    >
                      0{index + 1}
                    </span>
                    <span className="truncate text-[12px] font-medium lg:hidden">{tab.short}</span>
                    <span className="hidden text-[13px] font-medium lg:inline">{tab.label}</span>
                  </span>
                  <span className="mt-1.5 hidden text-[11px] leading-relaxed text-muted-foreground lg:block">
                    {tab.description}
                  </span>
                </button>
              ))}
            </div>

            <div
              id="product-panel"
              role="tabpanel"
              aria-labelledby={`product-tab-${active}`}
              className="overflow-hidden rounded-[1.1rem] border border-border bg-surface"
            >
              <div key={active} className="animate-fade-in">
                {panels[active]}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export default ProductShowcase
