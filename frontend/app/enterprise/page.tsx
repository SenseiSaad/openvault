'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'

function EnterpriseInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { enterpriseLogin, enterpriseRegister } = useAuth()

  // ?role=admin|employee just tailors the copy; both sign in with email.
  const role = params.get('role')
  const [tab, setTab] = useState<'signin' | 'create'>('signin')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const next = params.get('next') || '/'

  async function onSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const f = new FormData(e.currentTarget)
    try {
      await enterpriseLogin(String(f.get('email') || '').trim(), String(f.get('password') || ''))
      router.push(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const f = new FormData(e.currentTarget)
    try {
      await enterpriseRegister({
        company_name: String(f.get('company_name') || '').trim(),
        admin_name: String(f.get('admin_name') || '').trim(),
        email: String(f.get('email') || '').trim(),
        password: String(f.get('password') || ''),
      })
      router.push(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const heading =
    role === 'admin' ? 'Sign in as admin.' : role === 'employee' ? 'Sign in as employee.' : 'F5P for teams.'

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-6 py-8 text-[#1d1d1b] lg:px-10">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-[-0.04em]">
          <span className="grid size-8 place-items-center rounded-[10px] bg-[#1d1d1b] text-sm text-white">F5</span> F5P/library
        </Link>
        <Link href="/auth" className="text-sm text-[#77746c]">Personal login</Link>
      </header>

      <section className="mx-auto grid max-w-5xl gap-12 py-16 lg:grid-cols-[1fr_440px] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9b9890]">F5P for teams</p>
          <h1 className="mt-5 text-5xl font-semibold tracking-[-0.07em] sm:text-6xl">
            Knowledge works<br /><span className="font-serif font-normal italic">better together.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-[#77746c]">
            Bring your organization&apos;s best thinking into one calm, searchable home. Employees and
            admins sign in with their work email; your role is set by your company administrator.
          </p>
        </div>

        <div className="rounded-[28px] border border-[#dedbd3] bg-[#fffdfa] p-7 shadow-xl shadow-[#20211f]/5 sm:p-9">
          <div className="mb-6 flex gap-5 border-b border-[#eae7df] text-sm font-semibold">
            <button
              onClick={() => { setTab('signin'); setError('') }}
              className={tab === 'signin' ? 'border-b-2 border-[#1d1d1b] pb-3' : 'pb-3 text-[#a5a299]'}
            >
              Sign in
            </button>
            <button
              onClick={() => { setTab('create'); setError('') }}
              className={tab === 'create' ? 'border-b-2 border-[#1d1d1b] pb-3' : 'pb-3 text-[#a5a299]'}
            >
              Create an organization
            </button>
          </div>

          {error && (
            <p className="mb-4 rounded-xl bg-[#fbe4e0] px-4 py-3 text-sm text-[#9a3b2c]">{error}</p>
          )}

          {tab === 'signin' ? (
            <form className="flex flex-col gap-4" onSubmit={onSignIn}>
              <p className="text-sm font-medium text-[#1d1d1b]">{heading}</p>
              <input name="email" type="email" required placeholder="Work email" autoComplete="email" className="h-12 rounded-xl border border-[#d8d5cc] bg-white px-4 text-sm outline-none focus:border-[#1d1d1b]" />
              <input name="password" type="password" required placeholder="Password" autoComplete="current-password" className="h-12 rounded-xl border border-[#d8d5cc] bg-white px-4 text-sm outline-none focus:border-[#1d1d1b]" />
              <button disabled={busy} className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#1d1d1b] text-sm font-medium text-white hover:bg-[#3c3b37] disabled:opacity-60">
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Sign in {!busy && <ArrowRight className="size-4" />}
              </button>
              <p className="text-center text-xs text-[#9b9890]">Demo: admin@acme.com / demo1234</p>
            </form>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={onCreate}>
              <p className="text-sm font-medium text-[#1d1d1b]">Register a new organization — you become its first admin.</p>
              <input name="company_name" type="text" required placeholder="Company name" className="h-12 rounded-xl border border-[#d8d5cc] bg-white px-4 text-sm outline-none focus:border-[#1d1d1b]" />
              <input name="admin_name" type="text" placeholder="Your name (optional)" className="h-12 rounded-xl border border-[#d8d5cc] bg-white px-4 text-sm outline-none focus:border-[#1d1d1b]" />
              <input name="email" type="email" required placeholder="Admin email" autoComplete="email" className="h-12 rounded-xl border border-[#d8d5cc] bg-white px-4 text-sm outline-none focus:border-[#1d1d1b]" />
              <input name="password" type="password" required minLength={6} placeholder="Password (at least 6 characters)" autoComplete="new-password" className="h-12 rounded-xl border border-[#d8d5cc] bg-white px-4 text-sm outline-none focus:border-[#1d1d1b]" />
              <button disabled={busy} className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#1d1d1b] text-sm font-medium text-white hover:bg-[#3c3b37] disabled:opacity-60">
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Create organization {!busy && <ArrowRight className="size-4" />}
              </button>
            </form>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#77746c]">
          <ArrowLeft className="size-4" /> Back to F5P
        </Link>
      </div>
    </main>
  )
}

export default function EnterprisePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f7f6f2]" />}>
      <EnterpriseInner />
    </Suspense>
  )
}
