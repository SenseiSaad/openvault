import { Fragment } from 'react'
import { ArrowDown, ArrowRight, ShieldCheck } from 'lucide-react'
import type { AwsLayer } from './aws-infrastructure-data'

export function AwsInfrastructurePanel({ layer }: { layer: AwsLayer }) {
  const LayerIcon = layer.icon

  return (
    <div
      role="tabpanel"
      id={`aws-panel-${layer.id}`}
      aria-labelledby={`aws-tab-${layer.id}`}
      tabIndex={0}
      className="animate-fade-in p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d9a75f]/60 sm:p-7 lg:p-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#d9a75f]">
            Layer {layer.index} / {layer.label}
          </p>
          <h3 className="mt-3 text-[1.35rem] font-medium leading-tight tracking-[-0.035em] sm:text-[1.55rem]">
            {layer.title}
          </h3>
          <p className="mt-3 text-[12.5px] leading-relaxed text-[#f3efe5]/52">{layer.body}</p>
        </div>
        <span className="hidden size-11 shrink-0 place-items-center rounded-full border border-[#d9a75f]/30 bg-[#d9a75f]/10 text-[#d9a75f] sm:grid">
          <LayerIcon className="size-5" aria-hidden />
        </span>
      </div>

      <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        {layer.nodes.map((node, index) => {
          const Icon = node.icon
          return (
            <Fragment key={node.label}>
              <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.035] p-3">
                <div className="flex items-center gap-2">
                  <Icon className="size-3.5 shrink-0 text-[#d9a75f]" aria-hidden />
                  <p className="truncate text-[11px] font-medium text-[#f3efe5]/90">{node.label}</p>
                </div>
                <p className="mt-1.5 text-[9.5px] leading-snug text-[#f3efe5]/35">{node.detail}</p>
              </div>
              {index < layer.nodes.length - 1 && (
                <>
                  <ArrowDown
                    className="mx-auto size-3.5 shrink-0 text-[#d9a75f]/40 sm:hidden"
                    aria-hidden
                  />
                  <ArrowRight
                    className="hidden size-3.5 shrink-0 self-center text-[#d9a75f]/40 sm:block"
                    aria-hidden
                  />
                </>
              )}
            </Fragment>
          )
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {layer.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[9.5px] text-[#f3efe5]/50"
          >
            <span className="size-1 rounded-full bg-[#d9a75f]/70" aria-hidden />
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-[#d9a75f]/20 bg-[#d9a75f]/[0.06] p-3.5">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#d9a75f]" aria-hidden />
        <p className="text-[10.5px] leading-relaxed text-[#f3efe5]/48">{layer.note}</p>
      </div>
    </div>
  )
}
