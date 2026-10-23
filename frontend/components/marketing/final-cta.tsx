import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { Reveal } from '@/components/reveal'

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[#151412] text-[#f3efe5]" aria-labelledby="cta-heading">
      <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 opacity-[0.1]" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-1/2 size-[34rem] -translate-y-1/2 rounded-full border border-white/10"
      >
        <div className="absolute inset-10 rounded-full border border-white/10" />
        <div className="absolute inset-24 rounded-full border border-[#d9a75f]/25" />
        <div className="absolute inset-[8.5rem] grid place-items-center rounded-full bg-[#d9a75f]/10">
          <div className="size-3 rounded-full bg-[#d9a75f]" />
        </div>
      </div>

      <div className="container-page relative py-20 sm:py-24">
        <Reveal>
          <div className="max-w-2xl">
            <p className="eyebrow text-[#d9a75f]">Ready when your team is</p>
            <h2 id="cta-heading" className="display-lg mt-5">
              Put the right knowledge
              <br />
              in <span className="serif text-[#d9a75f]">the right hands.</span>
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-relaxed text-[#f3efe5]/55">
              Start with a registered organization. Employees and admins use the same secure entry
              point, with permissions set by the company.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/enterprise?tab=create"
                className="btn bg-[#f3efe5] text-[#171511] hover:bg-[#d9a75f] hover:text-[#1a1205]"
              >
                Create your organization <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/enterprise?role=employee"
                className="btn border border-white/20 text-[#f3efe5] hover:border-white/40 hover:bg-white/5"
              >
                Sign in to a workspace
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[#f3efe5]/40">
              {['Free tier available', 'No card required', 'Cancel anytime'].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <Check className="size-3 text-[#d9a75f]" aria-hidden /> {item}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export default FinalCta
