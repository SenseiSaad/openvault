'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

// Shared sign-in modal. Personal sign-in uses username (via /auth); the
// enterprise sub-panel routes to the email-based flows under /enterprise.
// Google/Apple are intentional UI placeholders in this build.
export function AuthDialog({ onClose }: { onClose: () => void }) {
  const [enterprise, setEnterprise] = useState(false)
  const [notice, setNotice] = useState('')
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#1d1d1b]/35 px-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to OpenVault"
    >
      <div className="relative w-full max-w-md rounded-[28px] bg-[#fffdfa] p-7 shadow-2xl sm:p-9">
        <button onClick={onClose} className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-[#f3f1ec] hover:bg-[#e9e6de]" aria-label="Close">✕</button>
        <div className="mb-7">
          <div className="mb-5 grid size-11 place-items-center rounded-2xl bg-[#1d1d1b] text-sm text-white">OV</div>
          <h2 className="text-2xl font-semibold tracking-[-0.04em]">Welcome to OpenVault</h2>
          <p className="mt-2 text-sm text-[#74726c]">A better home for the documents worth keeping.</p>
        </div>
        {notice && <p className="mb-4 rounded-xl bg-[#efece4] px-4 py-3 text-sm text-[#74726c]">{notice}</p>}
        {!enterprise ? (
          <>
            <div className="flex flex-col gap-3">
              <button onClick={() => setNotice('Google sign-in isn’t configured in this build yet.')} className="h-12 rounded-full border border-[#dcdad3] text-sm font-medium hover:bg-[#f5f3ee]">Continue with Google</button>
              <button onClick={() => setNotice('Apple sign-in isn’t configured in this build yet.')} className="h-12 rounded-full border border-[#dcdad3] text-sm font-medium hover:bg-[#f5f3ee]">Continue with Apple</button>
              <Link href="/auth" className="grid h-12 place-items-center rounded-full bg-[#1d1d1b] text-sm font-medium text-white hover:bg-[#3c3b37]">Continue with Email</Link>
            </div>
            <div className="my-6 flex items-center gap-3 text-xs text-[#aaa8a1]"><span className="h-px flex-1 bg-[#e6e3dc]" />OR<span className="h-px flex-1 bg-[#e6e3dc]" /></div>
            <button onClick={() => setEnterprise(true)} className="flex w-full items-center justify-between rounded-2xl bg-[#f3f1ec] px-4 py-3 text-left text-sm hover:bg-[#e9e6de]">
              <span><span className="block font-medium">Log in as Enterprise</span><span className="mt-0.5 block text-xs text-[#85837b]">For teams and organizations</span></span>
              <ArrowRight className="size-4" />
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEnterprise(false)} className="mb-5 text-sm text-[#74726c] hover:text-[#1d1d1b]">← Back to personal login</button>
            <div className="flex flex-col gap-3">
              <Link href="/enterprise" className="flex h-12 items-center justify-between rounded-2xl border border-[#dcdad3] px-4 text-sm font-medium hover:bg-[#f5f3ee]">Create enterprise account <ArrowRight className="size-4" /></Link>
              <Link href="/enterprise?role=admin" className="flex h-12 items-center justify-between rounded-2xl border border-[#dcdad3] px-4 text-sm font-medium hover:bg-[#f5f3ee]">Log in as Admin <ArrowRight className="size-4" /></Link>
              <Link href="/enterprise?role=employee" className="flex h-12 items-center justify-between rounded-2xl border border-[#dcdad3] px-4 text-sm font-medium hover:bg-[#f5f3ee]">Log in as Employee <ArrowRight className="size-4" /></Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default AuthDialog
