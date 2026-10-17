'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { ArrowLeft, MailCheck, Loader2 } from 'lucide-react'
import { Logo } from '@/components/logo'
import { authApi } from '@/lib/api'

// Request a password-reset link. The server always answers the same way so
// this page can never reveal whether an email is registered.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await authApi.forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f6f2] px-6 text-[#1d1d1b]">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-8">
          {sent ? (
            <div className="text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#e7f0e6]"><MailCheck className="size-6 text-[#3f6b45]" /></span>
              <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">Check your inbox</h1>
              <p className="mt-2 text-sm leading-relaxed text-[#6b6862]">
                If that email is registered, a reset link is on its way. It expires in 30 minutes.
              </p>
              <Link href="/enterprise" className="mt-6 inline-block text-sm font-medium text-[#1d1d1b] underline underline-offset-4">Back to sign in</Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-[-0.03em]">Forgot your password?</h1>
              <p className="mt-2 text-sm leading-relaxed text-[#6b6862]">Enter your work email and we&apos;ll send you a one-time reset link.</p>
              <form onSubmit={submit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="fp-email" className="mb-1.5 block text-sm font-medium">Email</label>
                  <input id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
                    className="h-12 w-full rounded-xl border border-[#d8d5cc] bg-[#fffdfa] px-4 text-sm outline-none focus:border-[#1d1d1b]" />
                </div>
                {error && <p role="alert" className="rounded-xl bg-[#fbe4e0] px-4 py-3 text-sm text-[#9a3b2c]">{error}</p>}
                <button type="submit" disabled={busy}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1d1d1b] text-sm font-medium text-white hover:bg-[#3c3b37] disabled:opacity-60">
                  {busy && <Loader2 className="size-4 animate-spin" />} Send reset link
                </button>
              </form>
              <Link href="/enterprise" className="mt-6 inline-flex items-center gap-2 text-sm text-[#6b6862] hover:text-[#1d1d1b]"><ArrowLeft className="size-4" /> Back to sign in</Link>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
