'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { ArrowRight, Check, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Logo } from '@/components/logo'
import { useAuth } from '@/lib/auth'

function AuthInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { publicLogin, publicRegister } = useAuth()

  const [mode, setMode] = useState<'signup' | 'login'>(
    params.get('mode') === 'login' ? 'login' : 'signup',
  )
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const next = params.get('next') || '/'

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const form = new FormData(e.currentTarget)
    const username = String(form.get('username') || '').trim()
    const password = String(form.get('password') || '')
    try {
      if (mode === 'signup') {
        const email = String(form.get('email') || '').trim()
        await publicRegister({ username, email, password })
      } else {
        await publicLogin(username, password)
      }
      router.push(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  function social(provider: string) {
    setError('')
    setNotice(`${provider} sign-in isn’t configured in this build yet.`)
  }

  return (
    <main className="flex min-h-screen bg-[#f7f6f2] text-[#1d1d1b]">
      {/* Left showcase panel: brand statement, desktop only. */}
      <section className="hidden flex-1 flex-col justify-between bg-[#20211f] p-10 text-white lg:flex">
        {/* Light-on-dark OpenVault lockup: mirrors <Logo> proportions with the chip inverted for the dark panel. */}
        <Link
          href="/"
          aria-label="OpenVault home"
          className="flex items-center gap-2.5 text-lg font-semibold tracking-[-0.04em]"
        >
          <span className="grid size-8 place-items-center rounded-[10px] bg-white text-sm text-[#1d1d1b]">OV</span>
          <span>Open<span className="text-white/45">Vault</span></span>
        </Link>
        <div>
          <p className="max-w-md font-serif text-5xl italic leading-tight text-white/90">
            Make a little more room for the ideas that stay with you.
          </p>
          <div className="mt-10 flex flex-col gap-4 text-sm text-white/55">
            <p><Check className="mr-2 inline size-4 text-white" /> Save your personal reading list</p>
            <p><Check className="mr-2 inline size-4 text-white" /> Download thoughtful documents</p>
            <p><Check className="mr-2 inline size-4 text-white" /> Discover something new every week</p>
          </div>
        </div>
        <p className="text-xs text-white/35">The open knowledge library.</p>
      </section>

      {/* Right form panel: full width on mobile, ~48% on desktop. */}
      <section className="flex w-full items-center justify-center px-6 py-10 lg:w-[48%]">
        <div className="w-full max-w-md">
          {/* Shared brand mark (also the home link). The dark panel carries the brand on desktop. */}
          <Logo className="mb-12 lg:hidden" />

          <div className="mb-9">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#9b9890]">
              {mode === 'signup' ? 'Join the library' : 'Welcome back'}
            </p>
            <h1 className="text-4xl font-semibold tracking-[-0.055em] text-[#20211f]">
              {mode === 'signup' ? (
                <>Create your <span className="font-serif font-normal italic">account.</span></>
              ) : (
                <>Sign in to <span className="font-serif font-normal italic">OpenVault.</span></>
              )}
            </h1>
            <p className="mt-3 text-sm text-[#77746c]">
              {mode === 'signup'
                ? 'Keep the ideas you want close.'
                : 'Sign in with your username to pick up where you left off.'}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => social('Google')} className="h-12 rounded-full border border-[#d8d5cc] text-sm font-medium hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b]/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f6f2]">Continue with Google</button>
            <button type="button" onClick={() => social('Apple')} className="h-12 rounded-full border border-[#d8d5cc] text-sm font-medium hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b]/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f6f2]">Continue with Apple</button>
          </div>
          <div className="my-7 flex items-center gap-3 text-xs text-[#9b9890]">
            <span className="h-px flex-1 bg-[#eae7df]" />OR<span className="h-px flex-1 bg-[#eae7df]" />
          </div>

          {notice && (
            <p role="status" aria-live="polite" className="mb-4 rounded-xl bg-[#eae7df] px-4 py-3 text-sm text-[#77746c]">{notice}</p>
          )}
          {error && (
            <p role="alert" className="mb-4 rounded-xl bg-[#fbe4e0] px-4 py-3 text-sm text-[#9a3b2c]">{error}</p>
          )}

          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            {mode === 'signup' && (
              <label className="flex flex-col gap-2 text-sm font-medium">
                Email address
                <input name="email" type="email" required placeholder="you@example.com" autoComplete="email" className="h-12 rounded-xl border border-[#d8d5cc] bg-white px-4 text-sm outline-none focus:border-[#1d1d1b]" />
              </label>
            )}
            <label className="flex flex-col gap-2 text-sm font-medium">
              Username
              <input name="username" type="text" required minLength={3} placeholder="yourname" autoComplete="username" className="h-12 rounded-xl border border-[#d8d5cc] bg-white px-4 text-sm outline-none focus:border-[#1d1d1b]" />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Password
              <div className="relative">
                <input name="password" type={showPassword ? 'text' : 'password'} required minLength={6} placeholder="At least 6 characters" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className="h-12 w-full rounded-xl border border-[#d8d5cc] bg-white px-4 pr-12 text-sm outline-none focus:border-[#1d1d1b]" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility" aria-pressed={showPassword} className="absolute right-3 top-3 grid size-6 place-items-center text-[#77746c]">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>
            <button disabled={busy} className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-[#1d1d1b] text-sm font-medium text-white hover:bg-[#3c3b37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f6f2] disabled:opacity-60">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === 'signup' ? 'Create account' : 'Log in'}
              {!busy && <ArrowRight className="size-4" />}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-[#77746c]">
            {mode === 'signup' ? 'Already a member?' : 'New to OpenVault?'}{' '}
            <button type="button" onClick={() => { setError(''); setNotice(''); setMode(mode === 'signup' ? 'login' : 'signup') }} className="font-medium text-[#1d1d1b] underline underline-offset-4">
              {mode === 'signup' ? 'Log in' : 'Create an account'}
            </button>
          </p>
          <Link href="/enterprise" className="mt-8 block text-center text-xs text-[#9b9890] underline underline-offset-4">
            Looking for enterprise access?
          </Link>
        </div>
      </section>
    </main>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f7f6f2]" />}>
      <AuthInner />
    </Suspense>
  )
}
