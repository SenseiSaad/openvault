import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import {
  ShieldCheck,
  Shield,
  Lock,
  Scale,
  FileText,
  UserCheck,
  Cookie,
  Baby,
  RefreshCw,
  Mail,
  Check,
  X,
  Server,
  Layers,
  ArrowUpRight,
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

export const metadata: Metadata = {
  title: 'Policy & Trust',
  description:
    'How OpenVault protects your data: privacy, security practices, acceptable use, content and copyright, your data rights, cookies, and how to reach us.',
}

const LAST_UPDATED = '26 September 2026'

type SectionMeta = { id: string; n: string; title: string; icon: typeof Shield }

const SECTIONS: SectionMeta[] = [
  { id: 'overview', n: '01', title: 'Our commitment to trust', icon: ShieldCheck },
  { id: 'privacy', n: '02', title: 'Privacy policy', icon: Lock },
  { id: 'security', n: '03', title: 'Security practices', icon: Shield },
  { id: 'acceptable-use', n: '04', title: 'Acceptable use', icon: Scale },
  { id: 'content', n: '05', title: 'Content & copyright', icon: FileText },
  { id: 'data-rights', n: '06', title: 'Your data rights', icon: UserCheck },
  { id: 'cookies', n: '07', title: 'Cookies & local storage', icon: Cookie },
  { id: 'children', n: '08', title: "Children's privacy", icon: Baby },
  { id: 'changes', n: '09', title: 'Changes to this policy', icon: RefreshCw },
  { id: 'contact', n: '10', title: 'Contact us', icon: Mail },
]
const TRUST_CHIPS = [
  { icon: Lock, label: 'Encrypted in transit (HTTPS)' },
  { icon: Layers, label: 'Per-organization data isolation' },
  { icon: Server, label: 'Local, self-hosted AI (Ollama)' },
  { icon: ShieldCheck, label: 'We never sell your data' },
]

const CONTACTS = [
  { icon: Lock, label: 'Privacy & data rights', email: 'privacy@openvault.example' },
  { icon: Shield, label: 'Security & vulnerabilities', email: 'security@openvault.example' },
  { icon: FileText, label: 'Content & takedowns', email: 'abuse@openvault.example' },
]

// Small typographic helpers so the document body keeps a consistent rhythm.
function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-[#3f3e39]">{children}</strong>
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-[15px] leading-7 text-[#5d5b55]">{children}</p>
}
function Lead({ children }: { children: ReactNode }) {
  return <p className="text-[17px] leading-8 text-[#3f3e39]">{children}</p>
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="pt-2 text-base font-semibold text-[#1d1d1b]">{children}</h3>
}

function Yes({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <Check className="mt-1 size-4 shrink-0 text-[#1d1d1b]" aria-hidden />
      <span className="text-[15px] leading-7 text-[#5d5b55]">{children}</span>
    </li>
  )
}

function No({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <X className="mt-1 size-4 shrink-0 text-[#9a3b2c]" aria-hidden />
      <span className="text-[15px] leading-7 text-[#5d5b55]">{children}</span>
    </li>
  )
}
function Section({ id, children }: { id: string; children: ReactNode }) {
  const meta = SECTIONS.find((s) => s.id === id)!
  const Icon = meta.icon
  return (
    <section
      id={id}
      className="scroll-mt-28 border-t border-[#e6e3dc] pt-12 first:border-t-0 first:pt-0"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl border border-[#e6e3dc] bg-[#fffdfa] text-[#5d5b55]">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">
          Section {meta.n}
        </span>
      </div>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#1d1d1b] sm:text-[28px]">
        {meta.title}
      </h2>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  )
}
export default function PolicyPage() {
  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#1d1d1b]">
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-6 pt-8 pb-10 lg:px-10 lg:pt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">
          Policy &amp; Trust
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl sm:tracking-[-0.05em]">
          Your documents, your data,{' '}
          <span className="font-serif font-normal italic">kept in confidence.</span>
        </h1>
        <p className="mt-5 text-sm text-[#77746c]">Last updated: {LAST_UPDATED}</p>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#5d5b55]">
          OpenVault is a knowledge library built for people who take confidentiality seriously:
          individual readers and whole organizations alike. This page explains, in plain
          language, what we collect, how we protect it, what you may do with the service, and
          the rights you keep over your own information.
        </p>
        <ul className="mt-8 flex flex-wrap gap-2.5">
          {TRUST_CHIPS.map((c) => (
            <li
              key={c.label}
              className="inline-flex items-center gap-2 rounded-full border border-[#e6e3dc] bg-[#fffdfa] px-3.5 py-1.5 text-[13px] font-medium text-[#5d5b55]"
            >
              <c.icon className="size-3.5 text-[#1d1d1b]" aria-hidden />
              {c.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-24 lg:px-10">
        <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-14">
          <aside className="mb-12 lg:mb-0">
            <nav aria-label="On this page" className="lg:sticky lg:top-6">
              <p className="px-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">
                On this page
              </p>
              <ol className="mt-3 flex flex-col">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#74726c] transition-colors hover:bg-[#fffdfa] hover:text-[#1d1d1b]"
                    >
                      <span className="w-5 shrink-0 text-xs tabular-nums text-[#98958c] group-hover:text-[#1d1d1b]">
                        {s.n}
                      </span>
                      <span className="leading-snug">{s.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
              <div className="mt-6 rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4">
                <p className="text-[13px] font-semibold text-[#1d1d1b]">Questions about your data?</p>
                <p className="mt-1.5 text-[13px] leading-6 text-[#77746c]">
                  Write to our team and a human will reply.
                </p>
                <a
                  href="mailto:privacy@openvault.example"
                  className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[#1d1d1b] underline underline-offset-4"
                >
                  privacy@openvault.example
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              </div>
            </nav>
          </aside>
          <article className="max-w-3xl">
            <Section id="overview">
              <Lead>
                OpenVault exists to make knowledge easy to find and safe to keep. The same
                platform serves two audiences: individual readers exploring our public library,
                and organizations that store private, sometimes sensitive, documents in a
                workspace only their own people can see.
              </Lead>
              <P>
                Both depend on us getting security and privacy right, so we treat trust as a core
                feature rather than an afterthought. We build around a few firm principles:
                collect the minimum information needed to run the service; keep every
                organization&apos;s private material strictly separated from every other&apos;s;
                process document contents with a local AI model so nothing is shipped to an
                outside provider; and never turn your data into something to be sold or
                advertised against.
              </P>
              <P>
                The sections below set out how those principles work in practice. If anything
                here is unclear, the contact details at the end reach a real person.
              </P>
            </Section>
            <Section id="privacy">
              <P>
                This policy covers personal information handled by OpenVault. For enterprise
                workspaces, your organization is the controller of the documents and member
                records it uploads; OpenVault processes that data on its behalf, under its
                administrator&apos;s direction.
              </P>
              <H3>What we collect</H3>
              <ul className="space-y-3">
                <Yes>
                  <B>Account details.</B> Personal readers create an account with a username and
                  password; no email address is required to browse the public library.
                  Enterprise members join with the work email their organization&apos;s
                  administrator has authorised, which ties the account to the right workspace and
                  role.
                </Yes>
                <Yes>
                  <B>Saved favourites.</B> The documents you mark as favourites, so your reading
                  list is waiting when you return.
                </Yes>
                <Yes>
                  <B>Usage and technical logs.</B> Basic records of how the service is used
                  (including your IP address, timestamps, and the action performed), which power
                  the security audit trail described below and help us diagnose faults.
                </Yes>
              </ul>
              <H3>How we use it</H3>
              <P>
                We use this information to authenticate you and keep you signed in, to sync your
                favourites, to maintain the audit trail that lets organizations see who accessed
                sensitive documents, to keep the platform secure and reliable, and to respond
                when you contact support.
              </P>
              <H3>What we do not do</H3>
              <ul className="space-y-3">
                <No>We do not sell, rent, or trade your personal information to anyone.</No>
                <No>
                  We do not run third-party advertising or build advertising profiles from your
                  reading history.
                </No>
                <No>
                  We do not share the contents of your organization&apos;s private documents
                  outside your workspace, and we do not use them to train external AI models.
                </No>
              </ul>
            </Section>
            <Section id="security">
              <P>
                Security is layered through the whole platform: the network, the data model,
                access control, logging, and the AI itself.
              </P>
              <H3>Encryption in transit</H3>
              <P>
                All traffic between your browser and OpenVault is served over HTTPS, so
                credentials, session tokens, and document contents are encrypted on the wire and
                cannot be read by intermediaries on the network.
              </P>
              <H3>Multi-tenant data isolation</H3>
              <P>
                OpenVault is multi-tenant: each organization is its own tenant, and its private
                documents, members, and audit records are segregated from every other tenant.
                Every request for private material is scoped to the requesting user&apos;s
                organization, so one organization can never read, list, or search
                another&apos;s documents. Public library content is the only material shared
                across accounts.
              </P>
              <H3>Role-based access control</H3>
              <P>
                Within a workspace, what a member can do is governed by their role.
                Administrators manage the organization, its members, and its full document set,
                and can review the audit log. Employees read and contribute to their
                organization&apos;s library. Viewers have read-only access. Individual readers
                only ever see public documents. Permissions are enforced on the server for every
                request, not merely hidden in the interface.
              </P>
              <H3>Comprehensive audit logging</H3>
              <P>
                Sensitive actions (signing in, viewing or downloading a document, publishing or
                removing content, and changes to members or roles) are recorded with the actor,
                a timestamp, and the originating IP address. This gives administrators an
                accountable history of who did what, and helps us investigate anything unusual.
              </P>
              <H3>AI that stays inside your deployment</H3>
              <P>
                The OpenVault assistant runs on a local, self-hosted language model served
                through Ollama within the deployment. Document text used to answer your questions
                is processed on infrastructure we control and is never sent to a third-party AI
                provider. The assistant is driven by a system prompt hardened against prompt
                injection: retrieved document content is treated strictly as reference material
                and cannot override the assistant&apos;s instructions, reveal system
                configuration, or reach across tenant boundaries to data you are not entitled to
                see.
              </P>
            </Section>
            <Section id="acceptable-use">
              <P>
                OpenVault is offered on the understanding that it will be used lawfully and in
                good faith. By using the service you agree to the following.
              </P>
              <H3>Permitted use</H3>
              <ul className="space-y-3">
                <Yes>
                  Reading, searching, and organising documents for research, work, and personal
                  learning.
                </Yes>
                <Yes>
                  Publishing and sharing content you have created or hold the rights to
                  distribute.
                </Yes>
                <Yes>
                  Collaborating with colleagues inside your own organization&apos;s workspace.
                </Yes>
              </ul>
              <H3>Prohibited use</H3>
              <ul className="space-y-3">
                <No>
                  Uploading or distributing unlawful, infringing, or malicious content, including
                  malware.
                </No>
                <No>
                  Attempting to breach tenant isolation, or to access, list, or search another
                  organization&apos;s documents or member data.
                </No>
                <No>
                  Circumventing role-based access controls, authentication, rate limits, or other
                  security measures, including probing, scanning, or reverse-engineering the
                  service to defeat them.
                </No>
                <No>
                  Scraping the library at scale, impersonating others, or using the AI assistant
                  to extract data you are not authorised to see.
                </No>
              </ul>
              <P>
                We may suspend or remove accounts and content that breach these terms, and we
                will cooperate with lawful requests from the authorities where required.
              </P>
            </Section>
            <Section id="content">
              <P>
                OpenVault is a platform for publishing and reading; responsibility for what is
                published rests with the publisher.
              </P>
              <P>
                If you upload or publish a document, you confirm that you own it or otherwise hold
                the rights to share it, and that doing so does not infringe anyone else&apos;s
                copyright, confidentiality, or other rights. Where OpenVault links to or indexes
                externally published material, please respect the terms and copyright of the
                original publisher when reading, downloading, or sharing it.
              </P>
              <H3>Takedown requests</H3>
              <P>
                If you believe content on OpenVault infringes your rights, write to{' '}
                <a
                  href="mailto:abuse@openvault.example"
                  className="font-medium text-[#1d1d1b] underline underline-offset-4"
                >
                  abuse@openvault.example
                </a>{' '}
                with a description of the material, its location on the service, and your
                relationship to the work. We review reports promptly and will remove or restrict
                content found to infringe.
              </P>
            </Section>
            <Section id="data-rights">
              <P>
                You keep meaningful control over the information OpenVault holds about you.
                Depending on where you live you may have these rights by law; we aim to honour
                them for everyone.
              </P>
              <ul className="space-y-3">
                <Yes>
                  <B>Access.</B> Ask what personal information we hold about your account.
                </Yes>
                <Yes>
                  <B>Export.</B> Request a copy of your account details and saved favourites in a
                  portable form.
                </Yes>
                <Yes>
                  <B>Correction.</B> Update inaccurate account information, such as your display
                  name.
                </Yes>
                <Yes>
                  <B>Deletion.</B> Close your account and have the personal information associated
                  with it removed, subject to records we must keep for security or legal reasons.
                </Yes>
              </ul>
              <P>
                If you belong to an enterprise workspace, your organization administers your
                account and is the controller of its workspace data, so some requests (such as
                deletion) may be directed to or actioned by your administrator. We will help
                them respond. To exercise any of these rights, contact us using the details
                below.
              </P>
            </Section>
            <Section id="cookies">
              <P>OpenVault keeps its use of browser storage deliberately minimal.</P>
              <P>
                To keep you signed in, the app stores a session token in your browser&apos;s{' '}
                <B>localStorage</B>. This token is what tells OpenVault that requests are coming
                from you; it stays on your device, is sent only to OpenVault, and is cleared when
                you log out. Without it you would have to sign in again on every page.
              </P>
              <P>
                We do not use third-party advertising cookies, cross-site trackers, or
                behavioural analytics that follow you around the web. Any storage we rely on is
                essential to running the service (remembering your session and preferences)
                rather than to profiling you.
              </P>
            </Section>

            <Section id="children">
              <P>
                OpenVault is intended for adults and for workplace use, and is not directed to
                children. We do not knowingly collect personal information from children under 13,
                or the minimum age of digital consent where you live. If you believe a child
                has provided us with personal information, please contact us and we will delete
                it. Enterprise workspaces are provisioned for an organization&apos;s members in a
                professional context.
              </P>
            </Section>

            <Section id="changes">
              <P>
                We may update this policy as OpenVault evolves or as legal requirements change.
                When we do, we will revise the &ldquo;last updated&rdquo; date at the top of this
                page, and for significant changes we will give a more prominent notice. We
                encourage you to review this page periodically; continuing to use OpenVault after
                an update means you accept the revised policy.
              </P>
            </Section>
            <Section id="contact">
              <P>
                We would rather hear from you than have you wonder. Reach the right team
                directly:
              </P>
              <ul className="grid gap-3 sm:grid-cols-3">
                {CONTACTS.map((c) => (
                  <li key={c.email}>
                    <a
                      href={`mailto:${c.email}`}
                      className="flex h-full flex-col gap-3 rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] p-4 transition-colors hover:border-[#dcdad3]"
                    >
                      <span className="grid size-9 place-items-center rounded-xl border border-[#e6e3dc] text-[#5d5b55]">
                        <c.icon className="size-4" aria-hidden />
                      </span>
                      <span className="text-[13px] font-semibold text-[#1d1d1b]">{c.label}</span>
                      <span className="inline-flex items-center gap-1 text-[13px] text-[#77746c]">
                        {c.email}
                        <ArrowUpRight className="size-3.5" aria-hidden />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <P>
                Prefer one address for everything? Write to{' '}
                <a
                  href="mailto:privacy@openvault.example"
                  className="font-medium text-[#1d1d1b] underline underline-offset-4"
                >
                  privacy@openvault.example
                </a>{' '}
                and we will route your message to the right place.
              </P>
            </Section>
          </article>
        </div>
      </div>

      <SiteFooter />
    </main>
  )
}
