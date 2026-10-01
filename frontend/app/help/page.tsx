import Link from 'next/link'
import { ArrowRight, ChevronDown, Mail, ShieldCheck } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

type QA = { q: string; a: React.ReactNode }
type Category = { id: string; eyebrow: string; title: string; blurb: string; items: QA[] }

// Inline-link styling reused across answer copy.
const LINK = 'font-medium text-[#1d1d1b] underline underline-offset-4 hover:text-[#3c3b37]'

// Emphasised key term inside an answer.
function Key({ children }: { children: React.ReactNode }) {
  return <strong className="font-medium text-[#1d1d1b]">{children}</strong>
}

const CATEGORIES: Category[] = [
  {
    id: 'getting-started',
    eyebrow: 'The basics',
    title: 'Getting started',
    blurb: 'What OpenVault is, and how to start reading in under a minute.',
    items: [
      {
        q: 'What is OpenVault?',
        a: (
          <p>
            OpenVault is two things at once: an <Key>open knowledge library</Key> anyone can browse, and a set of{' '}
            <Key>secure, private workspaces</Key> for organizations. The public library gathers useful documents into
            one calm, searchable home, while each team keeps and shares its own documents in a walled-off space.
          </p>
        ),
      },
      {
        q: 'Do I need an account to read?',
        a: (
          <p>
            No. Browsing and reading the public library is open to everyone, no sign-up required. You only need to
            sign in to <Key>save favourites</Key> or <Key>download</Key>. Private organization documents are the
            exception: those are visible only to members of that organization.
          </p>
        ),
      },
      {
        q: 'How do I start exploring?',
        a: (
          <p>
            Head to <Link href="/discover" className={LINK}>Discover</Link> to search the whole library, filter by
            category, and sort by most recent or most popular. Open any document to read it in full, and select a
            publisher&apos;s name to see everything they&apos;ve shared.
          </p>
        ),
      },
      {
        q: 'What can I do once I sign in?',
        a: (
          <p>
            A free personal account lets you <Key>save favourites</Key> so they sync across devices, and{' '}
            <Key>download</Key> documents to keep. If you belong to an organization, signing in with your work email
            also opens your team&apos;s private <Link href="/workspace" className={LINK}>workspace</Link>.
          </p>
        ),
      },
    ],
  },
  {
    id: 'accounts',
    eyebrow: 'Your account',
    title: 'Accounts & sign-in',
    blurb: 'Two ways in: personal readers and enterprise members. Here is how each works.',
    items: [
      {
        q: 'How do personal readers sign in?',
        a: (
          <p>
            Personal readers sign in with a <Key>username</Key> and password. Choose &ldquo;Join OpenVault&rdquo; (or
            Log in), then &ldquo;Continue with Email&rdquo; to reach <Link href="/auth" className={LINK}>the sign-in
            page</Link>. Create an account with a username, email, and password, then you sign in with your{' '}
            <Key>username</Key>, not your email.
          </p>
        ),
      },
      {
        q: 'How do enterprise members sign in?',
        a: (
          <p>
            Members of an organization sign in with their <Key>work email</Key> and password from the{' '}
            <Link href="/enterprise" className={LINK}>OpenVault for teams</Link> page. Your role (admin, employee, or
            viewer) isn&apos;t something you choose; it&apos;s set by your company&apos;s administrator.
          </p>
        ),
      },
      {
        q: 'Are “Continue with Google” and “Continue with Apple” available?',
        a: (
          <p>
            Not in this build. Those buttons are placeholders; selecting one shows a note that the provider
            isn&apos;t configured yet. Use <Key>Continue with Email</Key> for a personal account, or the enterprise
            sign-in for a work account.
          </p>
        ),
      },
      {
        q: 'How do I create an organization?',
        a: (
          <p>
            On the <Link href="/enterprise" className={LINK}>OpenVault for teams</Link> page, choose &ldquo;Create an
            organization&rdquo; and enter your company name, your name, an admin email, and a password. The account
            you create becomes the organization&apos;s <Key>first admin</Key>, so you can immediately invite
            teammates and set their roles.
          </p>
        ),
      },
    ],
  },
  {
    id: 'finding',
    eyebrow: 'Discovery',
    title: 'Finding documents',
    blurb: 'Search, filter, and sort your way to the right document.',
    items: [
      {
        q: 'How does search work?',
        a: (
          <p>
            The search box on <Link href="/discover" className={LINK}>Discover</Link> matches documents by title and
            content. Type a few words and press Enter; results update to match. You can open Discover from the header
            or the home page&apos;s &ldquo;Start exploring&rdquo; link.
          </p>
        ),
      },
      {
        q: 'Can I filter by category?',
        a: (
          <p>
            Yes. Discover lets you narrow results to a single <Key>category</Key> so you can focus on just the kind of
            material you&apos;re after. Category shortcuts also appear on the home page for quick jumps.
          </p>
        ),
      },
      {
        q: 'How do I sort results?',
        a: (
          <p>
            Sort by <Key>Recent</Key> to see the newest additions first, or by <Key>Popular</Key> to surface the
            most-viewed documents. Sorting works alongside your search terms and category filter.
          </p>
        ),
      },
      {
        q: 'Can I browse everything from one source?',
        a: (
          <p>
            Yes. Filter by <Key>Publisher</Key> on Discover to see a single source&apos;s documents, or open a
            publisher&apos;s page directly from the <Link href="/publishers" className={LINK}>Publishers</Link>{' '}
            directory.
          </p>
        ),
      },
    ],
  },
  {
    id: 'favourites',
    eyebrow: 'Your library',
    title: 'Favourites',
    blurb: 'Keep the documents worth returning to in one quiet place.',
    items: [
      {
        q: 'How do I save a document?',
        a: (
          <p>
            Open any document and choose <Key>Add to favourites</Key>. Saving requires a signed-in personal account
            so your list has somewhere to live and can sync across devices.
          </p>
        ),
      },
      {
        q: 'Where do I find my saved documents?',
        a: (
          <p>
            On your <Link href="/favorites" className={LINK}>Favourites page</Link>, reachable from the header once
            you&apos;re signed in. Everything you&apos;ve saved is kept together there.
          </p>
        ),
      },
      {
        q: 'How do I remove a favourite?',
        a: (
          <p>
            From the Favourites page, use the remove (trash) control on any card to take it off your list. It&apos;s
            removed right away, and the rest of your list stays put.
          </p>
        ),
      },
    ],
  },
  {
    id: 'downloading',
    eyebrow: 'Getting a copy',
    title: 'Downloading',
    blurb: 'How to keep a copy of a document, and who is able to.',
    items: [
      {
        q: 'How do downloads work?',
        a: (
          <p>
            Open a document and use its <Key>download</Key> action to save a copy to your device. The download
            becomes available once you&apos;re signed in.
          </p>
        ),
      },
      {
        q: 'Who can download?',
        a: (
          <p>
            Anyone with a signed-in account can download from the public library. A private organization document can
            only be downloaded by <Key>members of that organization</Key> who have access to its workspace.
          </p>
        ),
      },
      {
        q: 'Can I download without signing in?',
        a: (
          <p>
            No. Reading is open, but downloading needs an account so the action stays tied to a user. Sign in, or
            create a free personal account, and the download becomes available. Please respect the original
            publisher&apos;s copyright and terms with anything you save; see the{' '}
            <Link href="/policy" className={LINK}>policy</Link>.
          </p>
        ),
      },
    ],
  },
  {
    id: 'publishers',
    eyebrow: 'Sources',
    title: 'Publishers',
    blurb: 'Every document has a source. Here is how they work.',
    items: [
      {
        q: 'What is a publisher?',
        a: (
          <p>
            A publisher is the <Key>source</Key> behind a document: the organization or author that shared it. Every
            document in the library is attributed to a publisher.
          </p>
        ),
      },
      {
        q: 'How do I see all documents from one publisher?',
        a: (
          <p>
            Select a publisher&apos;s name on any document, or open the{' '}
            <Link href="/publishers" className={LINK}>Publishers</Link> directory and choose the one you want. Their
            page lists everything they&apos;ve made available.
          </p>
        ),
      },
      {
        q: 'Is a publisher the same as an organization workspace?',
        a: (
          <p>
            Related, but not identical. A <Key>publisher</Key> is how a source is credited in the open library, while
            an <Key>organization workspace</Key> is the private area where a team manages its own documents. When a
            team publishes a document, it can appear in the library under their publisher name.
          </p>
        ),
      },
    ],
  },
  {
    id: 'workspace',
    eyebrow: 'For teams',
    title: 'The enterprise workspace',
    blurb: 'Your organization’s private area, and what each part does.',
    items: [
      {
        q: 'What is the workspace?',
        a: (
          <p>
            The <Link href="/workspace" className={LINK}>workspace</Link> is your organization&apos;s private area,
            separate from the public library and open only to signed-in enterprise members. It has four parts:{' '}
            <Key>Overview</Key>, <Key>Documents</Key>, <Key>Members</Key>, and an <Key>Audit log</Key>.
          </p>
        ),
      },
      {
        q: 'What’s on the Overview?',
        a: (
          <p>
            The Overview is a <Key>dashboard</Key> summarising your organization&apos;s documents and activity at a
            glance. It&apos;s the landing tab when you enter the workspace.
          </p>
        ),
      },
      {
        q: 'What can I do in Documents?',
        a: (
          <p>
            <Key>Admins</Key> and <Key>employees</Key> can upload new documents, publish or unpublish them, and delete
            them. <Key>Viewers</Key> have read-only access; they can open and read documents, but not change
            anything.
          </p>
        ),
      },
      {
        q: 'How do Members and roles work?',
        a: (
          <p>
            The Members section is <Key>admin-only</Key>. Admins add and remove teammates and set each person&apos;s
            role: <Key>admin</Key>, <Key>employee</Key>, or <Key>viewer</Key>. Your role decides what you can do:
            admins manage everything, employees manage documents, and viewers read.
          </p>
        ),
      },
      {
        q: 'What is the Audit log?',
        a: (
          <p>
            An <Key>admin-only</Key> record of sensitive actions in the workspace, so administrators can see who did
            what. It gives your organization a clear trail for accountability and review.
          </p>
        ),
      },
      {
        q: 'Are our documents private?',
        a: (
          <p>
            Yes. <Key>Private documents stay inside your organization.</Key> Members of other organizations
            can&apos;t see them; only people in your workspace, according to their role, have access.
          </p>
        ),
      },
    ],
  },
  {
    id: 'security',
    eyebrow: 'Trust',
    title: 'Security & privacy',
    blurb: 'How OpenVault keeps organizations separate and documents in your hands.',
    items: [
      {
        q: 'How is my organization’s data kept separate?',
        a: (
          <p>
            OpenVault is <Key>multi-tenant with strict isolation</Key>: each organization&apos;s private documents and
            members live in their own space, and one organization can never see another&apos;s private content.
          </p>
        ),
      },
      {
        q: 'Are actions tracked?',
        a: (
          <p>
            Yes. Sensitive actions inside a workspace are written to an <Key>audit log</Key> that admins can review,
            so there&apos;s always a clear trail of what changed and who changed it.
          </p>
        ),
      },
      {
        q: 'Do our documents leave the deployment for AI features?',
        a: (
          <p>
            No. AI-generated answers are produced by a <Key>local, self-hosted model</Key> running inside the
            deployment. Your documents are never sent to a third-party AI service; they don&apos;t leave the
            environment OpenVault runs in.
          </p>
        ),
      },
      {
        q: 'What happens to my reading activity?',
        a: (
          <p>
            Your saved documents and reading activity belong to you. OpenVault doesn&apos;t sell personal information
            or use your reading history for advertising; see the <Link href="/policy" className={LINK}>policy</Link>{' '}
            for the full picture.
          </p>
        ),
      },
    ],
  },
  {
    id: 'troubleshooting',
    eyebrow: 'Fixes',
    title: 'Troubleshooting',
    blurb: 'The quick answers to the things that occasionally go wrong.',
    items: [
      {
        q: 'Documents won’t load.',
        a: (
          <p>
            This usually means the app can&apos;t reach the backend service. Check your network connection, confirm
            the OpenVault <Key>backend/API is running and reachable</Key>, then refresh. If you self-host, verify the
            service is up.
          </p>
        ),
      },
      {
        q: 'I was signed out unexpectedly.',
        a: (
          <p>
            Your session or access token likely <Key>expired</Key>. Just sign in again. Personal readers at{' '}
            <Link href="/auth" className={LINK}>/auth</Link> with a username, enterprise members at{' '}
            <Link href="/enterprise" className={LINK}>/enterprise</Link> with a work email, and you&apos;ll pick up
            where you left off.
          </p>
        ),
      },
      {
        q: 'I can’t upload or delete a document.',
        a: (
          <p>
            Those actions need an <Key>admin</Key> or <Key>employee</Key> role. If you&apos;re a viewer you have
            read-only access; ask your organization&apos;s admin to update your role in the Members section.
          </p>
        ),
      },
      {
        q: 'A page says I need to sign in.',
        a: (
          <p>
            Some areas (favourites, downloads, and the workspace) require an account. Sign in with the matching
            flow: <Key>username</Key> for personal readers, <Key>work email</Key> for enterprise members.
          </p>
        ),
      },
    ],
  },
]
export default function HelpPage() {
  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#1d1d1b]">
      <SiteHeader />

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-10 pt-6 lg:px-10 lg:pb-14 lg:pt-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">Help center</p>
        <h1 className="mt-4 text-5xl font-semibold leading-[0.95] tracking-[-0.05em] sm:text-7xl sm:tracking-[-0.07em]">
          Questions,<br />
          <span className="font-serif font-normal italic">answered.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#5d5b55]">
          Everything you need to know about reading the open library, saving what matters, and running a secure
          workspace for your team. Can&apos;t find it? <Link href="#contact" className={LINK}>Get in touch</Link>.
        </p>
      </section>

      {/* Jump to */}
      <nav aria-label="FAQ topics" className="mx-auto max-w-4xl px-6 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">Browse by topic</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-[#e6e3dc] bg-[#fffdfa] px-5 py-4 text-sm text-[#1d1d1b] transition-colors hover:border-[#dcdad3] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f6f2]"
            >
              <span className="font-medium">{c.title}</span>
              <ArrowRight className="size-4 shrink-0 text-[#98958c] transition-transform group-hover:translate-x-0.5" aria-hidden />
            </a>
          ))}
        </div>
      </nav>
      {/* FAQ */}
      <div className="mx-auto max-w-4xl space-y-16 px-6 py-14 lg:px-10 lg:py-20">
        {CATEGORIES.map((cat) => (
          <section key={cat.id} id={cat.id} className="scroll-mt-24">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">{cat.eyebrow}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl sm:tracking-[-0.04em]">{cat.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#77746c]">{cat.blurb}</p>
            <div className="mt-6 rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] px-6 sm:px-8">
              {cat.items.map((item, i) => (
                <details key={i} className="group border-b border-[#eae7df] last:border-b-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl py-5 text-left text-[15px] font-medium text-[#1d1d1b] outline-none [&::-webkit-details-marker]:hidden focus-visible:ring-2 focus-visible:ring-[#1d1d1b] focus-visible:ring-offset-4 focus-visible:ring-offset-[#fffdfa]">
                    <span>{item.q}</span>
                    <ChevronDown className="size-5 shrink-0 text-[#8c8a83] transition-transform duration-200 group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="space-y-3 pb-6 pr-6 text-sm leading-relaxed text-[#5d5b55]">{item.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
      {/* Contact */}
      <section id="contact" className="mx-auto max-w-4xl scroll-mt-24 px-6 pb-6 lg:px-10">
        <div className="rounded-3xl border border-[#e6e3dc] bg-[#fffdfa] p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8a83]">Still need help?</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">We&apos;re a message away.</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#77746c]">
            If your question isn&apos;t covered above, reach out; a real person will get back to you.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <a
              href="mailto:support@openvault.example"
              className="group flex items-center gap-4 rounded-2xl border border-[#e6e3dc] bg-[#f7f6f2] p-5 transition-colors hover:bg-[#f1efe9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdfa]"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#1d1d1b] text-white"><Mail className="size-5" aria-hidden /></span>
              <span className="min-w-0">
                <span className="block font-medium text-[#1d1d1b]">Email support</span>
                <span className="block truncate text-sm text-[#77746c]">support@openvault.example</span>
              </span>
            </a>
            <Link
              href="/policy"
              className="group flex items-center gap-4 rounded-2xl border border-[#e6e3dc] bg-[#f7f6f2] p-5 transition-colors hover:bg-[#f1efe9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d1d1b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdfa]"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#1d1d1b] text-white"><ShieldCheck className="size-5" aria-hidden /></span>
              <span className="min-w-0">
                <span className="block font-medium text-[#1d1d1b]">Privacy &amp; policy</span>
                <span className="block truncate text-sm text-[#77746c]">How your data is handled</span>
              </span>
            </Link>
          </div>
        </div>
      </section>
      {/* CTA band */}
      <section className="mx-auto max-w-4xl px-6 py-14 lg:px-10">
        <div className="rounded-[28px] bg-[#1d1d1b] p-8 text-white sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Ready when you are</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Start reading, or bring your team.</h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/70">
            Explore the open library, or set up a private, secure workspace for your organization.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/discover"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-[#1d1d1b] transition-colors hover:bg-[#f1efe9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1d1b]"
            >
              Explore documents <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/enterprise"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1d1d1b]"
            >
              OpenVault for teams <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}

export const metadata = {
  title: 'Help & FAQ',
  description:
    'Answers about reading the OpenVault open library, saving favourites, downloading, and running a secure organization workspace.',
}
