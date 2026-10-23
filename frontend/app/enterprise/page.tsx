'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
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
  const [showSignInPassword, setShowSignInPassword] = useState(false)
  const [showCreatePassword, setShowCreatePassword] = useState(false)

  // After auth, land in the workspace unless a ?next destination was provided.
  const next = params.get('next') || '/workspace'

  async function onSignIn(e: FormEvent<HTMLFormElement>) {
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

  async function onCreate(e: FormEvent<HTMLFormElement>) {
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

  const signInHeading =
    role === 'admin'
      ? 'Sign in as an admin.'
      : role === 'employee'
        ? 'Sign in as an employee.'
        : 'Welcome back.'

  const labelClass = 'text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground'

  function tabClass(active: boolean) {
    return `relative pb-3 text-[13px] font-medium transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-px ${
      active
        ? 'text-foreground after:bg-accent'
        : 'text-muted-foreground after:bg-transparent hover:text-foreground'
    }`
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="lg:grid lg:min-h-screen lg:grid-cols-[0.92fr_1.08fr]">
        {/* Brand / reassurance panel */}
        <aside className="relative overflow-hidden border-b border-white/[0.06] bg-[#1a1815] px-6 pb-10 pt-6 text-[#f3efe5] sm:px-10 lg:flex lg:min-h-screen lg:flex-col lg:border-b-0 lg:border-r lg:px-12 lg:py-10">
          <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 opacity-[0.12]" />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -right-24 size-[28rem] rounded-full border border-white/10"
          >
            <div className="absolute inset-10 rounded-full border border-white/10" />
            <div className="absolute inset-24 rounded-full border border-[#d9a75f]/25" />
            <div className="absolute inset-[8.5rem] rounded-full bg-[#d9a75f]/10" />
          </div>

          <div className="relative flex items-center justify-between">
            <Logo tone="inverse" />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[11px] text-[#f3efe5]/50 transition-colors hover:text-[#f3efe5]"
            >
              <ArrowLeft className="size-3" aria-hidden /> Back to site
            </Link>
          </div>

          <div className="relative mt-14 max-w-md lg:my-auto lg:mt-0">
            <p className="eyebrow text-[#d9a75f]">OpenVault for teams</p>
            <h1 className="display-lg mt-5">
              Knowledge works
              <br />
              <span className="serif text-[#d9a75f]">better together.</span>
            </h1>
            <p className="mt-5 max-w-sm text-[13px] leading-relaxed text-[#f3efe5]/55">
              Bring your organization&apos;s best thinking into one calm, searchable home. Employees
              and admins sign in with their work email; your role is set by your company
              administrator.
            </p>

            <ul className="mt-8 hidden flex-col gap-3 sm:flex">
              {[
                'A private workspace for your company',
                'AI answers with document citations',
                'An audit trail for every action',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-[11.5px] text-[#f3efe5]/65">
                  <Check className="size-3.5 shrink-0 text-[#d9a75f]" aria-hidden /> {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mt-12 hidden items-center gap-3 border-t border-white/10 pt-5 lg:flex">
            <ShieldCheck className="size-4 shrink-0 text-[#d9a75f]" aria-hidden />
            <p className="text-[10.5px] leading-relaxed text-[#f3efe5]/40">
              Tenant-isolated by design. No public library, no free-user browsing.
            </p>
          </div>
        </aside>

        {/* Access panel */}
        <section className="flex flex-col px-5 py-7 sm:px-8 lg:px-12 lg:py-12">
          <div className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col">
            <div className="flex items-center justify-end">
              <ThemeToggle />
            </div>

            <div className="my-auto">
              <div className="pt-8 lg:pt-0">
                <p className="eyebrow">Enterprise access</p>
                <h2 className="display-md mt-3">
                  {tab === 'signin' ? signInHeading : 'Start your organization.'}
                </h2>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                  {tab === 'signin'
                    ? 'Use the work email your company administrator registered.'
                    : 'Create the workspace and become its first employer admin.'}
                </p>
              </div>

            <div
              role="tablist"
              aria-label="Enterprise access"
              className="mt-7 flex gap-6 border-b border-border"
            >
              <button
                type="button"
                role="tab"
                id="tab-signin"
                aria-selected={tab === 'signin'}
                aria-controls="panel-signin"
                onClick={() => {
                  setTab('signin')
                  setError('')
                }}
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
                onClick={() => {
                  setTab('create')
                  setError('')
                }}
                className={tabClass(tab === 'create')}
              >
                Create an organization
              </button>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-5 rounded-lg border border-danger/25 bg-danger-soft px-3.5 py-2.5 text-[12px] text-danger"
              >
                {error}
              </p>
            )}

            {tab === 'signin' ? (
              <form
                id="panel-signin"
                role="tabpanel"
                aria-labelledby="tab-signin"
                className="mt-6 flex flex-col gap-4"
                onSubmit={onSignIn}
              >
                <div>
                  <label htmlFor="signin-email" className={labelClass}>
                    Work email
                  </label>
                  <input
                    id="signin-email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@company.com"
                    autoComplete="email"
                    className="field mt-1.5"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="signin-password" className={labelClass}>
                      Password
                    </label>
                    <Link
                      href="/auth/forgot"
                      className="text-[10.5px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative mt-1.5">
                    <input
                      id="signin-password"
                      name="password"
                      type={showSignInPassword ? 'text' : 'password'}
                      required
                      placeholder="Your password"
                      autoComplete="current-password"
                      className="field pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignInPassword((value) => !value)}
                      aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                    >
                      {showSignInPassword ? (
                        <EyeOff className="size-3.5" aria-hidden />
                      ) : (
                        <Eye className="size-3.5" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  aria-busy={busy}
                  className="btn btn-primary mt-1 w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Sign in {!busy && <ArrowRight className="size-4" aria-hidden />}
                </button>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
                  <span>New to OpenVault?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('create')
                      setError('')
                    }}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Create an organization
                  </button>
                </div>
              </form>
            ) : (
              <form
                id="panel-create"
                role="tabpanel"
                aria-labelledby="tab-create"
                className="mt-6 flex flex-col gap-6"
                onSubmit={onCreate}
              >
                <fieldset className="flex flex-col gap-4">
                  <legend className="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                    <span className="grid size-5 place-items-center rounded-full border border-border text-[8px] text-accent">
                      01
                    </span>
                    The company
                  </legend>
                  <div>
                    <label htmlFor="create-company" className={labelClass}>
                      Company name
                    </label>
                    <input
                      id="create-company"
                      name="company_name"
                      type="text"
                      required
                      placeholder="Northstar Labs"
                      className="field mt-1.5"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="create-website" className={labelClass}>
                        Website <span className="normal-case tracking-normal">(optional)</span>
                      </label>
                      <input
                        id="create-website"
                        name="website"
                        type="text"
                        placeholder="northstar.pk"
                        autoComplete="url"
                        className="field mt-1.5"
                      />
                    </div>
                    <div>
                      <label htmlFor="create-phone" className={labelClass}>
                        Phone <span className="normal-case tracking-normal">(optional)</span>
                      </label>
                      <input
                        id="create-phone"
                        name="phone"
                        type="tel"
                        placeholder="+92 300 0000000"
                        autoComplete="tel"
                        className="field mt-1.5"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="create-contact" className={labelClass}>
                        Contact email <span className="normal-case tracking-normal">(optional)</span>
                      </label>
                      <input
                        id="create-contact"
                        name="contact_email"
                        type="email"
                        placeholder="hello@company.com"
                        className="field mt-1.5"
                      />
                    </div>
                    <div>
                      <label htmlFor="create-max" className={labelClass}>
                        Maximum members
                      </label>
                      <input
                        id="create-max"
                        name="max_employees"
                        type="number"
                        min={1}
                        placeholder="Leave blank for unlimited"
                        className="field mt-1.5"
                      />
                    </div>
                  </div>
                </fieldset>

                <fieldset className="flex flex-col gap-4 border-t border-border pt-5">
                  <legend className="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                    <span className="grid size-5 place-items-center rounded-full border border-border text-[8px] text-accent">
                      02
                    </span>
                    Your admin account
                  </legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="create-name" className={labelClass}>
                        Your name
                      </label>
                      <input
                        id="create-name"
                        name="admin_name"
                        type="text"
                        placeholder="Saad Ahmed"
                        autoComplete="name"
                        className="field mt-1.5"
                      />
                    </div>
                    <div>
                      <label htmlFor="create-title" className={labelClass}>
                        Your title
                      </label>
                      <select
                        id="create-title"
                        name="admin_title"
                        defaultValue=""
                        className="field mt-1.5"
                      >
                        <option value="">Select a title</option>
                        {JOB_TITLES.map((title) => (
                          <option key={title} value={title}>
                            {title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="create-email" className={labelClass}>
                      Admin email
                    </label>
                    <input
                      id="create-email"
                      name="email"
                      type="email"
                      required
                      placeholder="you@company.com"
                      autoComplete="email"
                      className="field mt-1.5"
                    />
                  </div>
                  <div>
                    <label htmlFor="create-password" className={labelClass}>
                      Password
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        id="create-password"
                        name="password"
                        type={showCreatePassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        className="field pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCreatePassword((value) => !value)}
                        aria-label={showCreatePassword ? 'Hide password' : 'Show password'}
                        className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                      >
                        {showCreatePassword ? (
                          <EyeOff className="size-3.5" aria-hidden />
                        ) : (
                          <Eye className="size-3.5" aria-hidden />
                        )}
                      </button>
                    </div>
                  </div>
                </fieldset>

                <button
                  type="submit"
                  disabled={busy}
                  aria-busy={busy}
                  className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Create organization {!busy && <ArrowRight className="size-4" aria-hidden />}
                </button>
              </form>
            )}

            <div className="mt-7 flex items-start gap-2 border-t border-border pt-4">
              <Sparkles className="mt-0.5 size-3 shrink-0 text-accent" aria-hidden />
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                By continuing you agree to the{' '}
                <Link href="/policy" className="text-foreground underline underline-offset-4">
                  privacy and security model
                </Link>
                . Your workspace is isolated from every other organization.
              </p>
            </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default function EnterprisePage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Loading secure access…
          </span>
        </main>
      }
    >
      <EnterpriseInner />
    </Suspense>
  )
}
