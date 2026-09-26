'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, Bookmark, BookmarkCheck, Download, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { docsApi, downloadDocument, type DocCard } from '@/lib/api'
import { formatDate, tintFor } from '@/components/doc-card'

function formatSize(bytes: number) {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()

  const [doc, setDoc] = useState<DocCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [busy, setBusy] = useState<'download' | 'favorite' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    docsApi
      .detail(id)
      .then((d) => { setDoc(d); setFavorited(!!d.favorited) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  const gate = () => router.push(`/auth?next=${encodeURIComponent(`/discover/${id}`)}`)

  async function onDownload() {
    if (!doc) return
    if (!user) return gate()
    setError('')
    setBusy('download')
    try {
      await downloadDocument(doc.id, doc.filename)
      setDoc({ ...doc, downloads: doc.downloads + 1 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.')
    } finally {
      setBusy(null)
    }
  }

  async function onFavorite() {
    if (!doc) return
    if (!user) return gate()
    setError('')
    setBusy('favorite')
    try {
      if (favorited) {
        await docsApi.removeFavorite(doc.id)
        setFavorited(false)
      } else {
        await docsApi.addFavorite(doc.id)
        setFavorited(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update favourites.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[#f7f6f2] text-sm text-[#98958c]">Loading document…</main>
  }
  if (notFound || !doc) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f6f2] px-6 text-center text-[#1d1d1b]">
        <div>
          <p className="font-serif text-3xl italic">Document not found.</p>
          <Link href="/discover" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="size-4" /> Back to discover</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-6 text-[#1d1d1b] lg:px-10">
      <header className="mx-auto flex max-w-5xl items-center justify-between py-5">
        <Link href="/discover" className="inline-flex items-center gap-2 text-sm text-[#74726c]"><ArrowLeft className="size-4" /> Back to discover</Link>
        <Link href="/" className="text-lg font-semibold tracking-[-.04em]">F5P<span className="text-[#b1b0ac]">/</span>library</Link>
        <span className="w-28" />
      </header>

      <section className="mx-auto grid max-w-5xl gap-10 py-10 lg:grid-cols-[1fr_320px] lg:py-16">
        <div>
          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em]">{doc.category}</span>
          <h1 className="mt-5 font-serif text-4xl leading-[1.02] tracking-[-.04em] sm:text-5xl">{doc.filename}</h1>
          <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[#98958c]">
            <span>{doc.company}</span><span>·</span>
            <span>{formatDate(doc.created_at)}</span><span>·</span>
            <span className="inline-flex items-center gap-1"><Download className="size-3" />{doc.downloads} downloads</span>
            {doc.size ? <><span>·</span><span>{formatSize(doc.size)}</span></> : null}
          </p>

          {doc.description && <p className="mt-8 max-w-2xl text-lg leading-relaxed text-[#4f4d47]">{doc.description}</p>}

          {doc.preview && (
            <div className="mt-8 rounded-[22px] border border-[#e2dfd7] bg-[#fffdfa] p-6 sm:p-8">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[.14em] text-[#8c8a83]">Preview</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#5d5b55]">{doc.preview}</p>
            </div>
          )}
        </div>

        <aside className="lg:pt-1">
          <div className={`aspect-[1.3/1] rounded-[22px] bg-gradient-to-br ${tintFor(doc.category)}`} />
          {error && <p className="mt-4 rounded-xl bg-[#fbe4e0] px-4 py-3 text-sm text-[#9a3b2c]">{error}</p>}
          <button
            onClick={onDownload}
            disabled={busy !== null}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1d1d1b] text-sm font-medium text-white hover:bg-[#3c3b37] disabled:opacity-60"
          >
            {busy === 'download' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {user ? 'Download' : 'Sign in to download'}
          </button>
          <button
            onClick={onFavorite}
            disabled={busy !== null}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#dcdad3] text-sm font-medium hover:bg-white disabled:opacity-60"
          >
            {busy === 'favorite' ? <Loader2 className="size-4 animate-spin" /> : favorited ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
            {favorited ? 'Saved to favourites' : user ? 'Add to favourites' : 'Sign in to save'}
          </button>
          {!user && <p className="mt-3 text-center text-xs text-[#98958c]">A free account unlocks downloads and your reading list.</p>}
        </aside>
      </section>
    </main>
  )
}
