'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState, type FormEvent } from 'react'
import { Loader2, KeyRound } from 'lucide-react'
import { Logo } from '@/components/logo'
import { authApi } from '@/lib/api'

function ResetForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
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
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Missing reset token</h1>
        <p className="mt-2 text-sm text-[#6b6862]">Open the reset link from your email, or request a new one.</p>
        <Link href="/auth/forgot" className="mt-6 inline-block text-sm font-medium text-[#1d1d1b] underline underline-offset-4">Request a new link</Link>
      </div>
    )
  }

  return (
    <>
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f0ede5]"><KeyRound className="size-6 text-[#1d1d1b]" /></span>
      <h1 className="mt-4 text-center text-2xl font-semibold tracking-[-0.03em]">Choose a new password</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="rp-new" className="mb-1.5 block text-sm font-medium">New password</label>
          <input id="rp-new" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            className="h-12 w-full rounded-xl border border-[#d8d5cc] bg-[#fffdfa] px-4 text-sm outline-none focus:border-[#1d1d1b]" />
        </div>
        <div>
          <label htmlFor="rp-confirm" className="mb-1.5 block text-sm font-medium">Confirm password</label>
          <input id="rp-confirm" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="h-12 w-full rounded-xl border border-[#d8d5cc] bg-[#fffdfa] px-4 text-sm outline-none focus:border-[#1d1d1b]" />
        </div>
        {error && <p role="alert" className="rounded-xl bg-[#fbe4e0] px-4 py-3 text-sm text-[#9a3b2c]">{error}</p>}
        <button type="submit" disabled={busy}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1d1d1b] text-sm font-medium text-white hover:bg-[#3c3b37] disabled:opacity-60">
          {busy && <Loader2 className="size-4 animate-spin" />} Update password
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f6f2] px-6 text-[#1d1d1b]">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-8">
          <Suspense fallback={<p className="text-center text-sm text-[#6b6862]">Loading…</p>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
