'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { Logo } from '@/components/logo'
import { useAuth } from '@/lib/auth'
import { JOB_TITLES } from '@/lib/api'

function EnterpriseInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { enterpriseLogin, enterpriseRegister } = useAuth()

  // ?role=admin|employee just tailors the copy; both sign in with a work email.
  const role = params.get('role')
  // ?tab=create opens the "Create an organization" tab by default.
  const [tab, setTab] = useState<'signin' | 'create'>(
    params.get('tab') === 'create' ? 'create' : 'signin',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // After auth, land in the workspace unless a ?next destination was provided.
  const next = params.get('next') || '/workspace'

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
      const maxRaw = String(f.get('max_employees') || '').trim()
      await enterpriseRegister({
        company_name: String(f.get('company_name') || '').trim(),
        admin_name: String(f.get('admin_name') || '').trim(),
        admin_title: String(f.get('admin_title') || '').trim(),
        website: String(f.get('website') || '').trim(),
        contact_email: String(f.get('contact_email') || '').trim(),
        phone: String(f.get('phone') || '').trim(),
        max_employees: maxRaw ? Number(maxRaw) : null,
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
    role === 'admin'
      ? 'Sign in as admin.'
      : role === 'employee'
        ? 'Sign in as employee.'
        : 'OpenVault for teams.'

  const inputClass =
    'h-12 rounded-xl border border-[#d8d5cc] bg-white px-4 text-sm text-[#1d1d1b] outline-none transition-colors placeholder:text-[#9b9890] focus:border-[#1d1d1b] focus:ring-2 focus:ring-[#1d1d1b]/10'
  const primaryBtn =
    'flex h-12 items-center justify-center gap-2 rounded-full bg-[#1d1d1b] text-sm font-medium text-white transition-colors hover:bg-[#3c3b37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b]/50 disabled:cursor-not-allowed disabled:opacity-60'

  function tabClass(active: boolean) {
    return active
      ? 'border-b-2 border-[#1d1d1b] pb-3 text-[#1d1d1b]'
      : 'border-b-2 border-transparent pb-3 text-[#a5a299] transition-colors hover:text-[#77746c]'
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-6 py-8 text-[#1d1d1b] lg:px-10">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <Logo />
        <Link
          href="/auth"
          className="rounded-full text-sm text-[#77746c] transition-colors hover:text-[#1d1d1b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b]/40"
        >
          Personal login
        </Link>
      </header>

      <section className="mx-auto grid max-w-5xl gap-12 py-16 lg:grid-cols-[1fr_440px] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9b9890]">
            OpenVault for teams
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-6xl sm:tracking-[-0.07em]">
            Knowledge works
            <br />
            <span className="font-serif font-normal italic">better together.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-[#77746c]">
            Bring your organization&apos;s best thinking into one calm, searchable home. Employees
            and admins sign in with their work email; your role is set by your company administrator.
          </p>
        </div>

        <div className="rounded-[28px] border border-[#dedbd3] bg-[#fffdfa] p-7 shadow-xl shadow-[#20211f]/5 sm:p-9">
          <div
            role="tablist"
            aria-label="Enterprise access"
            className="mb-6 flex gap-5 border-b border-[#eae7df] text-sm font-semibold"
          >
            <button
              type="button"
              role="tab"
              id="tab-signin"
              aria-selected={tab === 'signin'}
              aria-controls="panel-signin"
              onClick={() => { setTab('signin'); setError('') }}
              className={tabClass(tab === 'signin')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              id="tab-create"
              aria-selected={tab === 'create'}
              aria-controls="panel-create"
              onClick={() => { setTab('create'); setError('') }}
              className={tabClass(tab === 'create')}
            >
              Create an organization
            </button>
          </div>

          {error && (
            <p role="alert" className="mb-4 rounded-xl bg-[#fbe4e0] px-4 py-3 text-sm text-[#9a3b2c]">
              {error}
            </p>
          )}

          {tab === 'signin' ? (
            <form
              id="panel-signin"
              role="tabpanel"
              aria-labelledby="tab-signin"
              className="flex flex-col gap-4"
              onSubmit={onSignIn}
            >
              <p className="text-sm font-medium text-[#1d1d1b]">{heading}</p>
              <label htmlFor="signin-email" className="sr-only">Work email</label>
              <input id="signin-email" name="email" type="email" required placeholder="Work email" autoComplete="email" className={inputClass} />
              <label htmlFor="signin-password" className="sr-only">Password</label>
              <input id="signin-password" name="password" type="password" required placeholder="Password" autoComplete="current-password" className={inputClass} />
              <button type="submit" disabled={busy} aria-busy={busy} className={primaryBtn}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Sign in {!busy && <ArrowRight className="size-4" aria-hidden />}
              </button>
              <p className="text-center text-xs text-[#9b9890]">Demo: admin@openscience.com / demo1234</p>
            </form>
          ) : (
            <form
              id="panel-create"
              role="tabpanel"
              aria-labelledby="tab-create"
              className="flex flex-col gap-4"
              onSubmit={onCreate}
            >
              <p className="text-sm font-medium text-[#1d1d1b]">
                Register a new organization, and you become its first admin.
              </p>
              <label htmlFor="create-company" className="sr-only">Company name</label>
              <input id="create-company" name="company_name" type="text" required placeholder="Company name" className={inputClass} />
              <label htmlFor="create-website" className="sr-only">Company website (optional)</label>
              <input id="create-website" name="website" type="text" placeholder="Company website (optional)" autoComplete="url" className={inputClass} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="create-contact" className="sr-only">Contact email (optional)</label>
                  <input id="create-contact" name="contact_email" type="email" placeholder="Contact email (optional)" className={`w-full ${inputClass}`} />
                </div>
                <div>
                  <label htmlFor="create-phone" className="sr-only">Phone (optional)</label>
                  <input id="create-phone" name="phone" type="tel" placeholder="Phone (optional)" autoComplete="tel" className={`w-full ${inputClass}`} />
                </div>
              </div>
              <label htmlFor="create-max" className="sr-only">Maximum members (optional)</label>
              <input id="create-max" name="max_employees" type="number" min={1} placeholder="Max members (optional, blank = unlimited)" className={inputClass} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="create-name" className="sr-only">Your name (optional)</label>
                  <input id="create-name" name="admin_name" type="text" placeholder="Your name (optional)" autoComplete="name" className={`w-full ${inputClass}`} />
                </div>
                <div>
                  <label htmlFor="create-title" className="sr-only">Your title (optional)</label>
                  <select id="create-title" name="admin_title" defaultValue="" className={`w-full ${inputClass}`}>
                    <option value="">Your title (optional)</option>
                    {JOB_TITLES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <label htmlFor="create-email" className="sr-only">Admin email</label>
              <input id="create-email" name="email" type="email" required placeholder="Admin email" autoComplete="email" className={inputClass} />
              <label htmlFor="create-password" className="sr-only">Password (at least 6 characters)</label>
              <input id="create-password" name="password" type="password" required minLength={6} placeholder="Password (at least 6 characters)" autoComplete="new-password" className={inputClass} />
              <button type="submit" disabled={busy} aria-busy={busy} className={primaryBtn}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Create organization {!busy && <ArrowRight className="size-4" aria-hidden />}
              </button>
            </form>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full text-sm text-[#77746c] transition-colors hover:text-[#1d1d1b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b]/40"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back to OpenVault
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
