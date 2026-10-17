'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { BadgeCheck, Loader2, MailWarning } from 'lucide-react'
import { Logo } from '@/components/logo'
import { authApi } from '@/lib/api'

function VerifyInner() {
  const params = useSearchParams()
  const token = params.get('token') || ''
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(token ? 'loading' : 'error')
  const [message, setMessage] = useState('No verification token in the link.')

  useEffect(() => {
    if (!token) return
    authApi
      .verifyEmail(token)
      .then((res) => { setState('ok'); setMessage(res.detail) })
      .catch((err) => { setState('error'); setMessage(err instanceof Error ? err.message : 'Verification failed.') })
  }, [token])

  return state === 'loading' ? (
    <p className="flex items-center justify-center gap-2 py-8 text-sm text-[#6b6862]"><Loader2 className="size-4 animate-spin" /> Verifying your email…</p>
  ) : state === 'ok' ? (
    <div className="text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#e7f0e6]"><BadgeCheck className="size-6 text-[#3f6b45]" /></span>
      <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">Email verified</h1>
      <p className="mt-2 text-sm text-[#6b6862]">{message}</p>
      <Link href="/enterprise" className="mt-6 inline-block text-sm font-medium text-[#1d1d1b] underline underline-offset-4">Sign in</Link>
    </div>
  ) : (
    <div className="text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#fbe4e0]"><MailWarning className="size-6 text-[#9a3b2c]" /></span>
      <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">Link invalid or expired</h1>
      <p className="mt-2 text-sm text-[#6b6862]">{message}</p>
      <Link href="/auth/forgot" className="mt-6 inline-block text-sm font-medium text-[#1d1d1b] underline underline-offset-4">Request a fresh link</Link>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f6f2] px-6 text-[#1d1d1b]">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-8">
          <Suspense fallback={<p className="text-center text-sm text-[#6b6862]">Loading…</p>}>
            <VerifyInner />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
