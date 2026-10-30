'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { Cloud, ShieldCheck } from 'lucide-react'
import { AWS_LAYERS } from './aws-infrastructure-data'
import { AwsInfrastructurePanel } from './aws-infrastructure-panel'

export function AwsControlRoom() {
  const [active, setActive] = useState(0)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const layer = AWS_LAYERS[active]

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (index + 1) % AWS_LAYERS.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (index - 1 + AWS_LAYERS.length) % AWS_LAYERS.length
    } else if (event.key === 'Home') {
      next = 0
    } else if (event.key === 'End') {
      next = AWS_LAYERS.length - 1
    } else {
      return
    }
    event.preventDefault()
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#151412] text-[#f3efe5] shadow-[0_30px_80px_-50px_rgba(20,18,14,0.7)]">
      <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-full border border-white/15 bg-white/[0.04] text-[#d9a75f]">
            <Cloud className="size-3.5" aria-hidden />
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f3efe5]/70">
            Production target · AWS
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[9.5px] uppercase tracking-[0.13em] text-[#f3efe5]/40">
          <span className="inline-flex items-center gap-1.5">
            <span className="pulse-dot size-1.5 rounded-full bg-[#7fb889]" aria-hidden />
            Amplify · live web
          </span>
          <span>Bedrock · AI target</span>
          <span>AWS · final product</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[16.5rem_1fr]">
        <div className="border-b border-white/10 p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <div
            role="tablist"
            aria-label="AWS infrastructure layers"
            aria-orientation="vertical"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1"
          >
            {AWS_LAYERS.map((item, index) => {
              const Icon = item.icon
              const selected = active === index
              return (
                <button
                  key={item.id}
                  ref={(node) => {
                    tabRefs.current[index] = node
                  }}
                  type="button"
                  role="tab"
                  id={`aws-tab-${item.id}`}
                  aria-selected={selected}
                  aria-controls={`aws-panel-${item.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(index)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  className={`group flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    selected
                      ? 'border-[#d9a75f]/55 bg-[#d9a75f]/10 text-[#f3efe5]'
                      : 'border-transparent text-[#f3efe5]/45 hover:border-white/10 hover:bg-white/[0.035] hover:text-[#f3efe5]/80'
                  }`}
                >
                  <Icon
                    className={`size-3.5 shrink-0 ${selected ? 'text-[#d9a75f]' : 'text-[#f3efe5]/35'}`}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block font-mono text-[8.5px] tracking-[0.12em] text-[#d9a75f]/75">
                      {item.index}
                    </span>
                    <span className="block text-[12px] font-medium">{item.label}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-6 hidden border-t border-white/10 pt-5 lg:block">
            <p className="text-[10px] leading-relaxed text-[#f3efe5]/35">
              Amplify is live today. Bedrock, ECS, RDS and S3 are the production target; the beta
              may use supporting test services outside AWS. The access model is unchanged.
            </p>
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] text-[#f3efe5]/45">
              <ShieldCheck className="size-3 text-[#d9a75f]" aria-hidden />
              Target architecture
            </p>
          </div>
        </div>

        <AwsInfrastructurePanel key={layer.id} layer={layer} />
      </div>
    </div>
  )
}
