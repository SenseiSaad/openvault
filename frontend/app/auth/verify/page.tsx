'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { BadgeCheck, Loader2, MailWarning } from 'lucide-react'
import { AuthShell } from '@/components/auth-shell'
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
      .then((res) => {
        setState('ok')
        setMessage(res.detail)
      })
      .catch((err) => {
        setState('error')
        setMessage(err instanceof Error ? err.message : 'Verification failed.')
      })
  }, [token])

  return state === 'loading' ? (
    <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden /> Verifying your email…
    </p>
  ) : state === 'ok' ? (
    <div className="text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-full bg-ok-soft text-ok">
        <BadgeCheck className="size-5" aria-hidden />
      </span>
      <h1 className="mt-5 text-[1.35rem] font-medium tracking-[-0.03em]">Email verified</h1>
      <p className="mx-auto mt-2 max-w-xs text-[12.5px] leading-relaxed text-muted-foreground">
        {message}
      </p>
      <Link
        href="/enterprise"
        className="mt-6 inline-flex items-center gap-2 text-[12px] font-medium text-foreground underline underline-offset-4"
      >
        Sign in
      </Link>
    </div>
  ) : (
    <div className="text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-full bg-danger-soft text-danger">
        <MailWarning className="size-5" aria-hidden />
      </span>
      <h1 className="mt-5 text-[1.35rem] font-medium tracking-[-0.03em]">Link invalid or expired</h1>
      <p className="mx-auto mt-2 max-w-xs text-[12.5px] leading-relaxed text-muted-foreground">
        {message}
      </p>
      <Link
        href="/auth/forgot"
        className="mt-6 inline-flex items-center gap-2 text-[12px] font-medium text-foreground underline underline-offset-4"
      >
        Request a fresh link
      </Link>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <AuthShell>
      <Suspense fallback={<p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>}>
        <VerifyInner />
      </Suspense>
    </AuthShell>
  )
}
