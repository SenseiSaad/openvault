'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState, type FormEvent } from 'react'
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { AuthShell } from '@/components/auth-shell'
import { authApi } from '@/lib/api'

const LABEL = 'text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground'

function ResetForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setBusy(true)
    try {
      await authApi.resetPassword(token, password)
      router.replace('/enterprise?reset=done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-danger-soft text-danger">
          <KeyRound className="size-5" aria-hidden />
        </span>
        <h1 className="mt-5 text-[1.35rem] font-medium tracking-[-0.03em]">Missing reset token</h1>
        <p className="mx-auto mt-2 max-w-xs text-[12.5px] text-muted-foreground">
          Open the reset link from your email, or request a new one.
        </p>
        <Link
          href="/auth/forgot"
          className="mt-6 inline-flex items-center gap-2 text-[12px] font-medium text-foreground underline underline-offset-4"
        >
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <>
      <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent">
        <KeyRound className="size-5" aria-hidden />
      </span>
      <h1 className="mt-5 text-[1.35rem] font-medium tracking-[-0.03em]">Choose a new password</h1>
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
        Use at least eight characters. You&apos;ll sign in again with your work email.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="rp-new" className={LABEL}>
            New password
          </label>
          <div className="relative mt-1.5">
            <input
              id="rp-new"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              className="field pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Hide new password' : 'Show new password'}
              className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="rp-confirm" className={LABEL}>
            Confirm password
          </label>
          <div className="relative mt-1.5">
            <input
              id="rp-confirm"
              type={showConfirm ? 'text' : 'password'}
              required
              minLength={8}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              className="field pr-11"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((value) => !value)}
              aria-label={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'}
              className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {showConfirm ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
            </button>
          </div>
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
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Update password
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={<p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  )
}
