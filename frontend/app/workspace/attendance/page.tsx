'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Loader2,
  QrCode,
  ShieldAlert,
  Snowflake,
} from 'lucide-react'
import { attendanceApi, type AttendanceMe, type AttendanceQr } from '@/lib/api'
import { useAuth } from '@/lib/auth'

const eyebrow = 'text-xs font-semibold uppercase tracking-[0.16em] text-[#6b6862]'
const card = 'rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-6'
const ghostBtn =
  'inline-flex items-center justify-center gap-2 rounded-full border border-[#dcdad3] bg-[#fffdfa] px-4 py-2 text-sm text-[#1d1d1b] transition-colors hover:border-[#1d1d1b] disabled:cursor-not-allowed disabled:opacity-60'

function fmtDate(iso: string) {
  // iso is YYYY-MM-DD (local date from the server)
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function fmtTime(iso: string) {
  const dt = new Date(iso)
  return Number.isNaN(dt.getTime())
    ? ''
    : dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

// Feature 5 — QR-based web attendance + the rolling 3-strike discipline view.
// Scanning the workplace QR opens this page with ?scan=1, which auto-marks the
// signed-in user present; it can also be done manually with the button.
export default function AttendancePage() {
  const { user } = useAuth()
  const [data, setData] = useState<AttendanceMe | null>(null)
  const [qr, setQr] = useState<AttendanceQr | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [scanError, setScanError] = useState('')
  const autoRan = useRef(false)

  const load = useCallback(() => {
    setLoading(true)
    setLoadError('')
    Promise.all([attendanceApi.me(), attendanceApi.qr().catch(() => null)])
      .then(([me, q]) => {
        setData(me)
        setQr(q)
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load attendance.'))
      .finally(() => setLoading(false))
  }, [])

  const scan = useCallback(async () => {
    setScanning(true)
    setScanError('')
    setScanMsg('')
    try {
      await attendanceApi.scan()
      setScanMsg('You are marked present for today.')
      const me = await attendanceApi.me()
      setData(me)
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Could not mark attendance.')
    } finally {
      setScanning(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Honor the QR deep-link: /workspace/attendance?scan=1 auto-marks once.
  useEffect(() => {
    if (autoRan.current || typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('scan') === '1') {
      autoRan.current = true
      scan()
    }
  }, [scan])

  if (!user) return null

  const frozen = !!data?.strike?.is_frozen
  const markedToday = !!data?.marked_today

  return (
    <div className="pb-6">
      <header className="border-b border-[#e6e3dc] pb-8">
        <p className={eyebrow}>Workplace attendance</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl sm:tracking-[-0.06em]">
          Scan in <span className="font-serif font-normal italic">for the day.</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#6b6862]">
          Mark your daily attendance by scanning the workplace QR code, or tap the button below. Your
          monthly absences and discipline strikes are shown so there are no surprises.
        </p>
      </header>

      {loading ? (
        <span className="mt-8 flex items-center gap-2 text-sm text-[#6b6862]">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading attendance…
        </span>
      ) : loadError ? (
        <div role="alert" className="mt-8 rounded-3xl border border-[#e6c9c1] bg-[#fbe4e0] p-10 text-center">
          <AlertCircle className="mx-auto size-6 text-[#9a3b2c]" aria-hidden />
          <p className="mt-3 text-sm font-medium text-[#9a3b2c]">{loadError}</p>
          <button type="button" onClick={load} className={`mt-5 ${ghostBtn}`}>Try again</button>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {frozen && (
            <div role="alert" className="flex items-start gap-3 rounded-3xl border border-[#e6c9c1] bg-[#fbe4e0] p-5 text-[#9a3b2c]">
              <Snowflake className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <p className="text-sm font-semibold">Your account is frozen.</p>
                <p className="mt-1 text-sm leading-relaxed">
                  You reached the attendance strike limit. Please contact your administrator to restore access.
                </p>
              </div>
            </div>
          )}

          {/* Today + mark-present */}
          <section className={card}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={eyebrow}>Today</p>
                <p className="mt-2 text-xl font-semibold text-[#1d1d1b]">{data ? fmtDate(data.today) : ''}</p>
                <div className="mt-2">
                  {markedToday ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e4f0e4] px-3 py-1 text-xs font-medium text-[#2f5b36]">
                      <CheckCircle2 className="size-3.5" aria-hidden /> Present — you&apos;re all set
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2efe8] px-3 py-1 text-xs font-medium text-[#6b6862]">
                      <Clock className="size-3.5" aria-hidden /> Not marked yet
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={scan}
                disabled={scanning || markedToday || frozen}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#3c3b37] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scanning ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CalendarCheck className="size-4" aria-hidden />}
                {markedToday ? 'Already marked' : scanning ? 'Marking…' : 'Mark me present'}
              </button>
            </div>
            {scanMsg && (
              <p className="mt-4 flex items-center gap-1.5 text-sm text-[#2f5b36]">
                <CheckCircle2 className="size-4" aria-hidden /> {scanMsg}
              </p>
            )}
            {scanError && (
              <p className="mt-4 flex items-center gap-1.5 text-sm text-[#9a3b2c]">
                <AlertCircle className="size-4" aria-hidden /> {scanError}
              </p>
            )}
          </section>

          {/* Discipline stats */}
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Absences this month" value={data?.absences_this_month ?? 0} tone={(data?.absences_this_month ?? 0) >= 3 ? 'warn' : 'neutral'} />
            <StatCard label="Discipline strikes" value={data?.strike?.strikes ?? 0} tone={(data?.strike?.strikes ?? 0) > 0 ? 'warn' : 'neutral'} />
            <StatCard label="Account status" value={frozen ? 'Frozen' : 'Active'} tone={frozen ? 'bad' : 'good'} />
          </section>

          <p className="flex items-start gap-2 text-xs leading-relaxed text-[#6b6862]">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Three or more absences in a month add one strike. Reaching three strikes freezes the account until an administrator restores it.
          </p>

          {/* QR + recent history */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={card}>
              <div className="flex items-center gap-2">
                <QrCode className="size-4 text-[#1d1d1b]" aria-hidden />
                <h2 className="text-sm font-semibold text-[#1d1d1b]">Workplace QR code</h2>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#6b6862]">
                Print or display this at the entrance. Scanning it opens this page and marks the signed-in employee present.
              </p>
              <div className="mt-4 grid place-items-center rounded-2xl border border-[#e6e3dc] bg-white p-5">
                {qr?.qr_available && qr.svg ? (
                  <div
                    className="h-44 w-44 [&>svg]:h-full [&>svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: qr.svg }}
                  />
                ) : (
                  <div className="text-center">
                    <QrCode className="mx-auto size-10 text-[#b9b6ae]" aria-hidden />
                    <p className="mt-2 text-xs text-[#6b6862]">QR image unavailable. Use the link below.</p>
                  </div>
                )}
              </div>
              {qr?.target && (
                <a href={qr.target} className="mt-3 block truncate text-center text-xs text-[#3c5a8a] underline" title={qr.target}>
                  {qr.target}
                </a>
              )}
            </section>

            <section className={card}>
              <h2 className="text-sm font-semibold text-[#1d1d1b]">Recent attendance</h2>
              {data && data.records.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {data.records.slice(0, 12).map((r) => (
                    <li key={r.id} className="flex items-center justify-between rounded-xl bg-[#f7f6f2] px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 text-[#1d1d1b]">
                        <CheckCircle2 className="size-3.5 text-[#2f5b36]" aria-hidden />
                        {fmtDate(r.date)}
                      </span>
                      <span className="text-xs text-[#6b6862]">
                        {r.status}
                        {fmtTime(r.scanned_at) ? ` · ${fmtTime(r.scanned_at)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-[#6b6862]">No attendance recorded yet. Mark your first day above.</p>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone: 'neutral' | 'good' | 'warn' | 'bad'
}) {
  const toneCls =
    tone === 'good'
      ? 'text-[#2f5b36]'
      : tone === 'warn'
      ? 'text-[#8a6516]'
      : tone === 'bad'
      ? 'text-[#9a3b2c]'
      : 'text-[#1d1d1b]'
  return (
    <div className="rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-[#6b6862]">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneCls}`}>{value}</p>
    </div>
  )
}

