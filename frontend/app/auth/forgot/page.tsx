'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { AuthShell } from '@/components/auth-shell'
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
    <AuthShell>
      {sent ? (
        <div className="text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-full bg-ok-soft text-ok">
            <MailCheck className="size-5" aria-hidden />
          </span>
          <h1 className="mt-5 text-[1.35rem] font-medium tracking-[-0.03em]">Check your inbox</h1>
          <p className="mx-auto mt-2 max-w-xs text-[12.5px] leading-relaxed text-muted-foreground">
            If that email is registered, a reset link is on its way. It expires in 30 minutes.
          </p>
          <Link
            href="/enterprise"
            className="mt-6 inline-flex items-center gap-2 text-[12px] font-medium text-foreground underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <p className="eyebrow">Account recovery</p>
          <h1 className="display-md mt-3">Forgot your password?</h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
            Enter your work email and we&apos;ll send you a one-time reset link.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="fp-email"
                className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground"
              >
                Work email
              </label>
              <input
                id="fp-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                className="field mt-1.5"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-[12px] text-danger"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Send reset link
            </button>
          </form>

          <Link
            href="/enterprise"
            className="mt-6 inline-flex items-center gap-2 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden /> Back to sign in
          </Link>
        </>
      )}
    </AuthShell>
  )
}
