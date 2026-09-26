'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Bookmark, Check, Clock3, Menu, Search, Sparkles, TrendingUp } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { docsApi, type Category, type DocCard } from '@/lib/api'
import DocCardView from '@/components/doc-card'

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-[-0.04em]">
      <span className="grid size-8 place-items-center rounded-[10px] bg-[#1d1d1b] text-sm text-white">F5</span>
      <span>F5P<span className="text-[#b1b0ac]">/</span>library</span>
    </Link>
  )
}

function AuthDialog({ onClose }: { onClose: () => void }) {
  const [enterprise, setEnterprise] = useState(false)
  const [notice, setNotice] = useState('')
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#1d1d1b]/35 px-5 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-md rounded-[28px] bg-[#fffdfa] p-7 shadow-2xl sm:p-9">
        <button onClick={onClose} className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-[#f3f1ec]" aria-label="Close">✕</button>
        <div className="mb-7">
          <div className="mb-5 grid size-11 place-items-center rounded-2xl bg-[#1d1d1b] text-sm text-white">F5</div>
          <h2 className="text-2xl font-semibold tracking-[-0.04em]">Welcome to F5P</h2>
          <p className="mt-2 text-sm text-[#74726c]">A better place for the things worth reading.</p>
        </div>
        {notice && <p className="mb-4 rounded-xl bg-[#efece4] px-4 py-3 text-sm text-[#74726c]">{notice}</p>}
        {!enterprise ? (
          <>
            <div className="flex flex-col gap-3">
              <button onClick={() => setNotice('Google sign-in isn’t configured in this build yet.')} className="h-12 rounded-full border border-[#dcdad3] text-sm font-medium hover:bg-[#f5f3ee]">Continue with Google</button>
              <button onClick={() => setNotice('Apple sign-in isn’t configured in this build yet.')} className="h-12 rounded-full border border-[#dcdad3] text-sm font-medium hover:bg-[#f5f3ee]">Continue with Apple</button>
              <Link href="/auth" className="grid h-12 place-items-center rounded-full bg-[#1d1d1b] text-sm font-medium text-white">Continue with Email</Link>
            </div>
            <div className="my-6 flex items-center gap-3 text-xs text-[#aaa8a1]"><span className="h-px flex-1 bg-[#e6e3dc]" />OR<span className="h-px flex-1 bg-[#e6e3dc]" /></div>
            <button onClick={() => setEnterprise(true)} className="flex w-full items-center justify-between rounded-2xl bg-[#f3f1ec] px-4 py-3 text-left text-sm">
              <span><span className="block font-medium">Login as Enterprise</span><span className="mt-0.5 block text-xs text-[#85837b]">For teams and organizations</span></span>
              <ArrowRight className="size-4" />
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEnterprise(false)} className="mb-5 text-sm text-[#74726c]">← Back to personal login</button>
            <div className="flex flex-col gap-3">
              <Link href="/enterprise" className="flex h-12 items-center justify-between rounded-2xl border border-[#dcdad3] px-4 text-sm font-medium">Create enterprise account <ArrowRight className="size-4" /></Link>
              <Link href="/enterprise?role=admin" className="flex h-12 items-center justify-between rounded-2xl border border-[#dcdad3] px-4 text-sm font-medium">Login as Admin <ArrowRight className="size-4" /></Link>
              <Link href="/enterprise?role=employee" className="flex h-12 items-center justify-between rounded-2xl border border-[#dcdad3] px-4 text-sm font-medium">Login as Employee <ArrowRight className="size-4" /></Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function Page() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [authOpen, setAuthOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [recent, setRecent] = useState<DocCard[]>([])
  const [popular, setPopular] = useState<DocCard[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      docsApi.list({ sort: 'recent' }),
      docsApi.list({ sort: 'popular' }),
      docsApi.categories(),
    ])
      .then(([r, p, c]) => {
        setRecent(r)
        setPopular(p)
        setCategories(c)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    router.push(query.trim() ? `/discover?q=${encodeURIComponent(query.trim())}` : '/discover')
  }

  const featured = useMemo(() => popular[0], [popular])

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f6f2] text-[#1d1d1b]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-[#65645f] md:flex">
          <Link className="text-[#1d1d1b]" href="/discover">Discover</Link>
          <Link href="/about">About</Link>
          <Link href="/policy">Policy</Link>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/favorites" className="hidden rounded-full px-4 py-2 text-sm text-[#65645f] hover:bg-white md:block">Favourites</Link>
              <span className="hidden text-sm text-[#65645f] md:block">Hi, {user.username || user.full_name || user.email}</span>
              <button onClick={logout} className="rounded-full bg-[#1d1d1b] px-5 py-2.5 text-sm text-white">Log out</button>
            </>
          ) : (
            <>
              <button onClick={() => setAuthOpen(true)} className="hidden rounded-full px-4 py-2 text-sm text-[#65645f] hover:bg-white md:block">Log in</button>
              <button onClick={() => setAuthOpen(true)} className="rounded-full bg-[#1d1d1b] px-5 py-2.5 text-sm text-white">Join F5P <ArrowRight className="ml-1 inline size-3.5" /></button>
            </>
          )}
          <button onClick={() => setMenuOpen(!menuOpen)} className="ml-1 grid size-10 place-items-center rounded-full border border-[#deddd8] md:hidden" aria-label="Open menu"><Menu className="size-4" /></button>
        </div>
      </header>
      {menuOpen && (
        <div className="mx-6 flex flex-col gap-4 rounded-2xl bg-white p-5 text-sm md:hidden">
          <Link href="/discover">Discover</Link>
          <Link href="/about">About</Link>
          <Link href="/policy">Policy</Link>
          {user ? <><Link href="/favorites">Favourites</Link><button className="text-left" onClick={logout}>Log out</button></> : <button className="text-left" onClick={() => setAuthOpen(true)}>Log in</button>}
        </div>
      )}

      <section className="mx-auto max-w-7xl px-6 pb-16 pt-14 lg:px-10 lg:pb-20 lg:pt-20">
        <div className="grid items-end gap-12 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <p className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#8c8a83]"><Sparkles className="size-3.5" /> The open knowledge library</p>
            <h1 className="max-w-3xl text-[clamp(3.5rem,8vw,7.7rem)] font-semibold leading-[.88] tracking-[-0.085em]">Make room<br /><span className="font-serif font-normal italic">for ideas.</span></h1>
          </div>
          <div className="max-w-sm pb-1 lg:pb-3">
            <p className="text-lg leading-relaxed text-[#5d5b55]">A thoughtful home for documents, research, and the small discoveries that make a big difference.</p>
            <Link href="/discover" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold">Start exploring <ArrowRight className="size-4" /></Link>
          </div>
        </div>
        <form onSubmit={submitSearch} className="mt-14 rounded-[26px] bg-[#20211f] p-3 shadow-xl shadow-[#20211f]/10 sm:p-4">
          <div className="flex items-center gap-3 rounded-[18px] bg-[#fffdfa] px-4 py-4 sm:px-5">
            <Search className="size-5 shrink-0 text-[#8c8a83]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents, companies, topics..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9a9891]" />
            <button type="submit" className="rounded-full bg-[#1d1d1b] px-4 py-2 text-xs font-semibold text-white">Search</button>
          </div>
          {categories.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {categories.map((c) => (
                <Link key={c.name} href={`/discover?category=${encodeURIComponent(c.name)}`} className="whitespace-nowrap rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:border-white/40 hover:text-white">{c.name} <span className="text-white/40">{c.count}</span></Link>
              ))}
            </div>
          )}
        </form>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-[#8c8a83]">Curated for you</p>
            <h2 className="text-4xl font-semibold tracking-[-.06em]">Recently added</h2>
          </div>
          <Link href="/discover" className="inline-flex items-center gap-2 text-sm font-semibold">View all documents <ArrowRight className="size-4" /></Link>
        </div>
        {loading ? (
          <p className="mt-8 text-sm text-[#98958c]">Loading the library…</p>
        ) : recent.length ? (
          <div className="mt-8 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {recent.slice(0, 6).map((doc) => <DocCardView key={doc.id} doc={doc} />)}
          </div>
        ) : (
          <div className="mt-8 rounded-3xl bg-white p-12 text-center">
            <p className="font-serif text-2xl italic">No documents yet.</p>
            <p className="mt-2 text-sm text-[#98958c]">Make sure the backend is running and seeded, then refresh.</p>
          </div>
        )}
      </section>

      {popular.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 pb-16 lg:px-10">
          <div className="mb-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-[#8c8a83]"><TrendingUp className="size-4" /> Most popular</div>
          <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {popular.slice(0, 3).map((doc) => <DocCardView key={doc.id} doc={doc} />)}
          </div>
        </section>
      )}

      {featured && (
        <section className="mx-auto grid max-w-7xl gap-5 px-6 pb-20 lg:grid-cols-[1.4fr_.6fr] lg:px-10">
          <Link href={`/discover/${featured.id}`} className="rounded-[26px] bg-[#dfe7f7] p-7 sm:p-10">
            <div className="flex items-center justify-between"><span className="rounded-full bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em]">Editor&apos;s pick</span><TrendingUp className="size-5 text-[#53688f]" /></div>
            <div className="mt-20 max-w-lg">
              <h3 className="font-serif text-4xl leading-[.95] tracking-[-.05em] sm:text-5xl">{featured.filename}</h3>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-[#536070] line-clamp-3">{featured.description || featured.preview}</p>
              <span className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-medium text-white">Read document <ArrowRight className="size-4" /></span>
            </div>
          </Link>
          <div className="rounded-[26px] bg-[#20211f] p-7 text-white sm:p-9">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[.14em] text-white/50"><Clock3 className="size-4" /> This week</div>
            <p className="mt-16 font-serif text-3xl italic leading-tight">“The best libraries are not warehouses. They are invitations.”</p>
            <p className="mt-6 text-xs text-white/50">— F5P editorial note</p>
            <div className="mt-10 h-px bg-white/15" />
            <Link href="/about" className="mt-5 inline-flex items-center gap-2 text-sm text-white/75">How we curate <ArrowRight className="size-4" /></Link>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="rounded-[26px] border border-[#dedbd3] bg-[#fffdfa] p-8 text-center sm:p-12">
          <Bookmark className="mx-auto size-6 text-[#8c8a83]" />
          <h2 className="mt-5 text-3xl font-semibold tracking-[-.05em]">Build your personal library.</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#77746c]">Save documents, follow fields, and pick up exactly where you left off — all in one quiet corner of the internet.</p>
          {user ? (
            <Link href="/favorites" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-medium text-white">Go to your favourites <ArrowRight className="size-4" /></Link>
          ) : (
            <button onClick={() => setAuthOpen(true)} className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-medium text-white">Create a free account <ArrowRight className="size-4" /></button>
          )}
        </div>
      </section>

      <footer className="border-t border-[#e6e3dc] px-6 py-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-xs text-[#89877f] sm:flex-row">
          <span>© 2026 F5P Library</span>
          <div className="flex gap-5">
            <Link href="/about">About</Link>
            <Link href="/policy">Privacy &amp; policy</Link>
            <Link href="/enterprise">For enterprises</Link>
            <span className="flex items-center gap-1"><Check className="size-3" /> Open to everyone</span>
          </div>
        </div>
      </footer>
      {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} />}
    </main>
  )
}
