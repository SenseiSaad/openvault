import { Database, Server } from 'lucide-react'
import { Reveal } from '@/components/reveal'

const FAILURES = [
  {
    icon: Server,
    title: 'The frontend and API deploy separately.',
    body: 'Amplify can roll back the static frontend independently from Render. If the API is unavailable, public pages can still load, but authenticated product actions wait for the API.',
  },
  {
    icon: Server,
    title: 'A Render deploy needs care.',
    body: 'The launch API uses one instance with a persistent disk. Render disk-backed services do not provide zero-downtime deploys or horizontal scaling; schedule changes and keep a rollback/restore procedure.',
  },
  {
    icon: Database,
    title: 'Data needs to come back.',
    body: 'Use Render PostgreSQL backups and persistent-disk snapshots, and test a restore before inviting users. Keep a separate export of critical records and documents.',
  },
]

export function ResilienceSection() {
  return (
    <section className="container-page py-20 sm:py-24" aria-labelledby="failure-title">
      <Reveal>
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="eyebrow">Resilience</p>
            <h2 id="failure-title" className="display-lg mt-5">
              Built for
              <br />
              <span className="serif text-accent">the boring failures.</span>
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              This is a lean launch topology, not a multi-AZ guarantee. The operating plan is to
              protect data, monitor the API, and move to shared object storage before adding replicas.
            </p>
          </div>

          <div>
            {FAILURES.map(({ icon: Icon, title, body }, index) => (
              <Reveal key={title} delay={index * 60}>
                <article className="grid gap-3 border-t border-border py-6 sm:grid-cols-[2.5rem_1fr] sm:gap-5">
                  <span className="grid size-8 place-items-center rounded-full border border-border text-accent">
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-medium tracking-[-0.02em]">{title}</h3>
                    <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-muted-foreground">
                      {body}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  )
}
