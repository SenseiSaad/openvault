'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Eye,
  Info,
  Loader2,
  Lock,
  Mail,
  Shield,
  Trash2,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { adminApi, JOB_TITLES, type NewUser, type Role, type User } from '@/lib/api'
import { useAuth } from '@/lib/auth'

type CreatableRole = Exclude<Role, 'public'>

const ROLE_BADGE: Record<Role, { label: string; cls: string; Icon: LucideIcon }> = {
  admin: { label: 'Admin', cls: 'border-[#e7ddfb] bg-[#f5f0ff] text-[#6b46c1]', Icon: Shield },
  employee: { label: 'Employee', cls: 'border-[#cfdbf1] bg-[#dfe7f7] text-[#37589c]', Icon: Briefcase },
  viewer: { label: 'Viewer', cls: 'border-[#e2e3e5] bg-[#eef0f2] text-[#6b6a64]', Icon: Eye },
  public: { label: 'Public', cls: 'border-[#e2e3e5] bg-[#eef0f2] text-[#6b6a64]', Icon: Eye },
}

const ROLE_OPTIONS: { value: CreatableRole; label: string; desc: string; Icon: LucideIcon }[] = [
  { value: 'admin', label: 'Admin', desc: 'Full control, plus member management.', Icon: Shield },
  { value: 'employee', label: 'Employee', desc: 'Upload and manage documents.', Icon: Briefcase },
  { value: 'viewer', label: 'Viewer', desc: 'Read-only access to the library.', Icon: Eye },
]

const inputClass =
  'h-12 w-full rounded-xl border border-[#d8d5cc] bg-white px-4 text-sm text-[#1d1d1b] outline-none transition-colors placeholder:text-[#9b9890] focus:border-[#1d1d1b] focus:ring-2 focus:ring-[#1d1d1b]/10'
const labelClass = 'mb-1.5 block text-sm font-medium text-[#1d1d1b]'
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f6f2]'

function RoleBadge({ role }: { role: Role }) {
  const meta = ROLE_BADGE[role] ?? ROLE_BADGE.viewer
  const Icon = meta.Icon
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.cls}`}
    >
      <Icon className="size-3" aria-hidden /> {meta.label}
    </span>
  )
}

export default function MembersPage() {
  const { user } = useAuth()

  // The auth-gated layout guarantees a user; this keeps the type non-null.
  if (!user) return null

  // Admin-only page. The layout only hides the nav link for non-admins, so a
  // viewer/employee could still land here directly; self-guard.
  if (user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-lg py-10">
        <div className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-8 text-center sm:p-10">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#f1eee7] text-[#77746c]">
            <Lock className="size-5" aria-hidden />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">Admins only</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#77746c]">
            Managing who can access your organization&rsquo;s workspace is limited to admins. If you
            need a change, ask one of your workspace admins.
          </p>
          <Link
            href="/workspace"
            className={`mt-6 inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#3c3b37] ${focusRing}`}
          >
            <ArrowLeft className="size-4" aria-hidden /> Back to workspace
          </Link>
        </div>
      </div>
    )
  }

  return <MembersAdmin currentUserId={user.id} />
}

function MembersAdmin({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [fullName, setFullName] = useState('')
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<CreatableRole>('viewer')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')

  const [removingId, setRemovingId] = useState<number | null>(null)
  const [tableError, setTableError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setLoadError('')
    adminApi
      .users()
      .then(setUsers)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not load members.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const c = { total: users.length, admin: 0, employee: 0, viewer: 0 }
    for (const u of users) {
      if (u.role === 'admin') c.admin += 1
      else if (u.role === 'employee') c.employee += 1
      else if (u.role === 'viewer') c.viewer += 1
    }
    return c
  }, [users])

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')
    setSubmitting(true)
    const payload: NewUser = {
      email: email.trim(),
      password,
      role,
      ...(fullName.trim() ? { full_name: fullName.trim() } : {}),
      ...(title ? { title } : {}),
    }
    try {
      const created = await adminApi.createUser(payload)
      setUsers((prev) => [created, ...prev])
      setFullName('')
      setTitle('')
      setEmail('')
      setPassword('')
      setRole('viewer')
      setFormSuccess(`${created.full_name || created.email} was added as ${created.role}.`)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add this member.')
    } finally {
      setSubmitting(false)
    }
  }

  async function onRemove(u: User) {
    if (u.id === currentUserId) return
    const name = u.full_name || u.email
    if (!window.confirm(`Remove ${name}? They will immediately lose access to this workspace.`)) return
    setTableError('')
    setRemovingId(u.id)
    try {
      await adminApi.removeUser(u.id)
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
    } catch (err) {
      setTableError(err instanceof Error ? err.message : `Could not remove ${name}.`)
    } finally {
      setRemovingId(null)
    }
  }

  const stats = [
    { label: 'Total members', value: counts.total, Icon: Users, dot: '' },
    { label: 'Admins', value: counts.admin, Icon: Shield, dot: 'bg-[#6b46c1]' },
    { label: 'Employees', value: counts.employee, Icon: Briefcase, dot: 'bg-[#37589c]' },
    { label: 'Viewers', value: counts.viewer, Icon: Eye, dot: 'bg-[#9b9890]' },
  ]

  return (
    <div className="space-y-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">Member management</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl sm:tracking-[-0.05em]">
          Manage your team&rsquo;s <span className="font-serif font-normal italic">access.</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#77746c] sm:text-base">
          Invite teammates, choose what they can do, and control who can reach your
          organization&rsquo;s private workspace.
        </p>
      </header>

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : (
        <>
          {/* Summary strip */}
          <section aria-label="Membership summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => {
              const Icon = s.Icon
              return (
                <div key={s.label} className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4">
                  <div className="flex items-center justify-between text-[#8c8a83]">
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      {s.dot ? <span className={`size-1.5 rounded-full ${s.dot}`} aria-hidden /> : null}
                      {s.label}
                    </span>
                    <Icon className="size-4 text-[#b1b0ac]" aria-hidden />
                  </div>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[#1d1d1b]">{s.value}</p>
                </div>
              )
            })}
          </section>

          {/* Invite panel */}
          <section className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f1eee7] text-[#1d1d1b]">
                <UserPlus className="size-4" aria-hidden />
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.02em]">Invite a member</h2>
                <p className="mt-0.5 text-sm text-[#77746c]">
                  Create an account for a teammate. They sign in with the email and password you set here.
                </p>
              </div>
            </div>

            <form onSubmit={onCreate} className="mt-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="m-name" className={labelClass}>
                    Full name <span className="font-normal text-[#9b9890]">(optional)</span>
                  </label>
                  <input
                    id="m-name"
                    name="full_name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    placeholder="Ada Lovelace"
                    className={inputClass}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label htmlFor="m-email" className={labelClass}>Email</label>
                  <input
                    id="m-email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="off"
                    placeholder="teammate@company.com"
                    className={inputClass}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="m-title" className={labelClass}>
                  Job title <span className="font-normal text-[#9b9890]">(optional)</span>
                </label>
                <select
                  id="m-title"
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                  disabled={submitting}
                >
                  <option value="">No title</option>
                  {JOB_TITLES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-[#8c8a83]">
                  A display label only (for example CEO or Engineer). It does not change what the
                  member can do; that is set by the role below.
                </p>
              </div>

              <div>
                <label htmlFor="m-password" className={labelClass}>Temporary password</label>
                <input
                  id="m-password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className={inputClass}
                  disabled={submitting}
                  aria-describedby="m-password-hint"
                />
                <p id="m-password-hint" className="mt-1.5 text-xs text-[#8c8a83]">
                  Use at least 8 characters. Share it securely; your teammate can change it after
                  signing in.
                </p>
              </div>

              <fieldset disabled={submitting}>
                <legend className={labelClass}>Role</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {ROLE_OPTIONS.map((opt) => {
                    const Icon = opt.Icon
                    const active = role === opt.value
                    return (
                      <label
                        key={opt.value}
                        className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-colors ${active ? 'border-[#1d1d1b] bg-white ring-2 ring-[#1d1d1b]/10' : 'border-[#dcdad3] bg-white hover:border-[#b9b6ad]'} ${submitting ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="role"
                            value={opt.value}
                            checked={active}
                            onChange={() => setRole(opt.value)}
                            className="sr-only"
                          />
                          <Icon className="size-4 text-[#1d1d1b]" aria-hidden />
                          <span className="text-sm font-medium text-[#1d1d1b]">{opt.label}</span>
                          {active ? <CheckCircle2 className="ml-auto size-4 text-[#1d1d1b]" aria-hidden /> : null}
                        </span>
                        <span className="text-xs leading-relaxed text-[#77746c]">{opt.desc}</span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              {formError ? (
                <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#fbe4e0] px-4 py-3 text-sm text-[#9a3b2c]">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {formError}
                </p>
              ) : null}
              {formSuccess ? (
                <p role="status" className="flex items-start gap-2 rounded-xl bg-[#e7f0e6] px-4 py-3 text-sm text-[#3f6b45]">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> {formSuccess}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  aria-busy={submitting}
                  className={`inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#1d1d1b] px-6 text-sm font-medium text-white transition-colors hover:bg-[#3c3b37] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <UserPlus className="size-4" aria-hidden />
                  )}
                  {submitting ? 'Adding…' : 'Add member'}
                </button>
                <span className="text-xs text-[#8c8a83]">Your teammate can sign in right away.</span>
              </div>
            </form>
          </section>

          {/* Members list */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold tracking-[-0.02em]">
              Members <span className="text-sm font-normal text-[#8c8a83]">({counts.total})</span>
            </h2>

            {tableError ? (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#fbe4e0] px-4 py-3 text-sm text-[#9a3b2c]">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {tableError}
              </p>
            ) : null}

            {counts.total === 0 ? (
              <div className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-10 text-center">
                <p className="font-serif text-xl italic text-[#1d1d1b]">No members yet.</p>
                <p className="mx-auto mt-2 max-w-xs text-sm text-[#98958c]">
                  Add your first teammate using the form above.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-hidden rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#eae7df] text-left text-xs font-semibold uppercase tracking-[0.08em] text-[#8c8a83]">
                        <th scope="col" className="px-5 py-3 font-semibold">Name</th>
                        <th scope="col" className="px-5 py-3 font-semibold">Email</th>
                        <th scope="col" className="px-5 py-3 font-semibold">Role</th>
                        <th scope="col" className="px-5 py-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => {
                        const isSelf = u.id === currentUserId
                        return (
                          <tr key={u.id} className="border-b border-[#f0ede6] last:border-0">
                            <td className="px-5 py-4">
                              <span className="flex items-center gap-2 font-medium text-[#1d1d1b]">
                                {u.full_name || u.email}
                                {isSelf ? (
                                  <span className="rounded-full bg-[#f1eee7] px-2 py-0.5 text-xs font-medium text-[#77746c]">You</span>
                                ) : null}
                              </span>
                              {u.title ? (
                                <span className="mt-0.5 block text-xs text-[#98958c]">{u.title}</span>
                              ) : null}
                            </td>
                            <td className="px-5 py-4 text-[#77746c]">{u.email}</td>
                            <td className="px-5 py-4"><RoleBadge role={u.role} /></td>
                            <td className="px-5 py-4 text-right">
                              {isSelf ? (
                                <span className="text-xs text-[#b1b0ac]" aria-label="This is your account">-</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onRemove(u)}
                                  disabled={removingId === u.id}
                                  aria-label={`Remove ${u.full_name || u.email}`}
                                  className={`inline-flex items-center gap-1.5 rounded-full border border-[#e6e3dc] px-3 py-1.5 text-xs font-medium text-[#9a3b2c] transition-colors hover:border-[#e2b6ac] hover:bg-[#fbe4e0] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                                >
                                  {removingId === u.id ? (
                                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                                  ) : (
                                    <Trash2 className="size-3.5" aria-hidden />
                                  )}
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <ul className="space-y-3 md:hidden">
                  {users.map((u) => {
                    const isSelf = u.id === currentUserId
                    return (
                      <li key={u.id} className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-medium text-[#1d1d1b]">
                              <span className="truncate">{u.full_name || u.email}</span>
                              {isSelf ? (
                                <span className="shrink-0 rounded-full bg-[#f1eee7] px-2 py-0.5 text-xs font-medium text-[#77746c]">You</span>
                              ) : null}
                            </p>
                            {u.title ? (
                              <p className="mt-0.5 truncate text-xs text-[#98958c]">{u.title}</p>
                            ) : null}
                            <p className="mt-1 flex items-center gap-1.5 text-sm text-[#77746c]">
                              <Mail className="size-3.5 shrink-0 text-[#b1b0ac]" aria-hidden />
                              <span className="truncate">{u.email}</span>
                            </p>
                          </div>
                          <RoleBadge role={u.role} />
                        </div>
                        {!isSelf ? (
                          <button
                            type="button"
                            onClick={() => onRemove(u)}
                            disabled={removingId === u.id}
                            aria-label={`Remove ${u.full_name || u.email}`}
                            className={`mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#e6e3dc] px-3 py-1.5 text-xs font-medium text-[#9a3b2c] transition-colors hover:border-[#e2b6ac] hover:bg-[#fbe4e0] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                          >
                            {removingId === u.id ? (
                              <Loader2 className="size-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="size-3.5" aria-hidden />
                            )}
                            Remove
                          </button>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}

            {/* Role note */}
            <p className="flex items-start gap-2 rounded-xl border border-[#eae7df] bg-[#faf8f3] px-4 py-3 text-xs leading-relaxed text-[#77746c]">
              <Info className="mt-0.5 size-3.5 shrink-0 text-[#b1b0ac]" aria-hidden />
              Roles are set when a member is created and can&rsquo;t be edited here; there&rsquo;s no
              role-change endpoint. To move someone to a different role, remove them and add them
              again with the new role.
            </p>
          </section>
        </>
      )}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border border-[#e6e3dc] bg-[#f1efe8]" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl border border-[#e6e3dc] bg-[#f1efe8]" />
      <div className="h-40 animate-pulse rounded-2xl border border-[#e6e3dc] bg-[#f1efe8]" />
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-10 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-full bg-[#fbe4e0] text-[#9a3b2c]">
        <AlertCircle className="size-5" aria-hidden />
      </span>
      <p className="mt-4 text-sm font-medium text-[#1d1d1b]">We couldn&rsquo;t load your members.</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[#98958c]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className={`mt-5 inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#3c3b37] ${focusRing}`}
      >
        Try again
      </button>
    </div>
  )
}
