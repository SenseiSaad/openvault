'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { docsApi, type DocCard } from '@/lib/api'
import DocCardView from '@/components/doc-card'

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

  async function remove(id: number) {
    setRemoving(id)
    try {
      await docsApi.removeFavorite(id)
      setDocs((prev) => prev.filter((d) => d.id !== id))
    } catch {
      /* ignore — leave the card in place on failure */
    } finally {
      setRemoving(null)
    }
  }

  if (authLoading || !user) {
    return <main className="grid min-h-screen place-items-center bg-[#f7f6f2] text-sm text-[#98958c]">Loading…</main>
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-6 text-[#1d1d1b] lg:px-10">
      <header className="mx-auto flex max-w-7xl items-center justify-between py-5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#74726c]"><ArrowLeft className="size-4" /> Back home</Link>
        <Link href="/" className="text-lg font-semibold tracking-[-.04em]">F5P<span className="text-[#b1b0ac]">/</span>library</Link>
        <Link href="/discover" className="text-sm text-[#74726c]">Discover</Link>
      </header>

      <section className="mx-auto max-w-7xl py-10 lg:py-16">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#8c8a83]">Your library</p>
        <h1 className="mt-3 text-5xl font-semibold tracking-[-.07em] sm:text-6xl">Favourites</h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-[#77746c]">Everything you&apos;ve saved, kept in one quiet place.</p>

        {loading ? (
          <p className="mt-10 text-sm text-[#98958c]">Loading your favourites…</p>
        ) : docs.length ? (
          <div className="mt-10 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((doc) => (
              <div key={doc.id} className="relative">
                <DocCardView doc={doc} />
                <button
                  onClick={() => remove(doc.id)}
                  disabled={removing === doc.id}
                  className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/85 text-[#9a3b2c] shadow-sm backdrop-blur hover:bg-white disabled:opacity-50"
                  aria-label="Remove from favourites"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border border-[#dedbd3] bg-[#fffdfa] p-12 text-center">
            <p className="font-serif text-2xl italic">Nothing saved yet.</p>
            <p className="mt-2 text-sm text-[#98958c]">Browse the library and tap “Add to favourites” on anything worth keeping.</p>
            <Link href="/discover" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-medium text-white">Explore documents <ArrowRight className="size-4" /></Link>
          </div>
        )}
      </section>
    </main>
  )
}
