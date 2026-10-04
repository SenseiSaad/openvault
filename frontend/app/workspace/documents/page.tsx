'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, Building2, CheckCircle2, ChevronDown, Download, FileText, Layers, Loader2, Lock, Search, Share2, Trash2, Upload, UserPlus, X } from 'lucide-react'
import { companyApi, downloadOwnDocument, shareApi, workApi, type CompanyDirectory, type DocumentShareRow, type EnterpriseDoc, type MemberDirectory } from '@/lib/api'
import { useAuth } from '@/lib/auth'

type Sort = 'recent' | 'downloads' | 'name'
const eyebrow = 'text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]'
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f6f2]'
const inputClass = 'h-12 w-full rounded-xl border border-[#d8d5cc] bg-[#fffdfa] px-4 text-sm text-[#1d1d1b] outline-none placeholder:text-[#9b9890] focus:border-[#1d1d1b]'
const primaryBtn = `inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#1d1d1b] px-5 text-sm font-medium text-white hover:bg-[#3c3b37] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`
const ghostBtn = `inline-flex items-center justify-center gap-2 rounded-full border border-[#dcdad3] bg-[#fffdfa] px-4 py-2 text-sm text-[#1d1d1b] hover:border-[#1d1d1b] disabled:opacity-60 ${focusRing}`
const dangerBtn = `inline-flex items-center gap-1.5 rounded-full border border-[#e6c9c1] bg-[#fffdfa] px-3 py-2 text-sm text-[#9a3b2c] hover:border-[#9a3b2c] hover:bg-[#fbe4e0] disabled:opacity-50 ${focusRing}`

function formatBytes(n: number) { if (!n || n < 0) return '0 B'; if (n < 1024) return `${n} B`; if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`; return `${(n / (1024 * 1024)).toFixed(1)} MB` }
function formatDate(iso: string) { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
function displayTitle(filename: string) { const base = filename.replace(/\.(md|markdown|txt|pdf|docx?|pptx?|xlsx?|csv|rtf|json|ya?ml|html?|xml)$/i, ''); return base.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || filename }

function AccessBadge({ scope }: { scope: EnterpriseDoc['access_scope'] }) {
  return scope === 'restricted' ? <span className="inline-flex items-center gap-1 rounded-full bg-[#fff0d3] px-2 py-0.5 text-[11px] font-medium text-[#8a6316]"><Lock className="size-3" /> Selected people</span> : <span className="inline-flex items-center gap-1 rounded-full bg-[#e6f1e4] px-2 py-0.5 text-[11px] font-medium text-[#4a7a5a]"><Building2 className="size-3" /> Company-wide</span>
}

function UploadPanel({ open, onToggle, categories, onUploaded }: { open: boolean; onToggle: () => void; categories: string[]; onUploaded: (doc: EnterpriseDoc) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<'company' | 'restricted'>('company')
  const [isOkf, setIsOkf] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setOk('')
    if (!file) { setError('Choose a file to upload.'); return }
    setBusy(true)
    const form = new FormData(); form.append('file', file); form.append('category', category.trim()); form.append('description', description.trim()); form.append('access_scope', scope); form.append('is_okf', String(isOkf))
    try {
      const doc = await workApi.upload(form); onUploaded(doc); setOk(`"${doc.filename}" uploaded and indexed.`); setFile(null); setCategory(''); setDescription(''); setScope('company'); setIsOkf(false); if (fileRef.current) fileRef.current.value = ''
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed.') } finally { setBusy(false) }
  }

  return <div className="rounded-2xl border border-[#dedbd3] bg-[#fffdfa]">
    <button type="button" onClick={onToggle} aria-expanded={open} className={`flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left ${focusRing}`}><span className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#1d1d1b] text-white"><Upload className="size-4" /></span><span><span className="block text-sm font-semibold">Upload a document</span><span className="block text-xs text-[#8c8a83]">Add a file and choose who can access it.</span></span></span><ChevronDown className={`size-5 text-[#8c8a83] transition-transform ${open ? 'rotate-180' : ''}`} /></button>
    {open && <form onSubmit={submit} className="space-y-4 border-t border-[#eae7df] p-5">
      {error && <p role="alert" className="flex items-center gap-2 rounded-xl bg-[#fbe4e0] px-4 py-3 text-sm text-[#9a3b2c]"><AlertCircle className="size-4" />{error}</p>}
      {ok && <p role="status" className="flex items-center gap-2 rounded-xl bg-[#e6f1e4] px-4 py-3 text-sm text-[#3f6b4f]"><CheckCircle2 className="size-4" />{ok}</p>}
      <div><label htmlFor="up-file" className="mb-1.5 block text-sm font-medium">File</label><input ref={fileRef} id="up-file" type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full rounded-xl border border-[#d8d5cc] bg-[#fffdfa] text-sm file:mr-4 file:border-0 file:bg-[#f2efe8] file:px-4 file:py-3" /></div>
      <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="up-category" className="mb-1.5 block text-sm font-medium">Category</label><input id="up-category" list="up-category-options" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. HR or Finance" className={inputClass} /><datalist id="up-category-options">{categories.map((c) => <option key={c} value={c} />)}</datalist></div><div><label htmlFor="up-description" className="mb-1.5 block text-sm font-medium">Description</label><input id="up-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this file for?" className={inputClass} /></div></div>
      <fieldset className="rounded-xl border border-[#eae7df] bg-[#faf8f3] p-4"><legend className="px-1 text-sm font-medium">Who can access this document?</legend><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className={`cursor-pointer rounded-xl border p-4 ${scope === 'company' ? 'border-[#1d1d1b] bg-white ring-2 ring-[#1d1d1b]/10' : 'border-[#dcdad3]'}`}><input type="radio" className="sr-only" checked={scope === 'company'} onChange={() => setScope('company')} /><span className="flex items-center gap-2 text-sm font-medium"><Building2 className="size-4" /> Entire company</span><span className="mt-1 block text-xs leading-relaxed text-[#77746c]">Every active member in this company can search and download it.</span></label><label className={`cursor-pointer rounded-xl border p-4 ${scope === 'restricted' ? 'border-[#1d1d1b] bg-white ring-2 ring-[#1d1d1b]/10' : 'border-[#dcdad3]'}`}><input type="radio" className="sr-only" checked={scope === 'restricted'} onChange={() => setScope('restricted')} /><span className="flex items-center gap-2 text-sm font-medium"><Lock className="size-4" /> Selected people</span><span className="mt-1 block text-xs leading-relaxed text-[#77746c]">Only you can see it until you grant access to specific HR, CEO, or partner employees.</span></label></div></fieldset>
      <label className="flex items-center gap-2 text-sm text-[#4f4d47]"><input type="checkbox" checked={isOkf} onChange={(e) => setIsOkf(e.target.checked)} /> Include as a trusted AI reference note</label>
      <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={busy || !file} className={primaryBtn}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{busy ? 'Uploading…' : 'Upload document'}</button><span className="text-xs text-[#8c8a83]">{file?.name || 'No file selected'}</span></div>
    </form>}
  </div>
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
  const [error, setError] = useState('')

  const load = useCallback(() => { setLoading(true); shareApi.list(doc.id).then(setShares).catch((e) => setError(e instanceof Error ? e.message : 'Could not load access.')).finally(() => setLoading(false)) }, [doc.id])
  useEffect(() => { load() }, [load])
  useEffect(() => { const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn) }, [onClose])

  async function findCompany(e: FormEvent) { e.preventDefault(); setError(''); setCompany(null); setMembers([]); setSelectedId(''); setSearching(true); const normalized = code.trim().toUpperCase(); try { const found = await companyApi.search(normalized); const people = await companyApi.members(found.access_code); setCompany(found); setMembers(people); } catch (err) { setError(err instanceof Error ? err.message : 'Company lookup failed.') } finally { setSearching(false) } }
  async function addShare(e: FormEvent) { e.preventDefault(); if (!company || selectedId === '') return; setError(''); setAdding(true); try { const row = await shareApi.add(doc.id, { access_code: company.access_code, user_id: selectedId }); setShares((prev) => [row, ...prev.filter((x) => x.user_id !== row.user_id)]); setSelectedId('') } catch (err) { setError(err instanceof Error ? err.message : 'Could not grant access.') } finally { setAdding(false) } }
  async function revoke(id: number) { setError(''); setRemoving(id); try { await shareApi.remove(doc.id, id); setShares((prev) => prev.filter((x) => x.user_id !== id)) } catch (err) { setError(err instanceof Error ? err.message : 'Could not revoke access.') } finally { setRemoving(null) } }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" role="dialog" aria-modal="true" onClick={onClose}><div className="w-full max-w-2xl rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] shadow-xl" onClick={(e) => e.stopPropagation()}>
    <div className="flex items-start justify-between gap-3 border-b border-[#eae7df] p-5"><div><p className="flex items-center gap-2 text-sm font-semibold"><Share2 className="size-4" /> Control document access</p><p className="mt-1 truncate text-sm text-[#77746c]">{displayTitle(doc.filename)}</p></div><button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full text-[#8c8a83] hover:bg-[#efece4]"><X className="size-4" /></button></div>
    <div className="space-y-5 p-5"><div className="rounded-xl bg-[#f5f2ea] p-4"><p className="text-sm font-medium">Find a registered company</p><p className="mt-1 text-xs leading-relaxed text-[#77746c]">Ask the receiving employer for its five-character company code. Then choose the exact employee who should receive this one file.</p><form onSubmit={findCompany} className="mt-3 flex gap-2"><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={5} placeholder="Company code, e.g. A7K2Q" className={`${inputClass} uppercase`} /><button type="submit" disabled={searching || code.trim().length < 3} className={primaryBtn}>{searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}Find</button></form></div>
      {company && <form onSubmit={addShare} className="rounded-xl border border-[#dcdad3] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">{company.name}</p><p className="text-xs text-[#8c8a83]">Company code {company.access_code} · {company.member_count} registered members</p></div><Building2 className="size-5 text-[#8c8a83]" /></div><div className="mt-3 flex gap-2"><select value={selectedId} onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : '')} className={`${inputClass} flex-1`}><option value="">Choose a specific employee…</option>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}{m.title ? ` · ${m.title}` : ''} · {m.role}</option>)}</select><button type="submit" disabled={adding || selectedId === ''} className={primaryBtn}>{adding ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}Share</button></div>{members.length === 0 && <p className="mt-2 text-xs text-[#9a3b2c]">That company has no active enterprise members yet.</p>}</form>}
      {error && <p role="alert" className="flex items-center gap-2 rounded-xl bg-[#fbe4e0] px-4 py-3 text-sm text-[#9a3b2c]"><AlertCircle className="size-4" />{error}</p>}
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8c8a83]">Named people with access</p>{loading ? <p className="flex items-center gap-2 text-sm text-[#77746c]"><Loader2 className="size-4 animate-spin" /> Loading…</p> : shares.length === 0 ? <p className="rounded-xl border border-dashed border-[#dcdad3] px-4 py-6 text-center text-sm text-[#98958c]">No named recipients yet. The uploader can still access this document.</p> : <ul className="space-y-2">{shares.map((s) => <li key={s.user_id} className="flex items-center justify-between gap-3 rounded-xl border border-[#eae7df] bg-[#faf8f3] px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{s.full_name || s.email}{s.title ? ` · ${s.title}` : ''}</p><p className="truncate text-xs text-[#8c8a83]">{s.email} · {s.company_name || 'Company'}{s.access_code ? ` · ${s.access_code}` : ''}</p></div><button type="button" onClick={() => revoke(s.user_id)} disabled={removing === s.user_id} className={dangerBtn}>{removing === s.user_id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}Revoke</button></li>)}</ul>}</div>
    </div>
  </div></div>
}

export default function DocumentsPage() {
  const { user } = useAuth()
  const [docs, setDocs] = useState<EnterpriseDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [shareDoc, setShareDoc] = useState<EnterpriseDoc | null>(null)
  const [busy, setBusy] = useState<Set<number>>(new Set())
  const [actionError, setActionError] = useState('')
  const load = useCallback(() => { setLoading(true); setLoadError(''); workApi.documents().then(setDocs).catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load documents.')).finally(() => setLoading(false)) }, [])
  useEffect(() => { load() }, [load])
  const categories = useMemo(() => [...new Set(docs.map((d) => d.category).filter(Boolean))].sort(), [docs])
  const visible = useMemo(() => { const q = query.trim().toLowerCase(); return docs.filter((d) => (!category || d.category === category) && (!q || `${d.filename} ${d.description} ${d.category}`.toLowerCase().includes(q))).sort((a, b) => sort === 'name' ? displayTitle(a.filename).localeCompare(displayTitle(b.filename)) : sort === 'downloads' ? b.downloads - a.downloads : +new Date(b.created_at) - +new Date(a.created_at)) }, [docs, query, category, sort])
  const setBusyFor = (id: number, value: boolean) => setBusy((prev) => { const n = new Set(prev); value ? n.add(id) : n.delete(id); return n })
  async function download(doc: EnterpriseDoc) { setActionError(''); setBusyFor(doc.id, true); try { await downloadOwnDocument(doc.id, doc.filename) } catch (e) { setActionError(e instanceof Error ? e.message : 'Download failed.') } finally { setBusyFor(doc.id, false) } }
  async function remove(doc: EnterpriseDoc) { if (!window.confirm(`Delete “${displayTitle(doc.filename)}”? This cannot be undone.`)) return; setBusyFor(doc.id, true); try { await workApi.remove(doc.id); setDocs((prev) => prev.filter((d) => d.id !== doc.id)) } catch (e) { setActionError(e instanceof Error ? e.message : 'Could not delete document.') } finally { setBusyFor(doc.id, false) } }
  if (!user) return null
  const editor = user.role === 'admin' || user.role === 'employee'
  return <div className="pb-6"><header className="flex flex-col gap-5 border-b border-[#e6e3dc] pb-8 sm:flex-row sm:items-end sm:justify-between"><div><p className={eyebrow}>Employer workspace</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Your team&apos;s <span className="font-serif font-normal italic">vault.</span></h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-[#77746c]">Store company knowledge, control access by person, and collaborate with registered partners without exposing your whole library.</p></div>{editor && <button type="button" onClick={() => setUploadOpen((v) => !v)} className={primaryBtn}><Upload className="size-4" /> Upload document</button>}</header>
    <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[#8c8a83]">Documents</p><p className="mt-2 text-2xl font-semibold">{docs.length}</p></div><div className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[#8c8a83]">Restricted</p><p className="mt-2 text-2xl font-semibold">{docs.filter((d) => d.access_scope === 'restricted').length}</p></div><div className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[#8c8a83]">Indexed chunks</p><p className="mt-2 text-2xl font-semibold">{docs.reduce((n, d) => n + d.num_chunks, 0)}</p></div><div className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4"><p className="text-xs uppercase tracking-[0.1em] text-[#8c8a83]">Downloads</p><p className="mt-2 text-2xl font-semibold">{docs.reduce((n, d) => n + d.downloads, 0)}</p></div></section>
    {editor && <section className="mt-6"><UploadPanel open={uploadOpen} onToggle={() => setUploadOpen((v) => !v)} categories={categories} onUploaded={(d) => setDocs((prev) => [d, ...prev])} /></section>}
    <section className="mt-8 flex flex-col gap-3 sm:flex-row"><div className="relative flex h-12 flex-1 items-center rounded-xl border border-[#d8d5cc] bg-[#fffdfa]"><Search className="absolute left-4 size-5 text-[#8c8a83]" /><input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search documents" placeholder="Search your permitted documents…" className="h-full w-full bg-transparent pl-12 pr-4 text-sm outline-none" /></div><select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputClass} sm:w-48`}><option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select><select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={`${inputClass} sm:w-44`}><option value="recent">Most recent</option><option value="downloads">Most downloaded</option><option value="name">Name A–Z</option></select></section>
    {actionError && <p role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-[#fbe4e0] px-4 py-3 text-sm text-[#9a3b2c]"><AlertCircle className="size-4" />{actionError}</p>}
    <p className="mt-4 text-xs text-[#8c8a83]">{loading ? 'Loading documents…' : loadError ? loadError : `Showing ${visible.length} of ${docs.length} permitted document${docs.length === 1 ? '' : 's'}`}</p>
    <section className="mt-4">{loading ? <p className="flex items-center gap-2 text-sm text-[#77746c]"><Loader2 className="size-4 animate-spin" /> Loading your vault…</p> : loadError ? <div className="rounded-3xl border border-[#e6c9c1] bg-[#fbe4e0] p-10 text-center"><p className="text-sm text-[#9a3b2c]">{loadError}</p><button onClick={load} className={`mt-5 ${ghostBtn}`}>Try again</button></div> : visible.length === 0 ? <div className="rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-12 text-center"><p className="font-serif text-2xl italic">No permitted documents yet.</p><p className="mt-2 text-sm text-[#98958c]">Upload a document or ask an employer admin to grant you access.</p></div> : <ul className="space-y-3">{visible.map((doc) => <li key={doc.id} className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f2efe8]"><FileText className="size-5 text-[#5d5b55]" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-semibold" title={doc.filename}>{displayTitle(doc.filename)}</h2><AccessBadge scope={doc.access_scope} /></div>{doc.description && <p className="mt-1 line-clamp-2 text-sm text-[#77746c]">{doc.description}</p>}<p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#98958c]"><span>{doc.category || 'Uncategorized'}</span><span>·</span><span>{formatBytes(doc.size)}</span><span>·</span><span className="inline-flex items-center gap-1"><Layers className="size-3" />{doc.num_chunks}</span><span>·</span><span>{formatDate(doc.created_at)}</span></p></div></div><div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => download(doc)} disabled={busy.has(doc.id)} className={ghostBtn}>{busy.has(doc.id) ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}Download</button>{editor && <><button type="button" onClick={() => setShareDoc(doc)} disabled={busy.has(doc.id)} className={ghostBtn}><Share2 className="size-4" />Share</button><button type="button" onClick={() => remove(doc)} disabled={busy.has(doc.id)} className={dangerBtn}><Trash2 className="size-4" />Delete</button></>}</div></div></li>)}</ul>}</section>
    {shareDoc && <ShareDialog doc={shareDoc} onClose={() => setShareDoc(null)} />}
  </div>
}
