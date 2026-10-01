'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowRight, Bookmark } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { docsApi, type DocCard } from '@/lib/api'
import DocCardView from '@/components/doc-card'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [docs, setDocs] = useState<DocCard[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<number | null>(null)

  // Wait for the session restore, then redirect anonymous visitors to sign in.
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/auth?next=%2Ffavorites')
      return
    }
    docsApi.favorites().then(setDocs).catch(() => setDocs([])).finally(() => setLoading(false))
  }, [authLoading, user, router])

  // Un-save a document, dropping its card only once the request succeeds.
  async function remove(id: number) {
    setRemoving(id)
    try {
      await docsApi.removeFavorite(id)
      setDocs((prev) => prev.filter((d) => d.id !== id))
    } catch {
      /* ignore: leave the card in place on failure */
    } finally {
      setRemoving(null)
    }
  }

  if (authLoading || !user) {
    return <main className="grid min-h-screen place-items-center bg-[#f7f6f2] text-sm text-[#98958c]">Loading…</main>
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#1d1d1b]">
      <SiteHeader />

      <section className="mx-auto max-w-7xl px-6 pb-24 pt-8 sm:pt-12 lg:px-10">
        <header className="max-w-2xl">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-[#8c8a83]">
            <Bookmark className="size-3.5" aria-hidden="true" /> Your library
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.02] tracking-[-.05em] sm:text-6xl sm:tracking-[-.07em]">
            Saved for <span className="font-serif font-normal italic">later.</span>
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[#77746c]">
            {!loading && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e6e3dc] bg-[#fffdfa] px-3 py-1 text-xs font-medium text-[#74726c]">
                <Bookmark className="size-3.5 fill-current" aria-hidden="true" />
                {docs.length} {docs.length === 1 ? 'document' : 'documents'}
              </span>
            )}
            <span>Everything you&apos;ve kept close, in one quiet place.</span>
          </div>
        </header>

        {loading ? (
          <p className="mt-12 text-sm text-[#98958c]">Loading your favourites…</p>
        ) : docs.length ? (
          <ul className="mt-12 grid list-none gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((doc) => (
              <li key={doc.id} className="relative">
                <DocCardView doc={doc} />
                <button
                  onClick={() => remove(doc.id)}
                  disabled={removing === doc.id}
                  className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-[#fffdfa]/85 text-[#1d1d1b] shadow-sm ring-1 ring-[#e6e3dc] backdrop-blur transition hover:bg-[#fffdfa] hover:text-[#9a3b2c] disabled:opacity-50"
                  aria-label={`Remove ${doc.filename} from favourites`}
                  title="Remove from favourites"
                >
                  <Bookmark className="size-4 fill-current" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-12 flex flex-col items-center rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] px-6 py-16 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-[#f7f6f2] text-[#8c8a83] ring-1 ring-[#e6e3dc]">
              <Bookmark className="size-6" aria-hidden="true" />
            </div>
            <p className="mt-6 font-serif text-2xl italic">You haven&apos;t saved anything yet.</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#77746c]">
              Browse the library and tap the bookmark on anything worth keeping close.
            </p>
            <Link
              href="/discover"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#3c3b37]"
            >
              Explore documents <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  )
}
