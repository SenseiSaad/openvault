'use client'

import { useRef, useState } from 'react'
import { ArrowUp, Check, FileText, LockKeyhole, Search, ShieldCheck } from 'lucide-react'

type Demo = {
  label: string
  question: string
  answer: string
  citation: { name: string; meta: string }
  stats: string
}

const DEMOS: Demo[] = [
  {
    label: 'People policy',
    question: 'How many paid leave days do we offer?',
    answer:
      'Full-time employees receive 20 paid leave days each calendar year. Requests should be submitted at least five working days in advance through HR.',
    citation: { name: 'Employee Handbook 2026.pdf', meta: 'p. 18 · indexed 2 days ago' },
    stats: '8 documents searched · 3 passed the permission filter',
  },
  {
    label: 'Finance',
    question: 'What are the payment terms in the Acme contract?',
    answer:
      'The Acme vendor agreement uses net-30 terms from invoice receipt, with a 2% discount when paid within ten days. Renewal is automatic unless either party gives 30 days notice.',
    citation: { name: 'Vendor Agreement — Acme.pdf', meta: 'p. 4 · version 3' },
    stats: '3 documents in scope · 1 restricted file excluded',
  },
  {
    label: 'Security',
    question: 'Who can access the incident response plan?',
    answer:
      'The incident response plan is restricted to the Security and Executive teams. Seven named people currently hold access, and every view is recorded in the audit trail.',
    citation: { name: 'Incident Response Plan v3.pdf', meta: 'p. 2 · restricted document' },
    stats: '1 document in scope · 4 files outside your access',
  },
]

export function HeroDemo() {
  const [active, setActive] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const demo = DEMOS[active]

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = DEMOS.length - 1
    let next = index
    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    else return
    event.preventDefault()
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="relative mx-auto w-full max-w-[33rem] lg:mx-0">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-12 -z-10 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(217,167,95,0.16),transparent_68%)] blur-2xl"
      />

      <div className="relative rounded-[1.5rem] border border-white/10 bg-[#131210] p-1.5 shadow-[0_32px_80px_-28px_rgba(20,17,12,0.6)] ring-1 ring-white/10">
        <div className="overflow-hidden rounded-[1.15rem] border border-white/10 bg-[#1b1916]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-full border border-[#d9a75f]/35 bg-[#d9a75f]/10 text-[#d9a75f]">
                <ShieldCheck className="size-3" aria-hidden />
              </span>
              <span className="text-[12px] font-medium text-white/85">OpenVault</span>
              <span className="text-[11px] text-white/25">/</span>
              <span className="text-[11px] text-white/45">Vault console</span>
            </div>
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/30">Session · private</span>
          </div>

          <div className="px-4 pt-4 sm:px-5">
            <div role="tablist" aria-label="Sample questions" className="flex gap-5 border-b border-white/10">
              {DEMOS.map((item, index) => (
                <button
                  key={item.label}
                  ref={(node) => { tabRefs.current[index] = node }}
                  role="tab"
                  type="button"
                  aria-selected={active === index}
                  aria-controls="hero-demo-panel"
                  tabIndex={active === index ? 0 : -1}
                  onClick={() => setActive(index)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  className={`-mb-px border-b pb-2.5 text-[10.5px] font-medium tracking-[0.01em] transition-colors ${
                    active === index
                      ? 'border-[#d9a75f] text-[#f3efe5]'
                      : 'border-transparent text-white/35 hover:text-white/65'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div id="hero-demo-panel" role="tabpanel" key={active} className="animate-fade-in pb-4 pt-5">
              <p className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-white/30">Question</p>
              <div className="mt-2.5 flex items-start gap-2.5">
                <Search className="mt-0.5 size-3.5 shrink-0 text-[#d9a75f]" aria-hidden />
                <p className="text-[13.5px] font-medium leading-snug text-white/85">{demo.question}</p>
              </div>

              <div className="mt-5 border-l border-[#d9a75f]/55 pl-3.5">
                <p className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-[#d9a75f]/80">
                  Answer · source verified
                </p>
                <p className="mt-2 text-[12.5px] leading-[1.7] text-white/65">{demo.answer}</p>
              </div>

              <div className="mt-5 flex items-center gap-2.5 border-y border-white/10 py-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-md border border-white/10 bg-white/5 text-[#d9a75f]">
                  <FileText className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-white/75">{demo.citation.name}</p>
                  <p className="mt-0.5 truncate text-[9.5px] text-white/35">{demo.citation.meta}</p>
                </div>
                <span className="shrink-0 rounded-[3px] border border-[#9cc7a3]/30 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[#9cc7a3]">
                  Permitted
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] text-white/35">
                <span className="inline-flex items-center gap-1">
                  <Check className="size-2.5 text-[#9cc7a3]" aria-hidden /> {demo.stats}
                </span>
                <span className="hidden sm:inline">·</span>
                <span>No restricted content used</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-white/10 bg-white/[0.02] px-4 py-3 sm:px-5">
            <span className="flex-1 text-[10.5px] text-white/30">Ask a follow-up…</span>
            <span className="grid size-6 place-items-center rounded-full bg-[#d9a75f] text-[#1a1205]">
              <ArrowUp className="size-3" aria-hidden />
            </span>
          </div>
        </div>
      </div>

      {/* Fixed colours keep these legible in both themes. */}
      <div className="float-slow absolute -right-3 -top-12 hidden w-[11.25rem] rounded-xl border border-black/10 bg-[#f3efe5] p-3 shadow-xl shadow-black/20 sm:block">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-full bg-[#346741]/10 text-[#346741]">
            <Check className="size-3" aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-semibold text-[#1b1a17]">Access granted</p>
            <p className="text-[9px] text-[#5e5a51]">People Ops · 3 people</p>
          </div>
        </div>
      </div>

      <div className="float-slower absolute -bottom-14 -left-4 hidden w-[12rem] rounded-xl border border-white/10 bg-[#1a1815] p-3 shadow-xl shadow-black/30 sm:block">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-full bg-[#d9a75f]/10 text-[#d9a75f]">
            <LockKeyhole className="size-3" aria-hidden />
          </span>
          <div>
            <p className="text-[10px] font-semibold text-white/80">Restricted file excluded</p>
            <p className="text-[9px] text-white/35">Not in your scope</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HeroDemo
