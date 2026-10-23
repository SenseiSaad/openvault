import { BrainCircuit, Database, Eye, Globe2, Server } from 'lucide-react'
import { Reveal } from '@/components/reveal'

const PLANES = [
  {
    index: '01',
    title: 'Web delivery',
    icon: Globe2,
    purpose:
      'Cloudflare manages DNS while Amplify builds and serves the static Next.js frontend through AWS edge delivery.',
    services: ['Cloudflare DNS', 'AWS Amplify Hosting', 'CloudFront CDN', 'HTTPS'],
  },
  {
    index: '02',
    title: 'API',
    icon: Server,
    purpose:
      'Run Django and Gunicorn as a separate Render web service at `api.saadops.site`, with a public health endpoint and independent deploys.',
    services: ['Render Web Service', 'Django + Gunicorn', 'HTTPS custom domain', 'Health checks'],
  },
  {
    index: '03',
    title: 'Data',
    icon: Database,
    purpose:
      'Store company records in Render PostgreSQL and keep uploaded documents/generated forms on a mounted persistent disk for the single-instance launch.',
    services: ['Render PostgreSQL', 'Persistent disk', 'Render backups', 'Restore checks'],
  },
  {
    index: '04',
    title: 'Intelligence',
    icon: BrainCircuit,
    purpose:
      'Send only permission-approved passages over TLS to Amazon Bedrock’s India inference profile, then return a cited answer.',
    services: ['Amazon Bedrock', 'Claude Haiku 4.5', 'Titan Text Embeddings V2'],
  },
  {
    index: '05',
    title: 'Operations',
    icon: Eye,
    purpose:
      'Use provider deployment history, Render health/logs, database and disk recovery features, plus AWS budget alerts for Bedrock usage.',
    services: ['Amplify build history', 'Render logs', 'AWS Budgets', 'Amazon SES'],
  },
]

export function BlueprintSection() {
  return (
    <section
      id="blueprint"
      className="scroll-mt-24 border-y border-border bg-surface/35 py-20 sm:py-24"
      aria-labelledby="blueprint-title"
    >
      <div className="container-page">
        <Reveal>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <p className="eyebrow">The launch stack</p>
              <h2 id="blueprint-title" className="display-lg mt-5">
                One product.
                <br />
                <span className="serif text-accent">Clear boundaries.</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground lg:pb-1">
              Cloudflare handles DNS, Amplify serves the web client, Render runs the stateful API,
              and Bedrock supplies managed AI. Each provider has a defined job.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 overflow-hidden rounded-xl border border-border bg-surface">
          {PLANES.map(({ index, title, icon: Icon, purpose, services }, planeIndex) => (
            <Reveal key={title} delay={planeIndex * 45}>
              <article className="grid gap-4 border-b border-border p-5 last:border-b-0 sm:grid-cols-[8rem_1fr] sm:gap-8 sm:p-7 lg:grid-cols-[10rem_1fr] lg:p-8">
                <div>
                  <div className="flex items-center gap-2">
                    <Icon className="size-3.5 text-accent" aria-hidden />
                    <span className="font-mono text-[9px] text-accent">{index}</span>
                  </div>
                  <h3 className="mt-3 text-[1.1rem] font-medium tracking-[-0.025em]">{title}</h3>
                </div>
                <div>
                  <p className="max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
                    {purpose}
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`${title} services`}>
                    {services.map((service) => (
                      <li
                        key={service}
                        className="rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground"
                      >
                        {service}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="mt-5 max-w-3xl text-[10.5px] leading-relaxed text-muted-foreground">
            This is the selected small-scale launch topology, not an AWS-only architecture. Render
            persistent disks are single-instance and prevent horizontal scaling; move documents to
            shared object storage before adding API replicas.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
