'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Globe,
  Layers,
  Loader2,
  Lock,
  Search,
  Share2,
  Trash2,
  Upload,
  UserPlus,
  X,
  type LucideIcon,
} from 'lucide-react'
import { downloadOwnDocument, shareApi, workApi, type DocumentShareRow, type EnterpriseDoc } from '@/lib/api'
import { useAuth } from '@/lib/auth'

type Sort = 'recent' | 'downloads' | 'name'

// ---- shared class fragments ---------------------------------------------
const eyebrow = 'text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]'
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f6f2]'
const inputClass =
  'h-12 w-full rounded-xl border border-[#d8d5cc] bg-[#fffdfa] px-4 text-sm text-[#1d1d1b] outline-none transition-colors placeholder:text-[#9b9890] focus:border-[#1d1d1b]'
const selectClass =
  `h-12 appearance-none rounded-xl border border-[#d8d5cc] bg-[#fffdfa] pl-4 pr-10 text-sm text-[#1d1d1b] outline-none transition-colors hover:border-[#1d1d1b] focus:border-[#1d1d1b] ${focusRing}`
const primaryBtn =
  `inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#1d1d1b] px-5 text-sm font-medium text-white transition-colors hover:bg-[#3c3b37] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`
const ghostBtn =
  `inline-flex items-center justify-center gap-2 rounded-full border border-[#dcdad3] bg-[#fffdfa] px-4 py-2 text-sm text-[#1d1d1b] transition-colors hover:border-[#1d1d1b] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`
const iconBtn =
  `inline-flex items-center gap-1.5 rounded-full border border-[#dcdad3] bg-[#fffdfa] px-3 py-2 text-sm text-[#1d1d1b] transition-colors hover:border-[#1d1d1b] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`
const dangerBtn =
  `inline-flex items-center gap-1.5 rounded-full border border-[#e6c9c1] bg-[#fffdfa] px-3 py-2 text-sm text-[#9a3b2c] transition-colors hover:border-[#9a3b2c] hover:bg-[#fbe4e0] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`

// ---- formatting helpers --------------------------------------------------
function formatBytes(n: number) {
  if (!n || n < 0) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

// Human display name: drop the extension, turn separators into spaces, Title Case.
function displayTitle(filename: string) {
  const base = filename.replace(/\.(md|markdown|txt|pdf|docx?|pptx?|xlsx?|csv|rtf|json|ya?ml|html?|xml)$/i, '')
  const words = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return words.replace(/\b\w/g, (c) => c.toUpperCase()) || filename
}

// ---- small presentational pieces ----------------------------------------
function StatCard({ icon: Icon, label, value, tintClass }: {
  icon: LucideIcon
  label: string
  value: number
  tintClass: string
}) {
  return (
    <div className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4">
      <div className="flex items-center gap-2">
        <span className={`grid size-8 place-items-center rounded-lg ${tintClass}`}>
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#8c8a83]">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-[-0.03em]">{value.toLocaleString('en-US')}</p>
    </div>
  )
}

function Badge({ icon: Icon, tintClass, children }: { icon: LucideIcon; tintClass: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tintClass}`}>
      <Icon className="size-3" aria-hidden /> {children}
    </span>
  )
}

function Toggle({ checked, onChange, labelId, disabled }: {
  checked: boolean
  onChange: (v: boolean) => void
  labelId: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${checked ? 'border-[#1d1d1b] bg-[#1d1d1b]' : 'border-[#d8d5cc] bg-[#efece4]'} ${focusRing}`}
    >
      <span className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
    </button>
  )
}

// ---- one document row ----------------------------------------------------
function DocumentRow({ doc, isEditor, busy, onDownload, onToggle, onDelete, onShare }: {
  doc: EnterpriseDoc
  isEditor: boolean
  busy: boolean
  onDownload: (d: EnterpriseDoc) => void
  onToggle: (d: EnterpriseDoc) => void
  onDelete: (d: EnterpriseDoc) => void
  onShare: (d: EnterpriseDoc) => void
}) {
  const pub = doc.is_public
  return (
    <li className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4 transition-colors hover:border-[#dcdad3] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-[#f2efe8] text-[#5d5b55]">
            <FileText className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-[#1d1d1b]" title={doc.filename}>{displayTitle(doc.filename)}</h3>
              {pub ? (
                <Badge icon={Globe} tintClass="bg-[#e6f1e4] text-[#4a7a5a]">Public</Badge>
              ) : (
                <Badge icon={Lock} tintClass="bg-[#efece4] text-[#5d5b55]">Private</Badge>
              )}
              {doc.is_okf && <Badge icon={BookOpen} tintClass="bg-[#f5f0ff] text-[#5f4b8a]">Open Knowledge</Badge>}
            </div>
            {doc.description && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#77746c]">{doc.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#98958c]">
              <span className="rounded-full bg-[#f2efe8] px-2 py-0.5 font-medium text-[#5d5b55]">{doc.category || 'Uncategorized'}</span>
              <span>{formatBytes(doc.size)}</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1"><Download className="size-3" aria-hidden />{doc.downloads.toLocaleString('en-US')}</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1"><Layers className="size-3" aria-hidden />{doc.num_chunks} indexed</span>
              <span aria-hidden>·</span>
              <span>{formatDate(doc.created_at)}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          <button type="button" onClick={() => onDownload(doc)} disabled={busy} title="Download" aria-label={`Download ${doc.filename}`} className={iconBtn}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
            <span className="lg:hidden">Download</span>
          </button>
          {isEditor && (
            <>
              <button type="button" onClick={() => onShare(doc)} disabled={busy} title="Share with another company" aria-label={`Share ${doc.filename}`} className={iconBtn}>
                <Share2 className="size-4" aria-hidden />
                <span className="lg:hidden">Share</span>
              </button>
              <button type="button" onClick={() => onToggle(doc)} disabled={busy} title={pub ? 'Make private' : 'Make public'} aria-label={pub ? `Make ${doc.filename} private` : `Make ${doc.filename} public`} className={iconBtn}>
                {pub ? <Lock className="size-4" aria-hidden /> : <Globe className="size-4" aria-hidden />}
                <span className="lg:hidden">{pub ? 'Make private' : 'Make public'}</span>
              </button>
              <button type="button" onClick={() => onDelete(doc)} disabled={busy} title="Delete" aria-label={`Delete ${doc.filename}`} className={dangerBtn}>
                <Trash2 className="size-4" aria-hidden />
                <span className="lg:hidden">Delete</span>
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  )
}

// ---- upload panel (editors only) -----------------------------------------
function UploadPanel({ open, onToggle, knownCategories, onUploaded }: {
  open: boolean
  onToggle: () => void
  knownCategories: string[]
  onUploaded: (doc: EnterpriseDoc) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [isOkf, setIsOkf] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setFile(null)
    setCategory('')
    setDescription('')
    setIsPublic(false)
    setIsOkf(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setOk('')
    if (!file) {
      setError('Choose a file to upload.')
      return
    }
    setSubmitting(true)
    const form = new FormData()
    form.append('file', file)
    form.append('category', category.trim())
    form.append('description', description.trim())
    form.append('is_public', isPublic ? 'true' : 'false')
    form.append('is_okf', isOkf ? 'true' : 'false')
    try {
      const created = await workApi.upload(form)
      onUploaded(created)
      setOk(`"${created.filename}" uploaded${created.num_chunks ? ` indexed into ${created.num_chunks} chunk${created.num_chunks === 1 ? '' : 's'}` : ''}.`)
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#dedbd3] bg-[#fffdfa]">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls="upload-form" className={`flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left ${focusRing}`}>
        <span className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#1d1d1b] text-white"><Upload className="size-4" aria-hidden /></span>
          <span>
            <span className="block text-sm font-semibold text-[#1d1d1b]">Upload a document</span>
            <span className="block text-xs text-[#8c8a83]">Add a file to your library and index it for search.</span>
          </span>
        </span>
        <ChevronDown className={`size-5 shrink-0 text-[#8c8a83] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <form id="upload-form" onSubmit={onSubmit} className="space-y-4 border-t border-[#eae7df] p-5">
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#fbe4e0] px-4 py-3 text-sm text-[#9a3b2c]">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
            </p>
          )}
          {ok && (
            <p role="status" className="flex items-start gap-2 rounded-xl bg-[#e6f1e4] px-4 py-3 text-sm text-[#3f6b4f]">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> {ok}
            </p>
          )}
          <div>
            <label htmlFor="up-file" className="mb-1.5 block text-sm font-medium text-[#1d1d1b]">File <span className="text-[#9a3b2c]">*</span></label>
            <input ref={fileRef} id="up-file" name="file" type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full cursor-pointer rounded-xl border border-[#d8d5cc] bg-[#fffdfa] text-sm text-[#5d5b55] file:mr-4 file:cursor-pointer file:border-0 file:bg-[#f2efe8] file:px-4 file:py-3 file:text-sm file:font-medium file:text-[#1d1d1b] hover:file:bg-[#eae7df] focus:border-[#1d1d1b] focus:outline-none" />
          </div>
          <div>
            <label htmlFor="up-category" className="mb-1.5 block text-sm font-medium text-[#1d1d1b]">Category</label>
            <input id="up-category" name="category" list="up-category-options" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Engineering" className={inputClass} />
            <datalist id="up-category-options">{knownCategories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label htmlFor="up-description" className="mb-1.5 block text-sm font-medium text-[#1d1d1b]">Description</label>
            <textarea id="up-description" name="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="A short summary so teammates know what this is." className="w-full rounded-xl border border-[#d8d5cc] bg-[#fffdfa] px-4 py-3 text-sm text-[#1d1d1b] outline-none transition-colors placeholder:text-[#9b9890] focus:border-[#1d1d1b]" />
          </div>
          <div className="space-y-3 rounded-xl border border-[#eae7df] bg-[#faf8f3] p-4">
            <div className="flex items-center justify-between gap-4">
              <span>
                <span id="lbl-public" className="block text-sm font-medium text-[#1d1d1b]">Publish to the public library</span>
                <span className="block text-xs text-[#8c8a83]">Anyone browsing OpenVault can find and download this.</span>
              </span>
              <Toggle checked={isPublic} onChange={setIsPublic} labelId="lbl-public" disabled={submitting} />
            </div>
            <div className="h-px bg-[#eae7df]" />
            <div className="flex items-center justify-between gap-4">
              <span>
                <span id="lbl-okf" className="block text-sm font-medium text-[#1d1d1b]">Open Knowledge document</span>
                <span className="block text-xs text-[#8c8a83]">Mark this as freely shareable open knowledge.</span>
              </span>
              <Toggle checked={isOkf} onChange={setIsOkf} labelId="lbl-okf" disabled={submitting} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={submitting || !file} aria-busy={submitting} className={primaryBtn}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
              {submitting ? 'Uploading…' : 'Upload document'}
            </button>
            <button type="button" onClick={reset} disabled={submitting} className={ghostBtn}>Reset</button>
            <span className="truncate text-xs text-[#8c8a83]">{file ? file.name : 'No file selected'}</span>
          </div>
        </form>
      )}
    </div>
  )
}

// ---- share dialog (editors only) -----------------------------------------
// Granular cross-company collaboration: grant ONE named person at ANOTHER
// company access to THIS document. Everyone else stays blocked by default.
function ShareDialog({ doc, onClose }: { doc: EnterpriseDoc; onClose: () => void }) {
  const [shares, setShares] = useState<DocumentShareRow[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    shareApi
      .list(doc.id)
      .then(setShares)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load shares.'))
      .finally(() => setLoading(false))
  }, [doc.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = email.trim()
    if (!value) return
    setError('')
    setAdding(true)
    try {
      const row = await shareApi.add(doc.id, value)
      setShares((prev) => [row, ...prev.filter((s) => s.user_id !== row.user_id)])
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share with that person.')
    } finally {
      setAdding(false)
    }
  }

  async function onRemove(userId: number) {
    setError('')
    setRemoving(userId)
    try {
      await shareApi.remove(doc.id, userId)
      setShares((prev) => prev.filter((s) => s.user_id !== userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke access.')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label={`Share ${doc.filename}`} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[#eae7df] p-5">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#1d1d1b]"><Share2 className="size-4" aria-hidden /> Share document</p>
            <p className="mt-1 truncate text-sm text-[#77746c]" title={doc.filename}>{displayTitle(doc.filename)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-8 shrink-0 place-items-center rounded-full text-[#8c8a83] hover:bg-[#efece4] hover:text-[#1d1d1b] ${focusRing}`}>
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-xs leading-relaxed text-[#8c8a83]">
            Enter the email of someone at another company. They, and only they, will be able to read
            and search this one document. People in your own company already have access.
          </p>
          <form onSubmit={onAdd} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@othercompany.com"
              autoComplete="off"
              className={inputClass}
            />
            <button type="submit" disabled={adding || !email.trim()} className={primaryBtn}>
              {adding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
              Share
            </button>
          </form>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#fbe4e0] px-4 py-3 text-sm text-[#9a3b2c]">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
            </p>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8c8a83]">People with access</p>
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-[#77746c]"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading…</p>
            ) : shares.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#dcdad3] px-4 py-6 text-center text-sm text-[#98958c]">Not shared with anyone outside your company yet.</p>
            ) : (
              <ul className="space-y-2">
                {shares.map((s) => (
                  <li key={s.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-[#eae7df] bg-[#faf8f3] px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#1d1d1b]">{s.full_name || s.email}</p>
                      <p className="truncate text-xs text-[#8c8a83]">{s.email}{s.company_name ? ` · ${s.company_name}` : ''}</p>
                    </div>
                    <button type="button" onClick={() => onRemove(s.user_id)} disabled={removing === s.user_id} aria-label={`Revoke ${s.email}`} className={dangerBtn}>
                      {removing === s.user_id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
                      <span>Revoke</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- page ----------------------------------------------------------------
export default function DocumentsPage() {
  const { user } = useAuth()

  const [docs, setDocs] = useState<EnterpriseDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [busy, setBusy] = useState<Set<number>>(() => new Set())
  const [actionError, setActionError] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [shareDoc, setShareDoc] = useState<EnterpriseDoc | null>(null)
  const uploadRef = useRef<HTMLElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    setLoadError('')
    workApi
      .documents()
      .then((d) => setDocs(d))
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load documents.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const setRowBusy = useCallback((id: number, on: boolean) => {
    setBusy((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const categories = useMemo(
    () => Array.from(new Set(docs.map((d) => d.category).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [docs],
  )

  const stats = useMemo(() => {
    const pub = docs.filter((d) => d.is_public).length
    return {
      total: docs.length,
      publicCount: pub,
      privateCount: docs.length - pub,
      downloads: docs.reduce((s, d) => s + (d.downloads || 0), 0),
      chunks: docs.reduce((s, d) => s + (d.num_chunks || 0), 0),
    }
  }, [docs])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = docs.filter((d) => {
      if (category && d.category !== category) return false
      if (!q) return true
      return (
        d.filename.toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q) ||
        (d.category || '').toLowerCase().includes(q)
      )
    })
    return list.sort((a, b) => {
      if (sort === 'downloads') return (b.downloads || 0) - (a.downloads || 0)
      if (sort === 'name') return displayTitle(a.filename).localeCompare(displayTitle(b.filename))
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [docs, query, category, sort])

  async function handleDownload(doc: EnterpriseDoc) {
    setActionError('')
    setRowBusy(doc.id, true)
    try {
      await downloadOwnDocument(doc.id, doc.filename)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : `Could not download "${doc.filename}".`)
    } finally {
      setRowBusy(doc.id, false)
    }
  }

  async function handleToggle(doc: EnterpriseDoc) {
    setActionError('')
    setRowBusy(doc.id, true)
    try {
      const updated = await workApi.togglePublic(doc.id)
      setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not change visibility.')
    } finally {
      setRowBusy(doc.id, false)
    }
  }

  async function handleDelete(doc: EnterpriseDoc) {
    if (!window.confirm(`Delete “${displayTitle(doc.filename)}”? This removes the file and its ${doc.num_chunks} indexed chunk${doc.num_chunks === 1 ? '' : 's'} and cannot be undone.`)) return
    setActionError('')
    setRowBusy(doc.id, true)
    try {
      await workApi.remove(doc.id)
      setDocs((prev) => prev.filter((d) => d.id !== doc.id))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete the document.')
    } finally {
      setRowBusy(doc.id, false)
    }
  }

  function handleUploaded(doc: EnterpriseDoc) {
    setDocs((prev) => [doc, ...prev])
  }

  function openUpload() {
    setUploadOpen(true)
    requestAnimationFrame(() => uploadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function clearFilters() {
    setQuery('')
    setCategory('')
    setSort('recent')
  }

  if (!user) return null
  const isEditor = user.role === 'admin' || user.role === 'employee'
  const filtersActive = Boolean(query.trim() || category) || sort !== 'recent'

  return (
    <div className="pb-6">
      <header className="flex flex-col gap-5 border-b border-[#e6e3dc] pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={eyebrow}>Company workspace</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl sm:tracking-[-0.06em]">
            Your team&apos;s <span className="font-serif font-normal italic">library.</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#77746c]">
            Upload, organize, and publish the documents your organization can search, cite, and download.
          </p>
        </div>
        {isEditor && (
          <button type="button" onClick={openUpload} className={primaryBtn}>
            <Upload className="size-4" aria-hidden /> Upload document
          </button>
        )}
      </header>

      <section aria-label="Library summary" className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={FileText} label="Documents" value={stats.total} tintClass="bg-[#efece4] text-[#1d1d1b]" />
        <StatCard icon={Globe} label="Public" value={stats.publicCount} tintClass="bg-[#e6f1e4] text-[#4a7a5a]" />
        <StatCard icon={Lock} label="Private" value={stats.privateCount} tintClass="bg-[#fff8ea] text-[#8a6d3b]" />
        <StatCard icon={Download} label="Downloads" value={stats.downloads} tintClass="bg-[#dfe7f7] text-[#3c5a8a]" />
        <StatCard icon={Layers} label="Indexed chunks" value={stats.chunks} tintClass="bg-[#f5f0ff] text-[#5f4b8a]" />
      </section>

      <section className="mt-6" ref={uploadRef}>
        {isEditor ? (
          <UploadPanel open={uploadOpen} onToggle={() => setUploadOpen((v) => !v)} knownCategories={categories} onUploaded={handleUploaded} />
        ) : (
          <div className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-5 text-sm text-[#77746c]">
            <span className="inline-flex items-center gap-2 font-medium text-[#1d1d1b]"><Lock className="size-4" aria-hidden /> Read-only access</span>
            <p className="mt-1 max-w-2xl">You can browse and download every document your organization has shared. Uploading, publishing, and deleting are reserved for admins and employees.</p>
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex h-12 flex-1 items-center rounded-xl border border-[#d8d5cc] bg-[#fffdfa] transition-colors focus-within:border-[#1d1d1b]">
            <Search className="pointer-events-none absolute left-4 size-5 text-[#8c8a83]" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search documents" placeholder="Search by name, description, or category…" className="h-full w-full rounded-xl bg-transparent pl-12 pr-10 text-sm outline-none placeholder:text-[#aaa8a1]" />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className={`absolute right-3 grid size-7 place-items-center rounded-full text-[#8c8a83] hover:bg-[#efece4] hover:text-[#1d1d1b] ${focusRing}`}>
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <div className="relative flex-1 sm:flex-none">
              <label htmlFor="filter-category" className="sr-only">Filter by category</label>
              <select id="filter-category" value={category} onChange={(e) => setCategory(e.target.value)} className={`w-full ${selectClass}`}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#8c8a83]" aria-hidden />
            </div>
            <div className="relative flex-1 sm:flex-none">
              <label htmlFor="sort-docs" className="sr-only">Sort documents</label>
              <select id="sort-docs" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={`w-full ${selectClass}`}>
                <option value="recent">Most recent</option>
                <option value="downloads">Most downloaded</option>
                <option value="name">Name (A–Z)</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#8c8a83]" aria-hidden />
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-[#8c8a83]" aria-live="polite">
          {loading ? 'Loading documents…' : `Showing ${visible.length} of ${docs.length} ${docs.length === 1 ? 'document' : 'documents'}`}
        </p>
      </section>

      <section className="mt-4">
        {actionError && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl bg-[#fbe4e0] px-4 py-3 text-sm text-[#9a3b2c]">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="flex-1">{actionError}</span>
            <button type="button" onClick={() => setActionError('')} aria-label="Dismiss error" className="shrink-0 opacity-70 transition-opacity hover:opacity-100"><X className="size-4" aria-hidden /></button>
          </div>
        )}

        {loading ? (
          <ul className="space-y-3" aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="animate-pulse rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-5">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-[#ecebe4]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded bg-[#ecebe4]" />
                    <div className="h-3 w-2/3 rounded bg-[#f0efe9]" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : loadError ? (
          <div role="alert" className="rounded-3xl border border-[#e6c9c1] bg-[#fbe4e0] p-10 text-center">
            <AlertCircle className="mx-auto size-6 text-[#9a3b2c]" aria-hidden />
            <p className="mt-3 text-sm font-medium text-[#9a3b2c]">{loadError}</p>
            <button type="button" onClick={load} className={`mt-5 ${ghostBtn}`}>Try again</button>
          </div>
        ) : docs.length === 0 ? (
          <div className="rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-12 text-center">
            <p className="font-serif text-2xl italic">Nothing here yet.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#98958c]">
              {isEditor ? 'Upload your first document to start building your team’s searchable knowledge base.' : 'Your organization hasn’t shared any documents yet. Check back soon.'}
            </p>
            {isEditor && (
              <button type="button" onClick={openUpload} className={`mt-6 ${primaryBtn}`}><Upload className="size-4" aria-hidden /> Upload a document</button>
            )}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-12 text-center">
            <p className="font-serif text-2xl italic">No documents match…</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#98958c]">Try a different search term or clear the filters to see everything.</p>
            {filtersActive && (
              <button type="button" onClick={clearFilters} className={`mt-6 ${ghostBtn}`}><X className="size-4" aria-hidden /> Clear filters</button>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} isEditor={isEditor} busy={busy.has(doc.id)} onDownload={handleDownload} onToggle={handleToggle} onDelete={handleDelete} onShare={setShareDoc} />
            ))}
          </ul>
        )}
      </section>

      {shareDoc && <ShareDialog doc={shareDoc} onClose={() => setShareDoc(null)} />}
    </div>
  )
}
