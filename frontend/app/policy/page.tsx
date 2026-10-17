import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

const policies = [
  ['Private by default', 'OpenVault does not expose a public browse, publisher, or free-user area. Documents are available only after enterprise authentication and only through the current user’s permissions.'],
  ['Tenant isolation', 'Every document, indexed chunk, member, and audit event is scoped to its owning company. A member cannot use another company’s code to see files unless a specific document grant exists.'],
  ['Least privilege', 'Company-wide documents are readable by active members of the owning company. Restricted documents require an explicit per-person grant. External sharing is always one document to one registered person at a time.'],
  ['Permission-aware AI', 'The retrieval layer filters documents before they reach the assistant. A user cannot ask the AI to reveal a file that their account cannot access.'],
  ['Auditability', 'Sign-ins, uploads, downloads, member changes, share grants, revocations, and AI questions are recorded in the employer audit trail for review and CPA/compliance workflows.'],
  ['Responsible use', 'Employers are responsible for inviting the right people, assigning accurate titles and roles, protecting credentials, and revoking access when a person or partner no longer needs it.'],
]

export default function PolicyPage() {
  return <main className="min-h-screen bg-[#f7f6f2] text-[#1d1d1b]"><SiteHeader /><section className="mx-auto max-w-4xl px-6 py-16 lg:px-10 lg:py-24"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6b6862]">Privacy & security</p><h1 className="mt-5 text-5xl font-semibold tracking-[-0.07em] sm:text-7xl">The rules behind a <span className="font-serif font-normal italic">private vault.</span></h1><p className="mt-7 max-w-2xl text-lg leading-relaxed text-[#6b6862]">OpenVault is designed around employer-controlled access. These principles describe the product behavior that protects company knowledge.</p><div className="mt-14 space-y-4">{policies.map(([title, body]) => <article key={title} className="rounded-[26px] border border-[#dcdad3] bg-[#fffdfa] p-7 sm:p-9"><h2 className="text-xl font-semibold tracking-[-0.03em]">{title}</h2><p className="mt-3 text-sm leading-relaxed text-[#6b6862]">{body}</p></article>)}</div><p className="mt-8 text-xs leading-relaxed text-[#6b6862]">This prototype documents the implemented access model. Production deployments should add environment-specific retention, encryption, backups, incident response, and legal review.</p></section><SiteFooter /></main>
}
