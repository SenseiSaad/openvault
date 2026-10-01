'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ArrowUpRight, Building2, Download, FileText } from 'lucide-react'
import { docsApi, type Company, type DocCard } from '@/lib/api'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

// One publisher's rollup, computed client-side from the public document list.
type PublisherStat = {
  company: Company
  docs: number
  downloads: number
  categories: string[] // up to 3 distinct, most-published first
}

// Soft brand tints, rotated by card index so the grid stays varied. Each pair
// is { avatar header, category chip }, both intentionally light for contrast.
const TINTS = [
  { avatar: '#dfe7f7', chip: '#dcecff' }, // blue
  { avatar: '#e7e2ff', chip: '#f5f0ff' }, // purple
  { avatar: '#fff0d3', chip: '#fff8ea' }, // amber
]

// "1 document" / "3 documents".
function countLabel(n: number, singular: string): string {
  return `${n.toLocaleString()} ${singular}${n === 1 ? '' : 's'}`
}

export default function PublishersPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [docs, setDocs] = useState<DocCard[]>([])
  const [loading, setLoading] = useState(true)

  // Companies + every public document, fetched together once on mount.
  useEffect(() => {
    Promise.all([docsApi.companies(), docsApi.list()])
      .then(([co, ds]) => {
        setCompanies(co)
        setDocs(ds)
      })
      .catch(() => {
        setCompanies([])
        setDocs([])
      })
      .finally(() => setLoading(false))
  }, [])

  // Roll documents up per company_slug: count, total downloads, top categories.
  const publishers = useMemo<PublisherStat[]>(() => {
    const agg = new Map<string, { docs: number; downloads: number; cats: Map<string, number> }>()
    for (const d of docs) {
      const slug = d.company_slug
      if (!slug) continue
      let entry = agg.get(slug)
      if (!entry) {
        entry = { docs: 0, downloads: 0, cats: new Map() }
        agg.set(slug, entry)
      }
      entry.docs += 1
      entry.downloads += d.downloads || 0
      if (d.category) entry.cats.set(d.category, (entry.cats.get(d.category) ?? 0) + 1)
    }
    return companies
      .map((company) => {
        const entry = agg.get(company.slug)
        const categories = entry
          ? [...entry.cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c)
          : []
        return {
          company,
          docs: entry?.docs ?? 0,
          downloads: entry?.downloads ?? 0,
          categories,
        }
      })
      .sort(
        (a, b) =>
          b.docs - a.docs ||
          b.downloads - a.downloads ||
          a.company.name.localeCompare(b.company.name),
      )
  }, [companies, docs])

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#1d1d1b]">
      <SiteHeader />

      {/* Header block */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">Publishers</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.03] tracking-[-0.05em] sm:text-6xl sm:tracking-[-0.07em]">
          The organizations{' '}
          <span className="font-serif font-normal italic">behind the library.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#77746c]">
          Every publisher on OpenVault shares its best public documents (research, guides, and
          reference material) in one calm, searchable home. Browse who&apos;s contributing, then
          dive into everything they&apos;ve made open.
        </p>
        <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-[#8c8a83]">
          <Building2 className="size-4" aria-hidden />
          {countLabel(publishers.length, 'publisher')}
          <span aria-hidden>·</span>
          {countLabel(docs.length, 'document')}
        </p>
      </section>

      {/* Publisher grid */}
      <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-10">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-60 animate-pulse rounded-[26px] border border-[#e6e3dc] bg-[#fffdfa]"
              />
            ))}
          </div>
        ) : publishers.length ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {publishers.map((p, i) => {
              const tint = TINTS[i % TINTS.length]
              const initial = (p.company.name.trim()[0] ?? '?').toUpperCase()
              return (
                <li key={p.company.slug}>
                  <Link
                    href={`/publishers/${p.company.slug}`}
                    className="group flex h-full flex-col rounded-[26px] border border-[#dcdad3] bg-[#fffdfa] p-7 transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between">
                      <span
                        aria-hidden
                        className="grid size-14 place-items-center rounded-2xl font-serif text-2xl italic text-[#20211f]"
                        style={{ backgroundColor: tint.avatar }}
                      >
                        {initial}
                      </span>
                      <ArrowUpRight
                        className="size-5 text-[#98958c] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#1d1d1b]"
                        aria-hidden
                      />
                    </div>
                    <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em]">{p.company.name}</h2>
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#74726c]">
                      <span className="inline-flex items-center gap-1.5">
                        <FileText className="size-3.5" aria-hidden /> {countLabel(p.docs, 'document')}
                      </span>
                      <span aria-hidden className="text-[#c9c6bd]">·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Download className="size-3.5" aria-hidden /> {countLabel(p.downloads, 'download')}
                      </span>
                    </p>
                    {p.categories.length > 0 && (
                      <div className="mt-5 flex flex-wrap gap-2">
                        {p.categories.map((c) => (
                          <span
                            key={c}
                            className="rounded-full px-3 py-1 text-xs font-medium text-[#5b5952]"
                            style={{ backgroundColor: tint.chip }}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-[#1d1d1b]">
                      View publisher
                      <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="rounded-[26px] border border-[#dcdad3] bg-[#fffdfa] p-12 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e7e2ff] text-[#20211f]">
              <Building2 className="size-6" aria-hidden />
            </span>
            <p className="mt-6 font-serif text-2xl italic">No publishers yet.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#98958c]">
              Once organizations start sharing public documents, they&apos;ll show up here.
            </p>
            <Link
              href="/discover"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#3c3b37]"
            >
              Browse the library <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        )}
      </section>

      {/* Closing CTA band */}
      <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-10">
        <div className="rounded-[26px] bg-[#20211f] p-8 text-white sm:p-12">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-lg">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Keep exploring</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
                Read more, or{' '}
                <span className="font-serif font-normal italic">become a publisher.</span>
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/60">
                Explore every organization&apos;s open collection, or bring your own team&apos;s
                knowledge to OpenVault.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/discover"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-[#1d1d1b] transition-colors hover:bg-[#f2f0ea]"
              >
                Browse every document <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/enterprise"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-5 py-3 text-sm font-medium text-white transition-colors hover:border-white/60"
              >
                Publish with OpenVault <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
