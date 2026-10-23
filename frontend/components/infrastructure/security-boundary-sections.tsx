import Link from 'next/link'
import { ArrowRight, Check, Cloud, Eye, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Reveal } from '@/components/reveal'

const CONTROLS = [
  {
    icon: LockKeyhole,
    title: 'Origins are explicit',
    body: 'The browser calls only the configured API origin. Django CORS and CSRF trust are limited to the OpenVault frontend domain.',
  },
  {
    icon: KeyRound,
    title: 'Secrets stay server-side',
    body: 'Bedrock and SMTP credentials belong in Render secret environment variables—not in Amplify build variables or browser code.',
  },
  {
    icon: ShieldCheck,
    title: 'Permissions before AI',
    body: 'Tenant and document permissions are checked before retrieval, so unauthorized passages are not sent to the model.',
  },
  {
    icon: Eye,
    title: 'Operations stay visible',
    body: 'Review product audit history, Amplify build logs, Render API health/logs, and AWS Bedrock spend alerts.',
  },
]

const BOUNDARY = [
  'Static frontend delivery uses AWS Amplify/CloudFront; Cloudflare provides DNS for the custom domains.',
  'Django API, PostgreSQL, and the document disk are hosted in Render’s Singapore region.',
  'Bedrock chat uses the India inference profile; only permission-approved passages are sent over TLS.',
  'This is not an all-data-in-India deployment: stored app data is in Singapore while model inference is in AWS India.',
]

export function SecurityControlsSection() {
  return (
    <section
      className="border-y border-border bg-surface/35 py-20 sm:py-24"
      aria-labelledby="controls-title"
    >
      <div className="container-page">
        <Reveal>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <p className="eyebrow">Security</p>
              <h2 id="controls-title" className="display-lg mt-5">
                The controls are
                <br />
                <span className="serif text-accent">the architecture.</span>
              </h2>
            </div>
            <Link href="/policy" className="link-arrow lg:pb-1">
              Read the product security model <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {CONTROLS.map(({ icon: Icon, title, body }, index) => (
            <Reveal key={title} delay={(index % 4) * 55}>
              <article className="border-t border-border pt-5">
                <div className="flex items-center justify-between">
                  <span className="grid size-8 place-items-center rounded-full border border-border text-accent">
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-5 text-[14px] font-medium tracking-[-0.02em]">{title}</h3>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export function DataBoundarySection() {
  return (
    <section className="container-page py-20 sm:py-24" aria-labelledby="boundary-title">
      <Reveal>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <p className="eyebrow">Data boundary</p>
            <h2 id="boundary-title" className="display-lg mt-5">
              Know where
              <br />
              <span className="serif text-accent">the data sits.</span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
              The current launch is a hybrid deployment. The app database, files, and model calls
              have different providers and regions; the distinction should be explicit.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
              <p className="flex items-center gap-2 text-[11px] font-medium">
                <Cloud className="size-3.5 text-accent" aria-hidden />
                  Launch data boundary
              </p>
              <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[9px] text-muted-foreground">
                Hybrid
              </span>
            </div>
            <ul className="mt-5 flex flex-col gap-4">
              {BOUNDARY.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                    <Check className="size-3" aria-hidden />
                  </span>
                  <span className="text-[12px] leading-relaxed text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-border bg-background/60 p-4">
              <LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
              <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                  Organizations can keep using a local model or another supported cloud provider.
                  For a strict India-only data-at-rest requirement, this Render-backed launch
                  topology must be changed before making that claim.
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
