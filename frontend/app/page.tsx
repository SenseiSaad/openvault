'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Bookmark, Clock3, Search, Sparkles, TrendingUp } from 'lucide-react'
import { docsApi, type Category, type DocCard } from '@/lib/api'
import DocCardView, { titleFromName } from '@/components/doc-card'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

// Reusable focus-visible rings: light surfaces vs. the dark search panel.
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f6f2]'
const FOCUS_DARK =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#20211f]'

export default function Page() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<DocCard[]>([])
  const [popular, setPopular] = useState<DocCard[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // Load recent + popular + categories together; keep empty states on failure.
  useEffect(() => {
    let alive = true
    Promise.all([
      docsApi.list({ sort: 'recent' }),
      docsApi.list({ sort: 'popular' }),
      docsApi.categories(),
    ])
      .then(([r, p, c]) => {
        if (!alive) return
        setRecent(r)
        setPopular(p)
        setCategories(c)
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `/discover?q=${encodeURIComponent(q)}` : '/discover')
  }

  const featured = popular[0]

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f6f2] text-[#1d1d1b]">
      <SiteHeader />

      {/* 2: Hero */}
      <section aria-labelledby="hero-heading" className="mx-auto max-w-7xl px-6 pb-14 pt-10 lg:px-10 lg:pb-16 lg:pt-16">
        <div className="grid items-end gap-12 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <p className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">
              <Sparkles className="size-3.5" aria-hidden /> The open knowledge library
            </p>
            <h1 id="hero-heading" className="max-w-3xl text-[clamp(3.5rem,8vw,7.7rem)] font-semibold leading-[.88] tracking-[-0.085em]">
              Make room<br />
              <span className="font-serif font-normal italic">for ideas.</span>
            </h1>
          </div>
          <div className="max-w-sm pb-1 lg:pb-3">
            <p className="text-lg leading-relaxed text-[#5d5b55]">
              A thoughtful home for documents, research, and the small discoveries that make a big difference.
            </p>
            <Link href="/discover" className={`mt-7 inline-flex items-center gap-2 rounded-full text-sm font-semibold ${FOCUS}`}>
              Start exploring <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
{/* 3: Dark search bar + category chips */}
        <form onSubmit={submitSearch} role="search" aria-label="Search the library" className="mt-14 rounded-[26px] bg-[#20211f] p-3 shadow-xl shadow-[#20211f]/10 sm:p-4">
          <div className="flex items-center gap-3 rounded-[18px] bg-[#fffdfa] px-4 py-4 focus-within:ring-2 focus-within:ring-[#1d1d1b]/25 sm:px-5">
            <Search className="size-5 shrink-0 text-[#8c8a83]" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents, companies, topics..."
              aria-label="Search documents, companies, topics"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9a9891]"
            />
            <button type="submit" className={`rounded-full bg-[#1d1d1b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3c3b37] ${FOCUS_DARK}`}>
              Search
            </button>
          </div>
          {categories.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar px-1 pb-1">
              {categories.map((c) => (
                <Link
                  key={c.name}
                  href={`/discover?category=${encodeURIComponent(c.name)}`}
                  aria-label={`${c.name}, ${c.count} documents`}
                  className={`whitespace-nowrap rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:border-white/40 hover:text-white ${FOCUS_DARK}`}
                >
                  {c.name} <span className="text-white/40">{c.count}</span>
                </Link>
              ))}
            </div>
          )}
        </form>
      </section>
{/* 4: Recently added */}
      <section aria-labelledby="recent-heading" className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">Curated for you</p>
            <h2 id="recent-heading" className="text-4xl font-semibold tracking-[-.06em]">
              Recently <span className="font-serif font-normal italic">added.</span>
            </h2>
          </div>
          <Link href="/discover" className={`inline-flex items-center gap-2 rounded-full text-sm font-semibold ${FOCUS}`}>
            View all documents <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        {loading ? (
          <>
            <p role="status" className="sr-only">Loading the library…</p>
            <div className="mt-8 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[1.3/1] rounded-[22px] bg-[#eae7df]" />
                  <div className="mt-3 h-3 w-3/4 rounded-full bg-[#eae7df]" />
                  <div className="mt-2 h-3 w-1/2 rounded-full bg-[#eae7df]" />
                </div>
              ))}
            </div>
          </>
        ) : recent.length ? (
          <div className="mt-8 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {recent.slice(0, 6).map((doc) => (
              <DocCardView key={doc.id} doc={doc} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-[26px] border border-[#dcdad3] bg-[#fffdfa] p-12 text-center">
            <p className="font-serif text-2xl italic">No documents yet.</p>
            <p className="mt-2 text-sm text-[#98958c]">Make sure the backend is running and seeded, then refresh.</p>
          </div>
        )}
      </section>
{/* 5: Most popular */}
      {popular.length > 0 && (
        <section aria-labelledby="popular-heading" className="mx-auto max-w-7xl px-6 pb-16 lg:px-10">
          <p id="popular-heading" className="mb-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">
            <TrendingUp className="size-4" aria-hidden /> Most popular
          </p>
          <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {popular.slice(0, 3).map((doc) => (
              <DocCardView key={doc.id} doc={doc} />
            ))}
          </div>
        </section>
      )}

      {/* 6: Editor's pick */}
      {featured && (
        <section aria-label="Editor's pick" className="mx-auto grid max-w-7xl gap-5 px-6 pb-20 lg:grid-cols-[1.4fr_.6fr] lg:px-10">
          <Link href={`/discover/${featured.id}`} className={`group rounded-[26px] bg-[#dfe7f7] p-7 transition hover:-translate-y-0.5 sm:p-10 ${FOCUS}`}>
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em]">Editor&apos;s pick</span>
              <TrendingUp className="size-5 text-[#53688f]" aria-hidden />
            </div>
            <div className="mt-20 max-w-lg">
              <h3 className="font-serif text-4xl leading-[.95] tracking-[-.05em] sm:text-5xl">{titleFromName(featured.filename)}</h3>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-[#536070] line-clamp-3">{featured.description || featured.preview}</p>
              <span className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-medium text-white transition group-hover:bg-[#3c3b37]">
                Read document <ArrowRight className="size-4" aria-hidden />
              </span>
            </div>
          </Link>
          <div className="rounded-[26px] bg-[#20211f] p-7 text-white sm:p-9">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[.14em] text-white/50">
              <Clock3 className="size-4" aria-hidden /> This week
            </p>
            <p className="mt-16 font-serif text-3xl italic leading-tight">“The best libraries are not warehouses. They are invitations.”</p>
            <p className="mt-6 text-xs text-white/50">OpenVault editorial note</p>
            <div className="mt-10 h-px bg-white/15" />
            <Link href="/about" className={`mt-5 inline-flex items-center gap-2 rounded-full text-sm text-white/75 hover:text-white ${FOCUS_DARK}`}>
              How we curate <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      )}
{/* 7: Build your personal library CTA */}
      <section aria-labelledby="cta-heading" className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="rounded-[26px] border border-[#dcdad3] bg-[#fffdfa] p-8 text-center sm:p-12">
          <Bookmark className="mx-auto size-6 text-[#8c8a83]" aria-hidden />
          <h2 id="cta-heading" className="mt-5 text-3xl font-semibold tracking-[-.05em]">
            Build your <span className="font-serif font-normal italic">personal</span> library.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#77746c]">
            Save documents, follow fields, and pick up exactly where you left off, all in one quiet corner of the internet.
          </p>
          <Link href="/favorites" className={`mt-7 inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3c3b37] ${FOCUS}`}>
            Go to your favourites <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* 8: Footer */}
      <SiteFooter />
    </main>
  )
}
