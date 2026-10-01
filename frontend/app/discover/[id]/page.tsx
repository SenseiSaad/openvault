'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Building2,
  Calendar,
  ChevronRight,
  Download,
  FileText,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { docsApi, downloadDocument, type DocCard } from '@/lib/api'
import DocCardView, { formatDate, tintFor, titleFromName } from '@/components/doc-card'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

// Human-readable file size (B/KB/MB/GB).
function formatSize(bytes: number) {
  if (!bytes) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

// Friendly format label derived from the stored file extension.
const FORMATS: Record<string, string> = {
  md: 'Markdown', markdown: 'Markdown', txt: 'Text', pdf: 'PDF',
  doc: 'Word', docx: 'Word', csv: 'CSV', rtf: 'Rich text',
}
function formatFromName(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return FORMATS[ext] || 'Document'
}
export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [doc, setDoc] = useState<DocCard | null>(null)
  const [related, setRelated] = useState<DocCard[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [busy, setBusy] = useState<'download' | 'favorite' | null>(null)
  const [error, setError] = useState('')

  // Load the document whenever the route id changes.
  useEffect(() => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    docsApi
      .detail(id)
      .then((d) => {
        setDoc(d)
        setFavorited(!!d.favorited)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  // Load "more in this category" once the document is known.
  useEffect(() => {
    if (!doc) return
    docsApi
      .list({ category: doc.category })
      .then((list) => setRelated(list.filter((d) => d.id !== doc.id).slice(0, 6)))
      .catch(() => setRelated([]))
  }, [doc?.id, doc?.category])

  // Anonymous visitors are sent to sign in, then bounced back here.
  const gate = () => router.push(`/auth?next=${encodeURIComponent(`/discover/${id}`)}`)
  async function onDownload() {
    if (!doc || authLoading) return
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
    if (!doc || authLoading) return
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
  // --- Loading ------------------------------------------------------------
  if (loading) {
    return (
      <main className="flex min-h-screen flex-col bg-[#f7f6f2] text-[#1d1d1b]">
        <SiteHeader />
        <div
          role="status"
          className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center gap-2 px-6 py-32 text-sm text-[#98958c] lg:px-10"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading document…
        </div>
        <SiteFooter />
      </main>
    )
  }

  // --- Not found ----------------------------------------------------------
  if (notFound || !doc) {
    return (
      <main className="flex min-h-screen flex-col bg-[#f7f6f2] text-[#1d1d1b]">
        <SiteHeader />
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-28 text-center lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#8c8a83]">Error 404</p>
          <h1 className="mt-4 font-serif text-4xl italic tracking-[-.03em] sm:text-5xl">
            We couldn&apos;t find that document.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-[#77746c]">
            The link may be broken, or the document has been unpublished. Try browsing the library instead.
          </p>
          <Link
            href="/discover"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#3c3b37]"
          >
            <ArrowLeft className="size-4" aria-hidden /> Back to discover
          </Link>
        </div>
        <SiteFooter />
      </main>
    )
  }

  const signedIn = !!user
  const title = titleFromName(doc.filename)
  return (
    <main className="flex min-h-screen flex-col bg-[#f7f6f2] text-[#1d1d1b]">
      <SiteHeader />

      <div className="mx-auto w-full max-w-5xl flex-1 px-6 pb-20 lg:px-10">
        {/* Breadcrumb / back to discover */}
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 py-6 text-sm text-[#77746c]">
          <Link href="/discover" className="inline-flex items-center gap-1.5 hover:text-[#1d1d1b]">
            <ArrowLeft className="size-4" aria-hidden /> Discover
          </Link>
          <ChevronRight className="size-3.5 text-[#98958c]" aria-hidden />
          <Link
            href={`/discover?category=${encodeURIComponent(doc.category)}`}
            className="hover:text-[#1d1d1b]"
          >
            {doc.category}
          </Link>
          <ChevronRight className="size-3.5 text-[#98958c]" aria-hidden />
          <span className="max-w-[16rem] truncate text-[#98958c]" aria-current="page">{title}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1fr_340px] lg:gap-14">
          {/* Left: header + body */}
          <article>
            <span className="inline-flex items-center rounded-full border border-[#e6e3dc] bg-[#fffdfa] px-3 py-1 text-[10px] font-semibold uppercase tracking-[.16em] text-[#5d5b55]">
              {doc.category}
            </span>
            <h1 className="mt-5 font-serif text-4xl leading-[1.03] tracking-[-.03em] sm:text-5xl">{title}</h1>

            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[#77746c]">
              <Link
                href={`/publishers/${doc.company_slug}`}
                className="inline-flex items-center gap-1.5 font-medium text-[#1d1d1b] underline-offset-4 hover:underline"
              >
                <Building2 className="size-4 text-[#8c8a83]" aria-hidden /> {doc.company}
              </Link>
              <span className="text-[#98958c]" aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5"><Calendar className="size-4 text-[#8c8a83]" aria-hidden /> {formatDate(doc.created_at)}</span>
              <span className="text-[#98958c]" aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5"><FileText className="size-4 text-[#8c8a83]" aria-hidden /> {formatSize(doc.size)}</span>
              <span className="text-[#98958c]" aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5"><Download className="size-4 text-[#8c8a83]" aria-hidden /> {doc.downloads.toLocaleString()} downloads</span>
            </div>

            {doc.description && (
              <p className="mt-8 max-w-2xl text-lg leading-relaxed text-[#5d5b55]">{doc.description}</p>
            )}

            {doc.preview && (
              <section className="mt-8 rounded-[22px] border border-[#e6e3dc] bg-[#fffdfa] p-6 sm:p-8" aria-label="Document preview">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-[#8c8a83]">Preview</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#5d5b55]">{doc.preview}</p>
              </section>
            )}

            {!doc.description && !doc.preview && (
              <p className="mt-8 text-sm italic text-[#98958c]">No description was provided for this document.</p>
            )}
          </article>

          {/* Right: actions + facts */}
          <aside className="lg:pt-1">
            <div className="lg:sticky lg:top-6">
              <div className={`aspect-[1.3/1] rounded-[22px] bg-gradient-to-br ${tintFor(doc.category)}`} aria-hidden />

              {error && (
                <p role="alert" className="mt-4 rounded-xl bg-[#fbe4e0] px-4 py-3 text-sm text-[#9a3b2c]">{error}</p>
              )}

              <button
                onClick={onDownload}
                disabled={busy !== null || authLoading}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1d1d1b] text-sm font-medium text-white transition hover:bg-[#3c3b37] disabled:opacity-60"
              >
                {busy === 'download' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
                {signedIn || authLoading ? 'Download' : 'Sign in to download'}
              </button>

              <button
                onClick={onFavorite}
                disabled={busy !== null || authLoading}
                aria-pressed={favorited}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#dcdad3] bg-[#fffdfa] text-sm font-medium transition hover:bg-white disabled:opacity-60"
              >
                {busy === 'favorite' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : favorited ? <BookmarkCheck className="size-4" aria-hidden /> : <Bookmark className="size-4" aria-hidden />}
                {favorited ? 'Saved to favourites' : signedIn || authLoading ? 'Add to favourites' : 'Sign in to save'}
              </button>

              {!signedIn && !authLoading && (
                <p className="mt-3 text-center text-xs text-[#98958c]">A free account unlocks downloads and your reading list.</p>
              )}

              <dl className="mt-6 space-y-3 rounded-[22px] border border-[#e6e3dc] bg-[#fffdfa] p-5 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#8c8a83]">Publisher</dt>
                  <dd className="truncate font-medium text-[#1d1d1b]">
                    <Link href={`/publishers/${doc.company_slug}`} className="underline-offset-4 hover:underline">{doc.company}</Link>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#8c8a83]">Category</dt>
                  <dd className="font-medium text-[#1d1d1b]">{doc.category}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#8c8a83]">Format</dt>
                  <dd className="font-medium text-[#1d1d1b]">{formatFromName(doc.filename)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#8c8a83]">Size</dt>
                  <dd className="font-medium text-[#1d1d1b]">{formatSize(doc.size)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#8c8a83]">Published</dt>
                  <dd className="font-medium text-[#1d1d1b]">{formatDate(doc.created_at)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[#8c8a83]">Downloads</dt>
                  <dd className="font-medium text-[#1d1d1b]">{doc.downloads.toLocaleString()}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
        {related.length > 0 && (
          <section className="mt-16 border-t border-[#e6e3dc] pt-12" aria-labelledby="related-heading">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#8c8a83]">Keep exploring</p>
                <h2 id="related-heading" className="mt-2 font-serif text-3xl italic tracking-[-.02em]">More in {doc.category}</h2>
              </div>
              <Link
                href={`/discover?category=${encodeURIComponent(doc.category)}`}
                className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-[#65645f] hover:text-[#1d1d1b] sm:inline-flex"
              >
                View all <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((d) => <DocCardView key={d.id} doc={d} />)}
            </div>
          </section>
        )}
      </div>

      <SiteFooter />
    </main>
  )
}
