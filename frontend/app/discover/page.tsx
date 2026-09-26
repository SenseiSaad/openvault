'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react'
import { docsApi, type Category, type Company, type DocCard } from '@/lib/api'
import DocCardView from '@/components/doc-card'

type Sort = 'recent' | 'popular'

function DiscoverInner() {
  const router = useRouter()
  const params = useSearchParams()

  const urlQ = params.get('q') || ''
  const urlCategory = params.get('category') || ''
  const urlCompany = params.get('company') || ''
  const urlSort = (params.get('sort') as Sort) || 'recent'

  const [input, setInput] = useState(urlQ)
  const [docs, setDocs] = useState<DocCard[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  // Keep the search box in sync when the URL changes (e.g. category chip clicks).
  useEffect(() => setInput(urlQ), [urlQ])

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

  function updateParams(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v)
      else sp.delete(k)
    }
    router.push(`/discover${sp.toString() ? `?${sp}` : ''}`)
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    updateParams({ q: input.trim() })
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-6 text-[#1d1d1b] lg:px-10">
      <header className="mx-auto flex max-w-7xl items-center justify-between py-5">
        <Link href="/" className="text-sm text-[#74726c]">← Back home</Link>
        <Link href="/" className="text-lg font-semibold tracking-[-.04em]">F5P<span className="text-[#b1b0ac]">/</span>library</Link>
        <span className="w-20" />
      </header>

      <section className="mx-auto max-w-4xl py-14 text-center sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#8c8a83]">Explore the collection</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-[-.08em] sm:text-7xl">Discover<br /><span className="font-serif font-normal italic">something new.</span></h1>
        <form onSubmit={submitSearch} className="mx-auto mt-10 flex max-w-xl items-center gap-3 rounded-full bg-white px-5 py-4 shadow-sm">
          <Search className="size-5 text-[#8c8a83]" />
          <input value={input} onChange={(e) => setInput(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#aaa8a1]" placeholder="Search documents, companies, topics..." />
          <button type="submit" className="rounded-full bg-[#1d1d1b] px-4 py-2 text-xs font-semibold text-white">Search</button>
        </form>
      </section>

      <section className="mx-auto max-w-7xl pb-24">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            onClick={() => updateParams({ category: '' })}
            className={`rounded-full px-4 py-2 text-sm ${!urlCategory ? 'bg-[#1d1d1b] text-white' : 'border border-[#dcdad3] text-[#74726c] hover:border-[#1d1d1b]'}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.name}
              onClick={() => updateParams({ category: urlCategory === c.name ? '' : c.name })}
              className={`rounded-full px-4 py-2 text-sm ${urlCategory === c.name ? 'bg-[#1d1d1b] text-white' : 'border border-[#dcdad3] text-[#74726c] hover:border-[#1d1d1b]'}`}
            >
              {c.name} <span className="opacity-50">{c.count}</span>
            </button>
          ))}
        </div>

        <div className="mb-10 flex flex-wrap items-center gap-3 border-y border-[#dedcd5] py-4 text-sm">
          <span className="flex items-center gap-2 text-[#8c8a83]"><SlidersHorizontal className="size-4" /> Filters</span>
          <select
            value={urlCompany}
            onChange={(e) => updateParams({ company: e.target.value })}
            className="rounded-full border border-[#dcdad3] bg-white px-4 py-2 text-sm outline-none"
          >
            <option value="">All companies</option>
            {companies.map((co) => <option key={co.slug} value={co.slug}>{co.name}</option>)}
          </select>
          <div className="ml-auto flex items-center gap-1 rounded-full border border-[#dcdad3] p-1">
            {(['recent', 'popular'] as Sort[]).map((s) => (
              <button
                key={s}
                onClick={() => updateParams({ sort: s })}
                className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize ${urlSort === s ? 'bg-[#1d1d1b] text-white' : 'text-[#74726c]'}`}
              >
                {s === 'recent' ? 'Recently added' : 'Most popular'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-[#98958c]">Loading documents…</p>
        ) : docs.length ? (
          <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((doc) => <DocCardView key={doc.id} doc={doc} />)}
          </div>
        ) : (
          <div className="rounded-3xl bg-white p-12 text-center">
            <p className="font-serif text-2xl italic">Nothing matches that yet.</p>
            <p className="mt-2 text-sm text-[#98958c]">Try a different search or clear the filters.</p>
            <Link href="/discover" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">Reset <ArrowRight className="size-4" /></Link>
          </div>
        )}
      </section>
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
