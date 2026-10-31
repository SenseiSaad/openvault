'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  Building2,
  ChevronDown,
  Download,
  Eye,
  FileText,
  History,
  Layers,
  Loader2,
  Lock,
  Pencil,
  RefreshCw,
  Search,
  Share2,
  Tag,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import {
  companyApi,
  companyApi2,
  downloadOwnDocument,
  shareApi,
  workApi,
  type CompanyDirectory,
  type Department,
  type DocumentShareRow,
  type EnterpriseDoc,
  type MemberDirectory,
} from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { toast } from '@/components/toaster'
import { ConfirmDialog } from '@/components/confirm-dialog'

type Sort = 'recent' | 'downloads' | 'name'
const eyebrow = 'text-xs font-semibold uppercase tracking-[0.16em] text-[#6b6862]'
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f6f2]'
const inputClass =
  'h-11 w-full rounded-xl border border-[#d8d5cc] bg-[#fffdfa] px-3.5 text-sm text-[#1d1d1b] outline-none placeholder:text-[#6b6862] focus:border-[#1d1d1b]'
const primaryBtn = `inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#1d1d1b] px-4 text-xs font-medium text-white hover:bg-[#3c3b37] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`
const ghostBtn = `inline-flex items-center justify-center gap-1.5 rounded-full border border-[#dcdad3] bg-[#fffdfa] px-3 py-1.5 text-xs font-medium text-[#1d1d1b] hover:border-[#1d1d1b] disabled:opacity-60 ${focusRing}`
const dangerBtn = `inline-flex items-center gap-1.5 rounded-full border border-[#e6c9c1] bg-[#fffdfa] px-3 py-1.5 text-xs font-medium text-[#9a3b2c] hover:border-[#9a3b2c] hover:bg-[#fbe4e0] disabled:opacity-50 ${focusRing}`

function formatBytes(n: number) {
  if (!n || n < 0) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function displayTitle(filename: string) {
  const base = filename.replace(
    /\.(md|markdown|txt|pdf|docx?|pptx?|xlsx?|csv|rtf|json|ya?ml|html?|xml)$/i,
    '',
  )
  return base.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || filename
}

function AccessBadge({
  scope,
  deptName,
}: {
  scope: EnterpriseDoc['access_scope']
  deptName?: string | null
}) {
  if (scope === 'restricted') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#fff0d3] px-2 py-0.5 text-[11px] font-medium text-[#8a6316]">
        <Lock className="size-3" /> Selected people
      </span>
    )
  }
  if (scope === 'department') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#e8edfb] px-2 py-0.5 text-[11px] font-medium text-[#2d529f]">
        <Users className="size-3" /> {deptName || 'Department'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#e6f1e4] px-2 py-0.5 text-[11px] font-medium text-[#4a7a5a]">
      <Building2 className="size-3" /> Company-wide
    </span>
  )
}

function IndexingBadge({
  status,
  onRetry,
}: {
  status: EnterpriseDoc['indexing_status']
  onRetry?: () => void
}) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
        <Loader2 className="size-3 animate-spin" /> Indexing…
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#fbe4e0] px-2 py-0.5 text-[10px] font-medium text-[#9a3b2c]">
          Index failed
        </span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            title="Retry indexing"
            className="rounded p-0.5 text-xs text-[#9a3b2c] hover:bg-[#fbe4e0]"
          >
            <RefreshCw className="size-3" />
          </button>
        )}
      </span>
    )
  }
  return null
}

function UploadPanel({
  open,
  onToggle,
  categories,
  departments,
  onUploaded,
}: {
  open: boolean
  onToggle: () => void
  categories: string[]
  departments: Department[]
  onUploaded: (doc: EnterpriseDoc) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [scope, setScope] = useState<'company' | 'restricted' | 'department'>('company')
  const [deptId, setDeptId] = useState<number | ''>('')
  const [isOkf, setIsOkf] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file) {
      toast.error('Choose a file to upload.')
      return
    }
    if (scope === 'department' && !deptId) {
      toast.error('Please select a department.')
      return
    }
    setBusy(true)
    const form = new FormData()
    form.append('file', file)
    form.append('category', category.trim())
    form.append('description', description.trim())
    form.append('access_scope', scope)
    if (scope === 'department' && deptId) {
      form.append('department', String(deptId))
    }
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (tags.length > 0) {
      form.append('tags', JSON.stringify(tags))
    }
    form.append('is_okf', String(isOkf))

    try {
      const doc = await workApi.upload(form)
      onUploaded(doc)
      toast.success(`"${doc.filename}" uploaded.`)
      setFile(null)
      setCategory('')
      setDescription('')
      setTagsInput('')
      setScope('company')
      setDeptId('')
      setIsOkf(false)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#dedbd3] bg-[#fffdfa]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left ${focusRing}`}
      >
        <span className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-[#1d1d1b] text-white">
            <Upload className="size-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold">Upload a document</span>
            <span className="block text-xs text-[#6b6862]">Add a file and choose who can access it.</span>
          </span>
        </span>
        <ChevronDown
          className={`size-5 text-[#6b6862] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <form onSubmit={submit} className="space-y-4 border-t border-[#eae7df] p-5">
          <div>
            <label htmlFor="up-file" className="mb-1.5 block text-xs font-medium text-[#1d1d1b]">
              File
            </label>
            <input
              ref={fileRef}
              id="up-file"
              type="file"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-xl border border-[#d8d5cc] bg-[#fffdfa] text-xs file:mr-4 file:border-0 file:bg-[#f2efe8] file:px-4 file:py-2.5"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="up-category" className="mb-1.5 block text-xs font-medium text-[#1d1d1b]">
                Category
              </label>
              <input
                id="up-category"
                list="up-category-options"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. HR or Finance"
                className={inputClass}
              />
              <datalist id="up-category-options">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="up-tags" className="mb-1.5 block text-xs font-medium text-[#1d1d1b]">
                Tags (comma-separated)
              </label>
              <input
                id="up-tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="policy, 2026, handbook"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="up-description" className="mb-1.5 block text-xs font-medium text-[#1d1d1b]">
              Description
            </label>
            <input
              id="up-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this file for?"
              className={inputClass}
            />
          </div>

          <fieldset className="rounded-xl border border-[#eae7df] bg-[#faf8f3] p-4">
            <legend className="px-1 text-xs font-medium text-[#1d1d1b]">Who can access this document?</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label
                className={`cursor-pointer rounded-xl border p-3.5 ${
                  scope === 'company'
                    ? 'border-[#1d1d1b] bg-white ring-2 ring-[#1d1d1b]/10'
                    : 'border-[#dcdad3]'
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={scope === 'company'}
                  onChange={() => setScope('company')}
                />
                <span className="flex items-center gap-2 text-xs font-medium text-[#1d1d1b]">
                  <Building2 className="size-3.5" /> Entire company
                </span>
                <span className="mt-1 block text-[11px] leading-relaxed text-[#6b6862]">
                  All active members can search and view it.
                </span>
              </label>

              <label
                className={`cursor-pointer rounded-xl border p-3.5 ${
                  scope === 'department'
                    ? 'border-[#1d1d1b] bg-white ring-2 ring-[#1d1d1b]/10'
                    : 'border-[#dcdad3]'
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={scope === 'department'}
                  onChange={() => setScope('department')}
                />
                <span className="flex items-center gap-2 text-xs font-medium text-[#1d1d1b]">
                  <Users className="size-3.5" /> Department only
                </span>
                <span className="mt-1 block text-[11px] leading-relaxed text-[#6b6862]">
                  Scoped to one specific department.
                </span>
              </label>

              <label
                className={`cursor-pointer rounded-xl border p-3.5 ${
                  scope === 'restricted'
                    ? 'border-[#1d1d1b] bg-white ring-2 ring-[#1d1d1b]/10'
                    : 'border-[#dcdad3]'
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={scope === 'restricted'}
                  onChange={() => setScope('restricted')}
                />
                <span className="flex items-center gap-2 text-xs font-medium text-[#1d1d1b]">
                  <Lock className="size-3.5" /> Selected people
                </span>
                <span className="mt-1 block text-[11px] leading-relaxed text-[#6b6862]">
                  Only you and named grantees can view it.
                </span>
              </label>
            </div>

            {scope === 'department' && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-[#1d1d1b]">Select Department</label>
                <select
                  value={deptId}
                  onChange={(e) => setDeptId(e.target.value ? Number(e.target.value) : '')}
                  className={inputClass}
                  required
                >
                  <option value="">Choose department…</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.member_count} members)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </fieldset>

          <label className="flex items-center gap-2 text-xs text-[#4f4d47]">
            <input
              type="checkbox"
              checked={isOkf}
              onChange={(e) => setIsOkf(e.target.checked)}
            />
            Include as a trusted AI reference note (OKF)
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button type="submit" disabled={busy || !file} className={primaryBtn}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {busy ? 'Uploading…' : 'Upload document'}
            </button>
            <span className="text-xs text-[#6b6862]">{file?.name || 'No file selected'}</span>
          </div>
        </form>
      )}
    </div>
  )
}

function PreviewModal({
  doc,
  onClose,
}: {
  doc: EnterpriseDoc
  onClose: () => void
}) {
  const [data, setData] = useState<{
    id: number
    filename: string
    text: string
    truncated: boolean
    num_chunks: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    workApi
      .preview(doc.id)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not preview document.'))
      .finally(() => setLoading(false))
  }, [doc.id])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#eae7df] pb-3">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-[#1d1d1b]" />
            <h2 className="text-sm font-semibold text-[#1d1d1b]">{doc.filename}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#6b6862] hover:bg-[#efece4]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {loading ? (
            <div className="grid h-48 place-items-center text-xs text-[#6b6862]">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Loading extracted text…
              </span>
            </div>
          ) : error ? (
            <p className="rounded-xl bg-[#fbe4e0] p-4 text-xs text-[#9a3b2c]">{error}</p>
          ) : (
            <div>
              <p className="mb-2 text-[11px] text-[#6b6862]">
                Extracted text used for search and AI reasoning ({data?.num_chunks} chunks
                {data?.truncated ? ' · truncated for preview' : ''}):
              </p>
              <div className="rounded-2xl border border-[#eae7df] bg-[#f9f8f5] p-4 font-mono text-xs leading-relaxed text-[#2c2b29] whitespace-pre-wrap">
                {data?.text || '(No text content extracted)'}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-[#eae7df] pt-3">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function VersionsModal({
  doc,
  onClose,
  onUpdated,
}: {
  doc: EnterpriseDoc
  onClose: () => void
  onUpdated: (doc: EnterpriseDoc) => void
}) {
  const [versions, setVersions] = useState<
    { id: number; version_number: number; filename: string; size: number; created_at: string }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    workApi
      .versions(doc.id)
      .then(setVersions)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load versions.'))
      .finally(() => setLoading(false))
  }, [doc.id])

  useEffect(() => {
    load()
  }, [load])

  async function handleUpload(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const updated = await workApi.newVersion(doc.id, form)
      toast.success('New version uploaded.')
      setFile(null)
      onUpdated(updated)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload new version.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#eae7df] pb-3">
          <div className="flex items-center gap-2">
            <History className="size-4 text-[#1d1d1b]" />
            <h2 className="text-sm font-semibold text-[#1d1d1b]">Version history: {doc.filename}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#6b6862] hover:bg-[#efece4]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          <form onSubmit={handleUpload} className="rounded-2xl border border-[#eae7df] bg-[#faf8f3] p-3.5">
            <p className="text-xs font-semibold text-[#1d1d1b]">Upload new version</p>
            <p className="mt-0.5 text-[11px] text-[#6b6862]">
              The current file will be archived in version history.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="file"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs file:mr-3 file:rounded-xl file:border-0 file:bg-[#f0ede6] file:px-3 file:py-1.5"
              />
              <button
                type="submit"
                disabled={uploading || !file}
                className={primaryBtn}
              >
                {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
                Upload
              </button>
            </div>
            {error && <p className="mt-2 text-xs text-[#9a3b2c]">{error}</p>}
          </form>

          <div>
            <p className="mb-2 text-xs font-semibold text-[#6b6862]">Past versions</p>
            {loading ? (
              <p className="text-xs text-[#6b6862]">Loading versions…</p>
            ) : versions.length === 0 ? (
              <p className="text-xs text-[#6b6862]">No previous versions on file.</p>
            ) : (
              <ul className="space-y-2">
                {versions.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between rounded-xl border border-[#eae7df] bg-white p-3 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#1d1d1b]">Version {v.version_number}</span>
                      <p className="text-[#6b6862]">
                        {v.filename} · {formatBytes(v.size)} · {formatDate(v.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-[#eae7df] pt-3">
          <button type="button" onClick={onClose} className={ghostBtn}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function EditMetadataModal({
  doc,
  departments,
  onClose,
  onSaved,
}: {
  doc: EnterpriseDoc
  departments: Department[]
  onClose: () => void
  onSaved: (doc: EnterpriseDoc) => void
}) {
  const [description, setDescription] = useState(doc.description || '')
  const [category, setCategory] = useState(doc.category || '')
  const [tagsInput, setTagsInput] = useState((doc.tags || []).join(', '))
  const [scope, setScope] = useState<EnterpriseDoc['access_scope']>(doc.access_scope)
  const [deptId, setDeptId] = useState<number | ''>(doc.department ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const updated = await workApi.updateDoc(doc.id, {
        description: description.trim(),
        category: category.trim(),
        tags,
        access_scope: scope,
        department: scope === 'department' && deptId ? Number(deptId) : null,
      })
      toast.success('Document updated.')
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#eae7df] pb-3">
          <h2 className="text-sm font-semibold text-[#1d1d1b]">Edit document metadata</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#6b6862] hover:bg-[#efece4]"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1d1d1b]">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#1d1d1b]">Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#1d1d1b]">Tags (comma separated)</label>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#1d1d1b]">Access Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as EnterpriseDoc['access_scope'])}
              className={inputClass}
            >
              <option value="company">Company-wide</option>
              <option value="department">Department</option>
              <option value="restricted">Restricted (selected people)</option>
            </select>
          </div>

          {scope === 'department' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[#1d1d1b]">Department</label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value ? Number(e.target.value) : '')}
                className={inputClass}
              >
                <option value="">Select department…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-xs text-[#9a3b2c]">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className={ghostBtn}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={primaryBtn}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ShareDialog({ doc, onClose }: { doc: EnterpriseDoc; onClose: () => void }) {
  const [shares, setShares] = useState<DocumentShareRow[]>([])
  const [code, setCode] = useState('')
  const [company, setCompany] = useState<CompanyDirectory | null>(null)
  const [members, setMembers] = useState<MemberDirectory[]>([])
  const [selectedId, setSelectedId] = useState<number | ''>('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    shareApi
      .list(doc.id)
      .then(setShares)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load access.'))
      .finally(() => setLoading(false))
  }, [doc.id])

  useEffect(() => {
    load()
  }, [load])

  async function findCompany(e: FormEvent) {
    e.preventDefault()
    setCompany(null)
    setMembers([])
    setSelectedId('')
    setSearching(true)
    const normalized = code.trim().toUpperCase()
    try {
      const found = await companyApi.search(normalized)
      const people = await companyApi.members(found.access_code)
      setCompany(found)
      setMembers(people)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Company lookup failed.')
    } finally {
      setSearching(false)
    }
  }

  async function addShare(e: FormEvent) {
    e.preventDefault()
    if (!company || selectedId === '') return
    setAdding(true)
    try {
      const row = await shareApi.add(doc.id, {
        access_code: company.access_code,
        user_id: selectedId,
      })
      setShares((prev) => [row, ...prev.filter((x) => x.user_id !== row.user_id)])
      setSelectedId('')
      toast.success('Access granted.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not grant access.')
    } finally {
      setAdding(false)
    }
  }

  async function revoke(id: number) {
    setRemoving(id)
    try {
      await shareApi.remove(doc.id, id)
      setShares((prev) => prev.filter((x) => x.user_id !== id))
      toast.success('Access revoked.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not revoke access.')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#eae7df] p-5">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Share2 className="size-4" /> Control document access
            </p>
            <p className="mt-1 truncate text-xs text-[#6b6862]">{displayTitle(doc.filename)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-full text-[#6b6862] hover:bg-[#efece4]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl bg-[#f5f2ea] p-4">
            <p className="text-xs font-semibold">Find a registered company</p>
            <p className="mt-0.5 text-xs text-[#6b6862]">
              Enter company code to grant specific employees cross-tenant access.
            </p>
            <form onSubmit={findCompany} className="mt-3 flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={5}
                placeholder="Company code, e.g. A7K2Q"
                className={`${inputClass} uppercase`}
              />
              <button
                type="submit"
                disabled={searching || code.trim().length < 3}
                className={primaryBtn}
              >
                {searching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                Find
              </button>
            </form>
          </div>

          {company && (
            <form onSubmit={addShare} className="rounded-xl border border-[#dcdad3] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold">{company.name}</p>
                  <p className="text-[11px] text-[#6b6862]">
                    Code {company.access_code} · {company.member_count} members
                  </p>
                </div>
                <Building2 className="size-4 text-[#6b6862]" />
              </div>
              <div className="mt-3 flex gap-2">
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : '')}
                  className={`${inputClass} flex-1`}
                >
                  <option value="">Choose employee…</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name || `Member #${m.id}`}
                      {m.title ? ` · ${m.title}` : ''} ({m.role})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={adding || selectedId === ''}
                  className={primaryBtn}
                >
                  {adding ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                  Share
                </button>
              </div>
            </form>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#6b6862]">
              Named people with access
            </p>
            {loading ? (
              <p className="flex items-center gap-2 text-xs text-[#6b6862]">
                <Loader2 className="size-3.5 animate-spin" /> Loading…
              </p>
            ) : shares.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#dcdad3] px-4 py-4 text-center text-xs text-[#6b6862]">
                No named recipients yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {shares.map((s) => (
                  <li
                    key={s.user_id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#eae7df] bg-[#faf8f3] px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">
                        {s.full_name || s.email}
                        {s.title ? ` · ${s.title}` : ''}
                      </p>
                      <p className="truncate text-[11px] text-[#6b6862]">
                        {s.email} · {s.company_name || 'Company'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => revoke(s.user_id)}
                      disabled={removing === s.user_id}
                      className={dangerBtn}
                    >
                      {removing === s.user_id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Trash2 className="size-3" />
                      )}
                      Revoke
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

export default function DocumentsPage() {
  const { user } = useAuth()
  const [docs, setDocs] = useState<EnterpriseDoc[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [departments, setDepartments] = useState<Department[]>([])

  // Selection & Actions state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [uploadOpen, setUploadOpen] = useState(false)
  const [shareDoc, setShareDoc] = useState<EnterpriseDoc | null>(null)
  const [confirmDoc, setConfirmDoc] = useState<EnterpriseDoc | null>(null)
  const [confirmBatch, setConfirmBatch] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<EnterpriseDoc | null>(null)
  const [versionsDoc, setVersionsDoc] = useState<EnterpriseDoc | null>(null)
  const [editDoc, setEditDoc] = useState<EnterpriseDoc | null>(null)

  const [busy, setBusy] = useState<Set<number>>(new Set())
  const [actionError, setActionError] = useState('')

  const load = useCallback((targetPage = 1) => {
    setLoading(true)
    setLoadError('')
    workApi
      .documents(targetPage, 50)
      .then((res) => {
        setDocs(res.results || [])
        setTotalCount(res.count || 0)
        setPage(res.page || 1)
        setPages(res.pages || 1)
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load documents.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load(1)
    companyApi2.departments().then(setDepartments).catch(() => setDepartments([]))
  }, [load])

  const categories = useMemo(
    () => [...new Set(docs.map((d) => d.category).filter(Boolean))].sort(),
    [docs],
  )

  const allTags = useMemo(() => {
    const s = new Set<string>()
    for (const d of docs) {
      if (Array.isArray(d.tags)) {
        for (const t of d.tags) if (t) s.add(t)
      }
    }
    return [...s].sort()
  }, [docs])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return docs
      .filter((d) => {
        if (category && d.category !== category) return false
        if (selectedTag && (!d.tags || !d.tags.includes(selectedTag))) return false
        if (q) {
          const tagsStr = (d.tags || []).join(' ')
          const target = `${d.filename} ${d.description} ${d.category} ${tagsStr}`.toLowerCase()
          if (!target.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => {
        if (sort === 'name') return displayTitle(a.filename).localeCompare(displayTitle(b.filename))
        if (sort === 'downloads') return b.downloads - a.downloads
        return +new Date(b.created_at) - +new Date(a.created_at)
      })
  }, [docs, query, category, selectedTag, sort])

  const setBusyFor = (id: number, val: boolean) =>
    setBusy((prev) => {
      const n = new Set(prev)
      val ? n.add(id) : n.delete(id)
      return n
    })

  async function download(doc: EnterpriseDoc) {
    setActionError('')
    setBusyFor(doc.id, true)
    try {
      await downloadOwnDocument(doc.id, doc.filename)
      setDocs((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, downloads: d.downloads + 1 } : d)),
      )
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Download failed.')
    } finally {
      setBusyFor(doc.id, false)
    }
  }

  async function retryIndex(doc: EnterpriseDoc) {
    setBusyFor(doc.id, true)
    try {
      const updated = await workApi.reindex(doc.id)
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? updated : d)))
      toast.success(`Reindexing triggered for "${doc.filename}".`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reindexing failed.')
    } finally {
      setBusyFor(doc.id, false)
    }
  }

  async function remove(doc: EnterpriseDoc) {
    setBusyFor(doc.id, true)
    try {
      await workApi.remove(doc.id)
      setDocs((prev) => prev.filter((d) => d.id !== doc.id))
      setSelectedIds((prev) => {
        const n = new Set(prev)
        n.delete(doc.id)
        return n
      })
      toast.success('Document deleted.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete document.')
    } finally {
      setBusyFor(doc.id, false)
      setConfirmDoc(null)
    }
  }

  async function batchDelete() {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    try {
      await Promise.all(ids.map((id) => workApi.remove(id)))
      setDocs((prev) => prev.filter((d) => !selectedIds.has(d.id)))
      setSelectedIds(new Set())
      toast.success(`${ids.length} documents deleted.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Batch delete encountered errors.')
    } finally {
      setConfirmBatch(false)
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === visible.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visible.map((d) => d.id)))
    }
  }

  if (!user) return null
  const editor = user.role === 'admin' || user.role === 'employee'

  return (
    <div className="pb-8">
      <header className="flex flex-col gap-4 border-b border-[#e6e3dc] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={eyebrow}>Employer workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
            Your team&apos;s <span className="font-serif font-normal italic">vault.</span>
          </h1>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-[#6b6862]">
            Store company knowledge, control access by person or department, and collaborate with registered partners.
          </p>
        </div>
        {editor && (
          <button
            type="button"
            onClick={() => setUploadOpen((v) => !v)}
            className={primaryBtn}
          >
            <Upload className="size-3.5" /> Upload document
          </button>
        )}
      </header>

      {/* Stats Cards */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4">
          <p className="text-[11px] uppercase tracking-[0.1em] text-[#6b6862]">Documents</p>
          <p className="mt-1 text-2xl font-semibold">{totalCount || docs.length}</p>
        </div>
        <div className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4">
          <p className="text-[11px] uppercase tracking-[0.1em] text-[#6b6862]">Restricted</p>
          <p className="mt-1 text-2xl font-semibold">
            {docs.filter((d) => d.access_scope === 'restricted').length}
          </p>
        </div>
        <div className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4">
          <p className="text-[11px] uppercase tracking-[0.1em] text-[#6b6862]">Indexed chunks</p>
          <p className="mt-1 text-2xl font-semibold">
            {docs.reduce((n, d) => n + (d.num_chunks || 0), 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4">
          <p className="text-[11px] uppercase tracking-[0.1em] text-[#6b6862]">Downloads</p>
          <p className="mt-1 text-2xl font-semibold">
            {docs.reduce((n, d) => n + (d.downloads || 0), 0)}
          </p>
        </div>
      </section>

      {editor && (
        <section className="mt-5">
          <UploadPanel
            open={uploadOpen}
            onToggle={() => setUploadOpen((v) => !v)}
            categories={categories}
            departments={departments}
            onUploaded={(d) => {
              setDocs((prev) => [d, ...prev])
              setTotalCount((c) => c + 1)
            }}
          />
        </section>
      )}

      {/* Filter and search bar */}
      <section className="mt-6 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex h-11 flex-1 items-center rounded-xl border border-[#d8d5cc] bg-[#fffdfa]">
            <Search className="absolute left-3.5 size-4 text-[#6b6862]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search documents"
              placeholder="Search by title, description, category, tags…"
              className="h-full w-full bg-transparent pl-10 pr-4 text-xs outline-none"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={`${inputClass} sm:w-44`}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className={`${inputClass} sm:w-40`}
          >
            <option value="recent">Most recent</option>
            <option value="downloads">Most downloaded</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>

        {/* Tag Filter Chips */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-medium text-[#6b6862]">Tags:</span>
            <button
              type="button"
              onClick={() => setSelectedTag('')}
              className={`rounded-full px-2.5 py-0.5 text-[11px] transition ${
                !selectedTag ? 'bg-[#1d1d1b] text-white' : 'bg-[#f0ede6] text-[#6b6862] hover:bg-[#e6e3dc]'
              }`}
            >
              All
            </button>
            {allTags.map((tg) => (
              <button
                key={tg}
                type="button"
                onClick={() => setSelectedTag(selectedTag === tg ? '' : tg)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] transition ${
                  selectedTag === tg
                    ? 'bg-[#1d1d1b] text-white'
                    : 'bg-[#f0ede6] text-[#4f4d47] hover:bg-[#e6e3dc]'
                }`}
              >
                <Tag className="size-2.5" />
                {tg}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Batch toolbar */}
      {editor && visible.length > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-[#eae7df] bg-[#faf8f3] px-4 py-2 text-xs">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedIds.size > 0 && selectedIds.size === visible.length}
              onChange={toggleSelectAll}
              className="size-4 rounded"
            />
            <span className="text-[#6b6862]">
              {selectedIds.size > 0
                ? `${selectedIds.size} of ${visible.length} selected`
                : 'Select all'}
            </span>
          </div>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setConfirmBatch(true)}
              className={dangerBtn}
            >
              <Trash2 className="size-3" /> Delete selected ({selectedIds.size})
            </button>
          )}
        </div>
      )}

      {actionError && (
        <p
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-xl bg-[#fbe4e0] px-4 py-3 text-xs text-[#9a3b2c]"
        >
          <AlertCircle className="size-4" />
          {actionError}
        </p>
      )}

      {/* Document List */}
      <section className="mt-4">
        {loading ? (
          <p className="flex items-center gap-2 text-xs text-[#6b6862]">
            <Loader2 className="size-4 animate-spin" /> Loading documents…
          </p>
        ) : loadError ? (
          <div className="rounded-3xl border border-[#e6c9c1] bg-[#fbe4e0] p-10 text-center">
            <p className="text-xs text-[#9a3b2c]">{loadError}</p>
            <button onClick={() => load(page)} className={`mt-4 ${ghostBtn}`}>
              Try again
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-12 text-center">
            <p className="font-serif text-xl italic">No documents found.</p>
            <p className="mt-1 text-xs text-[#6b6862]">Upload a document or change filters.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((doc) => (
              <li
                key={doc.id}
                className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4 transition hover:border-[#dcdad3]"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    {editor && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(doc.id)}
                        onChange={() => toggleSelect(doc.id)}
                        className="mt-1 size-4 rounded"
                      />
                    )}
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f2efe8]">
                      <FileText className="size-4 text-[#5d5b55]" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2
                          className="truncate text-xs font-semibold text-[#1d1d1b]"
                          title={doc.filename}
                        >
                          {displayTitle(doc.filename)}
                        </h2>
                        <AccessBadge
                          scope={doc.access_scope}
                          deptName={doc.department_name}
                        />
                        <IndexingBadge
                          status={doc.indexing_status}
                          onRetry={() => retryIndex(doc)}
                        />
                        {doc.version > 1 && (
                          <span className="rounded bg-[#f0ede6] px-1.5 py-0.5 text-[10px] text-[#6b6862]">
                            v{doc.version}
                          </span>
                        )}
                      </div>

                      {doc.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-[#6b6862]">
                          {doc.description}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#6b6862]">
                        <span>{doc.category || 'Uncategorized'}</span>
                        <span>·</span>
                        <span>{formatBytes(doc.size)}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Layers className="size-3" />
                          {doc.num_chunks} chunks
                        </span>
                        <span>·</span>
                        <span>{formatDate(doc.created_at)}</span>

                        {doc.tags && doc.tags.length > 0 && (
                          <>
                            <span>·</span>
                            <div className="flex flex-wrap gap-1">
                              {doc.tags.map((tg) => (
                                <span
                                  key={tg}
                                  className="rounded bg-[#f4f2ec] px-1.5 py-0.2 text-[10px] text-[#555]"
                                >
                                  #{tg}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className={ghostBtn}
                      title="Preview extracted text"
                    >
                      <Eye className="size-3.5" /> Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => download(doc)}
                      disabled={busy.has(doc.id)}
                      className={ghostBtn}
                    >
                      {busy.has(doc.id) ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Download className="size-3.5" />
                      )}
                      Download
                    </button>
                    {editor && (
                      <>
                        <button
                          type="button"
                          onClick={() => setVersionsDoc(doc)}
                          className={ghostBtn}
                          title="Version history"
                        >
                          <History className="size-3.5" /> Versions
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditDoc(doc)}
                          className={ghostBtn}
                          title="Edit metadata"
                        >
                          <Pencil className="size-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setShareDoc(doc)}
                          disabled={busy.has(doc.id)}
                          className={ghostBtn}
                        >
                          <Share2 className="size-3.5" /> Share
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDoc(doc)}
                          disabled={busy.has(doc.id)}
                          className={dangerBtn}
                        >
                          <Trash2 className="size-3.5" /> Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Pagination controls */}
        {pages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-[#eae7df] pt-4">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => load(page - 1)}
              className={ghostBtn}
            >
              Previous
            </button>
            <span className="text-xs text-[#6b6862]">
              Page {page} of {pages} ({totalCount} total documents)
            </span>
            <button
              type="button"
              disabled={page >= pages || loading}
              onClick={() => load(page + 1)}
              className={ghostBtn}
            >
              Next
            </button>
          </div>
        )}
      </section>

      {/* Modals */}
      {shareDoc && <ShareDialog doc={shareDoc} onClose={() => setShareDoc(null)} />}
      {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
      {versionsDoc && (
        <VersionsModal
          doc={versionsDoc}
          onClose={() => setVersionsDoc(null)}
          onUpdated={(updated) => {
            setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
          }}
        />
      )}
      {editDoc && (
        <EditMetadataModal
          doc={editDoc}
          departments={departments}
          onClose={() => setEditDoc(null)}
          onSaved={(updated) => {
            setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
          }}
        />
      )}

      {/* Confirm Single Delete */}
      <ConfirmDialog
        open={!!confirmDoc}
        title="Delete document"
        message={
          confirmDoc
            ? `Delete “${displayTitle(confirmDoc.filename)}”? This cannot be undone.`
            : ''
        }
        confirmText="Delete"
        danger={true}
        loading={confirmDoc ? busy.has(confirmDoc.id) : false}
        onConfirm={() => confirmDoc && remove(confirmDoc)}
        onCancel={() => setConfirmDoc(null)}
      />

      {/* Confirm Batch Delete */}
      <ConfirmDialog
        open={confirmBatch}
        title="Delete selected documents"
        message={`Delete ${selectedIds.size} selected documents? This cannot be undone.`}
        confirmText="Delete all"
        danger={true}
        loading={false}
        onConfirm={batchDelete}
        onCancel={() => setConfirmBatch(false)}
      />
    </div>
  )
}
