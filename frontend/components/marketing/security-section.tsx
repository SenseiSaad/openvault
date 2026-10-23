import Link from 'next/link'
import { ArrowRight, Building2, Calculator, KeyRound, Scale, Server, ShieldCheck, Users } from 'lucide-react'
import { Reveal } from '@/components/reveal'

const ROLES = [
  {
    icon: Calculator,
    role: 'Finance & audit',
    title: 'Close with evidence, not screenshots.',
    body: 'Every answer points back to a source document, a page, and the permission that allowed it.',
  },
  {
    icon: Users,
    role: 'People operations',
    title: 'Protect the file inside the everyday answer.',
    body: 'An HR policy can be company-wide while a compensation file stays named-person only.',
  },
  {
    icon: Scale,
    role: 'Legal',
    title: 'Share one exhibit with one recipient.',
    body: 'Partner access is one document, one registered employee, revocable the moment the matter closes.',
  },
  {
    icon: Server,
    role: 'IT & security',
    title: 'Keep retrieval inside your boundary.',
    body: 'Run local models with Ollama, or use a cloud provider with your own encrypted key.',
  },
]

const CONTROLS = [
  { icon: ShieldCheck, label: 'Tenant-isolated retrieval' },
  { icon: KeyRound, label: 'HttpOnly rotating sessions' },
  { icon: Building2, label: 'Five-character partner codes' },
  { icon: Server, label: 'Local AI or bring your own key' },
]

export function SecuritySection() {
  return (
    <section
      id="security"
      className="scroll-mt-24 border-y border-border bg-surface/35 py-20 sm:py-24 lg:py-28"
      aria-labelledby="security-heading"
    >
      <div className="container-page">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <Reveal>
            <div>
              <p className="eyebrow">The principle</p>
              <h2 id="security-heading" className="display-lg mt-5">
                The AI should never know more than
                <span className="serif text-accent"> the person asking.</span>
              </h2>
              <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
                Permission filtering happens before retrieval, not after generation. A restricted
                document is not hidden in the interface — it is absent from the evidence the model
                ever receives.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                {CONTROLS.map(({ icon: Icon, label }) => (
                  <p key={label} className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Icon className="size-3.5 shrink-0 text-accent" aria-hidden />
                    {label}
                  </p>
                ))}
              </div>

              <Link href="/policy" className="link-arrow mt-8">
                Read the security model <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div>
              <div className="flex items-center justify-between border-b border-border pb-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  For the people who have to be sure
                </p>
                <span className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground sm:inline-flex">
                  <span className="pulse-dot size-1.5 rounded-full bg-accent" aria-hidden />
                  Zero-trust by default
                </span>
              </div>

              <div className="grid gap-x-10 gap-y-7 pt-7 sm:grid-cols-2">
                {ROLES.map(({ icon: Icon, role, title, body }) => (
                  <article key={role}>
                    <div className="flex items-center gap-2">
                      <Icon className="size-3.5 text-accent" aria-hidden />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">{role}</p>
                    </div>
                    <h3 className="mt-3 text-[15px] font-medium leading-snug tracking-[-0.02em]">{title}</h3>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>
                  </article>
                ))}
              </div>

              <div className="mt-9 flex items-center gap-3 rounded-xl border border-border bg-background/50 p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <ShieldCheck className="size-4" aria-hidden />
                </span>
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                  Built for CPA and assurance workflows: controlled ownership, least-privilege
                  access, and an immutable activity trail.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

export default SecuritySection
