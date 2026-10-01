'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { ArrowRight, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
import { docsApi, type Category, type Company, type DocCard } from '@/lib/api'
import DocCardView from '@/components/doc-card'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

type Sort = 'recent' | 'popular'

const SORTS: { value: Sort; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'popular', label: 'Popular' },
]

// Shared focus-visible treatment for interactive controls (keyboard a11y).
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f6f2]'

function DiscoverInner() {
  const router = useRouter()
  const params = useSearchParams()

  // The URL is the single source of truth for every filter.
  const urlQ = params.get('q') || ''
  const urlCategory = params.get('category') || ''
  const urlCompany = params.get('company') || ''
  const urlSort: Sort = params.get('sort') === 'popular' ? 'popular' : 'recent'

  const [input, setInput] = useState(urlQ)
  const [docs, setDocs] = useState<DocCard[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  // Filter options load once.
  useEffect(() => {
    Promise.all([docsApi.categories(), docsApi.companies()])
      .then(([c, co]) => { setCategories(c); setCompanies(co) })
      .catch(() => {})
  }, [])
  // Results reload whenever any URL-bound filter changes.
  useEffect(() => {
    setLoading(true)
    docsApi
      .list({ q: urlQ || undefined, category: urlCategory || undefined, company: urlCompany || undefined, sort: urlSort })
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [urlQ, urlCategory, urlCompany, urlSort])

  // Build the next URL purely from the current filters so results, controls,
  // and the address bar always agree. `replace` keeps history free of noise.
  const commit = useCallback(
    (next: Partial<{ q: string; category: string; company: string; sort: Sort }>) => {
      const merged = { q: urlQ, category: urlCategory, company: urlCompany, sort: urlSort, ...next }
      const sp = new URLSearchParams()
      if (merged.q) sp.set('q', merged.q)
      if (merged.category) sp.set('category', merged.category)
      if (merged.company) sp.set('company', merged.company)
      if (merged.sort !== 'recent') sp.set('sort', merged.sort)
      const s = sp.toString()
      router.replace(s ? `/discover?${s}` : '/discover', { scroll: false })
    },
    [router, urlQ, urlCategory, urlCompany, urlSort],
  )

  // Debounce the free-text search: reflect it in the URL 300ms after typing stops.
  useEffect(() => {
    const q = input.trim()
    if (q === urlQ) return
    const t = setTimeout(() => commit({ q }), 300)
    return () => clearTimeout(t)
  }, [input, urlQ, commit])

  function clearSearch() {
    setInput('')
    commit({ q: '' })
  }

  function resetAll() {
    setInput('')
    router.replace('/discover', { scroll: false })
  }

  const activeFilters = Boolean(urlQ || urlCategory || urlCompany) || urlSort !== 'recent'
  const count = docs.length

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#1d1d1b]">
      <SiteHeader />

      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        {/* Header block */}
        <section className="border-b border-[#e6e3dc] py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">Open knowledge library</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-6xl sm:tracking-[-0.07em]">
            Discover <span className="font-serif font-normal italic">something worth keeping.</span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-[#77746c] sm:text-base">
            Browse every published document across OpenVault. Search by keyword, filter by topic or publisher, and open anything that catches your eye.
          </p>
          <p className="mt-6 text-sm text-[#8c8a83]" aria-live="polite">
            {loading
              ? 'Searching the library…'
              : `${count} ${count === 1 ? 'document' : 'documents'}${activeFilters ? ' match your filters' : ' in the library'}`}
          </p>
        </section>

        {/* Controls */}
        <section className="py-8">
          <form
            role="search"
            onSubmit={(e) => { e.preventDefault(); commit({ q: input.trim() }) }}
            className="relative flex h-12 items-center rounded-xl border border-[#d8d5cc] bg-[#fffdfa] transition-colors focus-within:border-[#1d1d1b]"
          >
            <Search className="pointer-events-none absolute left-4 size-5 text-[#8c8a83]" aria-hidden />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Search documents"
              placeholder="Search documents, topics, publishers…"
              className="h-full w-full rounded-xl bg-transparent pl-12 pr-12 text-sm outline-none placeholder:text-[#aaa8a1]"
            />
            {input && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className={`absolute right-3 grid size-7 place-items-center rounded-full text-[#8c8a83] hover:bg-[#efece4] hover:text-[#1d1d1b] ${focusRing}`}
              >
                <X className="size-4" />
              </button>
            )}
          </form>
          {/* Category chips */}
          <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => commit({ category: '' })}
              aria-pressed={!urlCategory}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors ${!urlCategory ? 'border-[#1d1d1b] bg-[#1d1d1b] text-white' : 'border-[#dcdad3] text-[#74726c] hover:border-[#1d1d1b] hover:text-[#1d1d1b]'} ${focusRing}`}
            >
              All
            </button>
            {categories.map((c) => {
              const on = urlCategory === c.name
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => commit({ category: on ? '' : c.name })}
                  aria-pressed={on}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors ${on ? 'border-[#1d1d1b] bg-[#1d1d1b] text-white' : 'border-[#dcdad3] text-[#74726c] hover:border-[#1d1d1b] hover:text-[#1d1d1b]'} ${focusRing}`}
                >
                  {c.name} <span className="opacity-50">{c.count}</span>
                </button>
              )
            })}
          </div>

          {/* Publisher + sort + reset */}
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#e6e3dc] pt-5 text-sm">
            <span className="flex items-center gap-2 text-[#8c8a83]"><SlidersHorizontal className="size-4" aria-hidden /> Filters</span>

            <div className="relative">
              <select
                value={urlCompany}
                onChange={(e) => commit({ company: e.target.value })}
                aria-label="Filter by publisher"
                className={`h-10 appearance-none rounded-full border border-[#dcdad3] bg-[#fffdfa] pl-4 pr-9 text-sm text-[#1d1d1b] outline-none transition-colors hover:border-[#1d1d1b] focus:border-[#1d1d1b] ${focusRing}`}
              >
                <option value="">All publishers</option>
                {companies.map((co) => <option key={co.slug} value={co.slug}>{co.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#8c8a83]" aria-hidden />
            </div>

            <div className="flex items-center gap-1 rounded-full border border-[#dcdad3] p-1" role="group" aria-label="Sort documents">
              {SORTS.map((s) => {
                const on = urlSort === s.value
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => commit({ sort: s.value })}
                    aria-pressed={on}
                    className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${on ? 'bg-[#1d1d1b] text-white' : 'text-[#74726c] hover:text-[#1d1d1b]'} ${focusRing}`}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>

            {activeFilters && (
              <button
                type="button"
                onClick={resetAll}
                className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-[#74726c] hover:text-[#1d1d1b] ${focusRing}`}
              >
                <X className="size-4" /> Clear filters
              </button>
            )}
          </div>
        </section>

        {/* Results */}
        <section className="pb-20">
          {loading ? (
            <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[1.3/1] rounded-[22px] bg-[#ecebe4]" />
                  <div className="mt-3 h-4 w-3/4 rounded bg-[#ecebe4]" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-[#f0efe9]" />
                </div>
              ))}
            </div>
          ) : count ? (
            <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {docs.map((doc) => <DocCardView key={doc.id} doc={doc} />)}
            </div>
          ) : (
            <div className="rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-12 text-center">
              <p className="font-serif text-2xl italic">No documents match&hellip;</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#98958c]">
                Try a different search term, or clear the filters to see the whole library.
              </p>
              <button
                type="button"
                onClick={resetAll}
                className={`mt-6 inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-medium text-white hover:bg-[#3c3b37] ${focusRing}`}
              >
                Clear filters <ArrowRight className="size-4" />
              </button>
            </div>
          )}
        </section>
      </div>

      <SiteFooter />
    </main>
  )
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f7f6f2]" />}>
      <DiscoverInner />
    </Suspense>
  )
}
