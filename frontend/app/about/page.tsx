'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Bookmark,
  Boxes,
  Building2,
  Cpu,
  Download,
  Eye,
  FileText,
  Globe,
  KeyRound,
  LayoutDashboard,
  Lock,
  Quote,
  Search,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { docsApi, type Category, type Company } from '@/lib/api'

type Feature = { icon: typeof Search; title: string; body: string; tint: string; ink: string }

const WORKS: Feature[] = [
  {
    icon: Search,
    title: 'Discover & search',
    body: 'Search every published document by title, publisher, and topic. Filter by category, sort by newest or most downloaded, and open a clean reading view in a single click.',
    tint: '#dfe7f7',
    ink: '#42618f',
  },
  {
    icon: Building2,
    title: 'Browse by publisher',
    body: 'Every document carries the organization that published it. Follow a publisher you trust and read everything they have chosen to share with the world.',
    tint: '#e7e2ff',
    ink: '#5b4fb0',
  },
  {
    icon: Bookmark,
    title: 'Save favourites',
    body: 'Sign in with a simple username and keep a personal shelf. Favourite anything worth returning to and pick up exactly where you left off, on any device.',
    tint: '#fff0d3',
    ink: '#9a6b1e',
  },
  {
    icon: Download,
    title: 'Download & keep',
    body: 'Published files are yours to take with you. Download the original over an authenticated request. No paywall, no watermark, no catch.',
    tint: '#dcecff',
    ink: '#42618f',
  },
]

const WORKSPACE = [
  { icon: LayoutDashboard, title: 'Dashboard', body: 'A tenant-scoped overview of your library: recent uploads, download activity, and the health of your self-hosted AI at a glance.' },
  { icon: FileText, title: 'Documents', body: 'Upload, organise, and toggle each file between private and published. Editors decide what stays internal and what reaches the public portal.' },
  { icon: Users, title: 'Members', body: 'Admins invite teammates by work email and assign a role. People only ever see the documents and controls their role permits.' },
  { icon: ScrollText, title: 'Audit', body: 'A running trail of sensitive actions (sign-ins, uploads, publishes, downloads, role changes), each stamped with who, what, and when.' },
]

const ROLES = [
  { icon: KeyRound, name: 'Admin', body: 'Full control of the tenant: invite and remove members, set roles, upload and publish documents, and read the complete audit log.' },
  { icon: Upload, name: 'Employee', body: 'The working core of a team: upload new documents, edit descriptions, and publish or unpublish files to the public portal.' },
  { icon: Eye, name: 'Viewer', body: 'Read-only access to everything inside the workspace, with none of the editing or administration controls. Ideal for wider staff.' },
]
const SECURITY = [
  { icon: Boxes, title: 'Tenant isolation', body: 'Every organization gets its own private space. Members only ever query and see their own company’s data; cross-tenant access simply is not possible.', accent: '#b9c6e6' },
  { icon: KeyRound, title: 'Role-based access', body: 'Admin, employee, and viewer roles gate every action. Permissions are enforced on the server for each request, not merely hidden in the interface.', accent: '#c8bfff' },
  { icon: ScrollText, title: 'Audit logging', body: 'Sensitive actions are written to an audit trail, so an admin can always answer who did what, and when, after the fact, with confidence.', accent: '#f0d38f' },
  { icon: Cpu, title: 'Local, private AI', body: 'The language model runs locally on your deployment via Ollama. Document contents are never sent to a third-party API; your knowledge never leaves the building.', accent: '#b9c6e6' },
  { icon: Lock, title: 'Encrypted transport', body: 'Authentication uses signed JWTs, and requests travel over encrypted transport. Tokens gate document downloads and workspace endpoints alike.', accent: '#c8bfff' },
  { icon: ShieldCheck, title: 'Prompt-injection defense', body: 'AI answers run through a hardened system prompt built to resist prompt-injection, so untrusted document text can’t hijack the assistant.', accent: '#f0d38f' },
]

const VALUES = [
  { n: '01', title: 'Open by default, private by choice', body: 'Knowledge meant for the world should be free to read. Knowledge meant for your team should stay with your team. OpenVault refuses to make you choose one or the other.' },
  { n: '02', title: 'Your data does not leave', body: 'We designed the AI layer so document contents are processed on infrastructure you control. A self-hosted model means no silent hand-off of your files to an outside vendor.' },
  { n: '03', title: 'Security you can inspect', body: 'Isolation, roles, and audit logging are not words bolted on at the end; they are structural, enforced on the server, and observable in the trail.' },
  { n: '04', title: 'Reading should feel calm', body: 'A library is only as good as the time you spend in it. We obsess over typography, quiet layouts, and fast search so the content is the loudest thing on the page.' },
  { n: '05', title: 'Free to read, forever', body: 'Anything a publisher chooses to make public stays open to everyone, with no paywall between a curious reader and a document meant to be shared.' },
]
export default function AboutPage() {
  const [companies, setCompanies] = useState<Company[] | null>(null)
  const [categories, setCategories] = useState<Category[] | null>(null)

  useEffect(() => {
    Promise.all([docsApi.companies(), docsApi.categories()])
      .then(([co, ca]) => {
        setCompanies(co)
        setCategories(ca)
      })
      .catch(() => {})
  }, [])

  const totalDocs = useMemo(
    () => (categories ? categories.reduce((sum, c) => sum + c.count, 0) : null),
    [categories],
  )

  const stats: { value: number | null; label: string; fallback: string }[] = [
    { value: companies?.length ?? null, label: 'Publishers sharing openly', fallback: 'Many' },
    { value: totalDocs, label: 'Documents free to read', fallback: 'Open' },
    { value: categories?.length ?? null, label: 'Subject categories', fallback: 'Diverse' },
    { value: 3, label: 'Access roles per tenant', fallback: '3' },
  ]

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#1d1d1b]">
      <SiteHeader />

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pb-16 pt-10 lg:px-10 lg:pb-24 lg:pt-16">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">
          <Sparkles className="size-3.5" aria-hidden /> About OpenVault
        </p>
        <h1 className="mt-6 max-w-4xl text-[clamp(3rem,7vw,6.6rem)] font-semibold leading-[0.9] tracking-[-0.07em]">
          Open to everyone.<br />
          Private <span className="font-serif font-normal italic">by design.</span>
        </h1>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-[#5d5b55]">
          OpenVault is a secure, multi-tenant knowledge library. Anyone can browse and download the
          documents publishers choose to share, and every organization gets a private,
          tenant-isolated workspace for the knowledge that stays in-house.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link href="/discover" className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-6 py-3 text-sm font-medium text-white hover:bg-[#3c3b37]">
            Explore the library <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/enterprise" className="inline-flex items-center gap-2 rounded-full border border-[#dcdad3] bg-[#fffdfa] px-6 py-3 text-sm font-medium text-[#1d1d1b] hover:bg-white">
            OpenVault for teams
          </Link>
        </div>
      </section>
      {/* Mission */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">Our mission</p>
          <p className="mt-6 text-3xl font-semibold leading-[1.15] tracking-[-0.04em] sm:text-4xl sm:leading-[1.1]">
            We believe the documents that move work forward should be easy to find, comfortable to
            read, and <span className="font-serif font-normal italic">safe to share.</span>
          </p>
          <p className="mt-6 text-lg leading-relaxed text-[#5d5b55]">
            Most knowledge lives in the wrong place: buried in inboxes, scattered across drives, or
            locked behind a login the people who need it don’t have. OpenVault brings it into one
            calm home: a public library for what the world should read, and a private workspace for
            what only your team should.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">Why we built it</p>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl sm:tracking-[-0.06em]">
              Two needs that never <span className="font-serif font-normal italic">had to fight.</span>
            </h2>
            <div className="mt-7 space-y-5 text-base leading-relaxed text-[#5d5b55]">
              <p>Organizations want two things at once, and most tools force a trade-off. They want to publish openly: style guides, research, policies the whole world can benefit from. And they want a private place for the material that must stay internal, with real controls over who can see it.</p>
              <p>Bolt a public site onto a private wiki and you get two disconnected systems, two logins, and a nagging worry about which door was left open. We thought that split was avoidable.</p>
              <p>So OpenVault is built around a single idea: one library, cleanly divided. Public documents flow to a portal open to everyone. Private documents stay sealed inside a tenant only your members can enter. And an AI assistant (grounded in your own documents, chunked and indexed for retrieval) helps you find answers without ever shipping your files to someone else’s servers.</p>
            </div>
          </div>
          <figure className="rounded-[28px] border border-[#dcdad3] bg-[#20211f] p-8 text-white sm:p-10">
            <Quote className="size-7 text-white/40" aria-hidden />
            <blockquote className="mt-6 font-serif text-2xl italic leading-snug sm:text-3xl">
              The best libraries are not warehouses. They are invitations: open where they should be, and trusted everywhere else.
            </blockquote>
            <figcaption className="mt-8 text-xs uppercase tracking-[0.14em] text-white/50">The OpenVault principle</figcaption>
          </figure>
        </div>
      </section>
      {/* How it works */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">For readers</p>
          <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl sm:tracking-[-0.06em]">
            How OpenVault <span className="font-serif font-normal italic">works.</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-[#5d5b55]">
            No account is needed to look around. Create a free reader account (you sign in with a
            simple username) the moment you want to save things for later.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WORKS.map((f) => (
            <div key={f.title} className="rounded-[24px] border border-[#e6e3dc] bg-[#fffdfa] p-7">
              <span
                className="grid size-12 place-items-center rounded-2xl"
                style={{ backgroundColor: f.tint, color: f.ink }}
              >
                <f.icon className="size-6" aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-[-0.02em]">{f.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-[#77746c]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
      {/* Built for organizations */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
        <div className="rounded-[32px] border border-[#dcdad3] bg-[#fffdfa] p-8 sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">
                <Building2 className="size-3.5" aria-hidden /> For organizations
              </p>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl sm:tracking-[-0.06em]">
                A private workspace, <span className="font-serif font-normal italic">tenant-isolated.</span>
              </h2>
              <p className="mt-6 text-base leading-relaxed text-[#5d5b55]">
                Create an organization and you become its first admin. Members sign in with their
                work email, and the role their admin assigns decides exactly what they can do.
                Everything inside your tenant is walled off from every other company on OpenVault.
              </p>
              <Link href="/enterprise" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-medium text-white hover:bg-[#3c3b37]">
                Create your organization <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {WORKSPACE.map((w) => (
                <div key={w.title} className="rounded-2xl border border-[#e6e3dc] bg-[#f7f6f2] p-5">
                  <w.icon className="size-5 text-[#1d1d1b]" aria-hidden />
                  <h3 className="mt-3 text-sm font-semibold">{w.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[#77746c]">{w.body}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-10 border-t border-[#e6e3dc] pt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">Three roles, set by your admin</p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {ROLES.map((r) => (
                <div key={r.name} className="flex gap-4 rounded-2xl border border-[#e6e3dc] bg-[#f7f6f2] p-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e7e2ff] text-[#5b4fb0]">
                    <r.icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{r.name}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-[#77746c]">{r.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      {/* Security & privacy */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
        <div className="rounded-[32px] bg-[#20211f] px-7 py-12 text-white sm:px-12 sm:py-16">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
              <ShieldCheck className="size-3.5" aria-hidden /> Security & privacy
            </p>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl sm:tracking-[-0.06em]">
              Secure <span className="font-serif font-normal italic">by design</span>, not as an afterthought.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-white/60">
              Privacy is structural in OpenVault. These are the guarantees the system enforces on
              every request, not settings you have to remember to switch on.
            </p>
          </div>
          <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {SECURITY.map((s) => (
              <div key={s.title}>
                <span
                  className="grid size-11 place-items-center rounded-2xl border border-white/10 bg-white/5"
                  style={{ color: s.accent }}
                >
                  <s.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Open knowledge */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
        <div className="grid gap-10 rounded-[32px] bg-[#fff8ea] p-8 sm:p-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#9a6b1e]">
              <Globe className="size-3.5" aria-hidden /> Open knowledge
            </p>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl sm:tracking-[-0.06em]">
              Published means <span className="font-serif font-normal italic">open to all.</span>
            </h2>
          </div>
          <div className="text-lg leading-relaxed text-[#6b5836]">
            <p>When a publisher marks a document public, it becomes free for anyone to read and download, with no subscription, no gate, no account required just to look. We think the knowledge people choose to share is a public good, and the reading experience should honour that.</p>
            <p className="mt-4">Your team stays in full control of the line between open and internal. Everything else stays exactly as private as you set it.</p>
          </div>
        </div>
      </section>

      {/* By the numbers */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">By the numbers</p>
        <h2 className="mt-5 max-w-2xl text-4xl font-semibold tracking-[-0.05em] sm:text-5xl sm:tracking-[-0.06em]">
          A library that keeps <span className="font-serif font-normal italic">growing.</span>
        </h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-[28px] border border-[#e6e3dc] bg-[#e6e3dc] sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-[#fffdfa] p-8">
              <p className="text-5xl font-semibold tracking-[-0.05em] tabular-nums">
                {s.value === null ? s.fallback : s.value}
              </p>
              <p className="mt-3 text-sm text-[#77746c]">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-[#98958c]">Publisher, document, and category counts read live from the public library.</p>
      </section>
      {/* Values */}
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">What we stand for</p>
          <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl sm:tracking-[-0.06em]">
            Principles we <span className="font-serif font-normal italic">build by.</span>
          </h2>
        </div>
        <div className="mt-12 divide-y divide-[#e6e3dc] border-y border-[#e6e3dc]">
          {VALUES.map((v) => (
            <div key={v.n} className="grid gap-3 py-7 md:grid-cols-[auto_1fr_2fr] md:items-baseline md:gap-10">
              <span className="font-serif text-2xl italic text-[#b1b0ac]">{v.n}</span>
              <h3 className="text-xl font-semibold tracking-[-0.02em]">{v.title}</h3>
              <p className="text-base leading-relaxed text-[#5d5b55]">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-7xl px-6 pb-24 pt-8 lg:px-10">
        <div className="rounded-[32px] bg-[#20211f] px-7 py-16 text-center text-white sm:px-12 sm:py-20">
          <h2 className="mx-auto max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.05em] sm:text-6xl sm:tracking-[-0.06em]">
            Start reading, or <span className="font-serif font-normal italic">bring your team.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/60">
            Browse the open library in seconds, or spin up a private, tenant-isolated workspace for
            your organization. Both live in the same calm home.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/discover" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-[#1d1d1b] hover:bg-white/90">
              Explore the library <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/enterprise" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-medium text-white hover:bg-white/10">
              OpenVault for teams
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
