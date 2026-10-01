'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Building2, Download, FileText } from 'lucide-react'
import { docsApi, type Company, type DocCard } from '@/lib/api'
import DocCardView from '@/components/doc-card'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

// Soft brand tints for the publisher avatar, chosen deterministically from the
// slug so a given publisher always keeps the same colour across visits.
const AVATAR_TINTS = ['#dfe7f7', '#e7e2ff', '#fff0d3']

function tintForSlug(slug: string): string {
  let hash = 0
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0
  return AVATAR_TINTS[hash % AVATAR_TINTS.length]
}

// "1 document" / "3 documents". Categories are pluralised inline (irregular).
function countLabel(n: number, singular: string): string {
  return `${n.toLocaleString()} ${singular}${n === 1 ? '' : 's'}`
}

export default function PublisherDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug

  const [publisher, setPublisher] = useState<Company | null>(null)
  const [resolving, setResolving] = useState(true) // resolving the publisher identity
  const [notFound, setNotFound] = useState(false)

  const [docs, setDocs] = useState<DocCard[]>([])
  const [loading, setLoading] = useState(true) // loading this publisher's documents
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // Resolve the slug to a publisher (for the display name + not-found state).
  useEffect(() => {
    if (!slug) return
    setResolving(true)
    setNotFound(false)
    docsApi
      .companies()
      .then((companies) => {
        const match = companies.find((c) => c.slug === slug) ?? null
        setPublisher(match)
        setNotFound(!match)
      })
      .catch(() => setNotFound(true))
      .finally(() => setResolving(false))
  }, [slug])

  // Load this publisher's public documents.
  useEffect(() => {
    if (!slug) return
    setLoading(true)
    docsApi
      .list({ company: slug })
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [slug])

  // Reset the client-side filter whenever we switch publishers.
  useEffect(() => setActiveCategory(null), [slug])

  const totalDownloads = useMemo(
    () => docs.reduce((sum, d) => sum + (d.downloads || 0), 0),
    [docs],
  )

  // Category breakdown drives both the filter chips and the "N categories" stat.
  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of docs) counts.set(d.category, (counts.get(d.category) ?? 0) + 1)
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [docs])

  const filtered = useMemo(
    () => (activeCategory ? docs.filter((d) => d.category === activeCategory) : docs),
    [docs, activeCategory],
  )

  const name = publisher?.name ?? slug ?? ''
  const initial = (name.trim()[0] ?? '?').toUpperCase()
  const catLabel = `${categories.length} ${categories.length === 1 ? 'category' : 'categories'}`

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#1d1d1b]">
      <SiteHeader />

      <div className="mx-auto max-w-7xl px-6 pb-10 lg:px-10">
        <Link
          href="/publishers"
          className="inline-flex items-center gap-2 py-4 text-sm text-[#74726c] transition-colors hover:text-[#1d1d1b]"
        >
          <ArrowLeft className="size-4" /> All publishers
        </Link>

        {resolving ? (
          <p className="py-24 text-center text-sm text-[#98958c]">Loading publisher…</p>
        ) : notFound ? (
          <div className="my-10 rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-12 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e7e2ff] text-[#20211f]">
              <Building2 className="size-6" />
            </span>
            <p className="mt-6 font-serif text-3xl italic tracking-tight">Publisher not found.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#77746c]">
              We couldn&apos;t find a publisher at this address. It may have been renamed or removed.
            </p>
            <Link
              href="/publishers"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#3c3b37]"
            >
              <ArrowLeft className="size-4" /> Back to all publishers
            </Link>
          </div>
        ) : (
          <>
            <section className="border-b border-[#e6e3dc] pb-10">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">
                <Building2 className="size-3.5" /> Publisher
              </p>
              <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
                <span
                  aria-hidden
                  className="grid size-20 shrink-0 place-items-center rounded-[26px] font-serif text-4xl italic text-[#20211f] sm:size-24 sm:text-5xl"
                  style={{ backgroundColor: tintForSlug(slug ?? '') }}
                >
                  {initial}
                </span>
                <div>
                  <h1 className="font-serif text-4xl leading-[1.02] tracking-[-0.04em] sm:text-6xl">{name}</h1>
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#77746c]">
                    {loading ? (
                      <span className="text-[#98958c]">Tallying the collection…</span>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1.5">
                          <FileText className="size-3.5" /> {countLabel(docs.length, 'document')}
                        </span>
                        <span aria-hidden className="text-[#c9c6bd]">·</span>
                        <span className="inline-flex items-center gap-1.5">
                          <Download className="size-3.5" /> {countLabel(totalDownloads, 'download')}
                        </span>
                        <span aria-hidden className="text-[#c9c6bd]">·</span>
                        <span>{catLabel}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#5d5b55]">
                Public documents shared by {name} on OpenVault. Browse the collection below and download
                anything worth keeping.
              </p>
            </section>

            {categories.length > 1 && (
              <div
                className="mt-8 flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Filter documents by category"
              >
                <button
                  type="button"
                  onClick={() => setActiveCategory(null)}
                  aria-pressed={activeCategory === null}
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${
                    activeCategory === null
                      ? 'bg-[#1d1d1b] text-white'
                      : 'border border-[#dcdad3] text-[#74726c] hover:border-[#1d1d1b]'
                  }`}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setActiveCategory(activeCategory === c.name ? null : c.name)}
                    aria-pressed={activeCategory === c.name}
                    className={`rounded-full px-4 py-2 text-sm transition-colors ${
                      activeCategory === c.name
                        ? 'bg-[#1d1d1b] text-white'
                        : 'border border-[#dcdad3] text-[#74726c] hover:border-[#1d1d1b]'
                    }`}
                  >
                    {c.name} <span className="opacity-50">{c.count}</span>
                  </button>
                ))}
              </div>
            )}

            <section className="mt-10 pb-16">
              {loading ? (
                <p className="text-sm text-[#98958c]">Loading documents…</p>
              ) : filtered.length ? (
                <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((doc) => (
                    <DocCardView key={doc.id} doc={doc} />
                  ))}
                </div>
              ) : docs.length ? (
                <div className="rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-12 text-center">
                  <p className="font-serif text-2xl italic">Nothing in that category.</p>
                  <button
                    type="button"
                    onClick={() => setActiveCategory(null)}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#1d1d1b] hover:underline"
                  >
                    Show all documents
                  </button>
                </div>
              ) : (
                <div className="rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-12 text-center">
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff0d3] text-[#20211f]">
                    <FileText className="size-6" />
                  </span>
                  <p className="mt-6 font-serif text-2xl italic">Nothing shared yet.</p>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#77746c]">
                    This publisher hasn&apos;t shared any public documents yet.
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <SiteFooter />
    </main>
  )
}
