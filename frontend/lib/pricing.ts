// Presentation layer for the public /pricing page. The NUMBERS (prices and
// limits) are fetched live from GET /api/plans so the page can never drift
// from what the backend actually enforces; this file adds the copy the API
// does not carry, plus a static fallback if the API is unreachable.

import type { Plan } from './api'

export const PLAN_COPY: Record<
  string,
  { tagline: string; blurb: string; cta: 'start' | 'contact'; highlight?: boolean }
> = {
  Free: {
    tagline: 'Try it with your team',
    blurb: 'Everything you need to evaluate OpenVault on real documents.',
    cta: 'start',
  },
  Starter: {
    tagline: 'For small teams going live',
    blurb: 'Real workloads: HR policies, contracts, and daily AI questions.',
    cta: 'start',
  },
  Business: {
    tagline: 'For growing companies',
    blurb: 'Departments, file versioning, and the option to bring your own AI key.',
    cta: 'start',
    highlight: true,
  },
  Enterprise: {
    tagline: 'Dedicated resources & SLA',
    blurb: 'Unlimited usage, dedicated infrastructure, and an on-prem AI option.',
    cta: 'contact',
  },
}

// Shown only if GET /api/plans fails — mirrors seed_plans.py so the page
// still renders honest numbers instead of an empty grid.
export const FALLBACK_PLANS: Omit<Plan, 'id'>[] = [
  {
    name: 'Free', price_pkr: 0, billing_period: 'month',
    max_members: 3, max_documents: 20, storage_mb: 512, monthly_ask_limit: 50,
    allow_versions: false, allow_departments: false, allow_custom_llm: false,
    is_default: true,
  },
  {
    name: 'Starter', price_pkr: 4500, billing_period: 'month',
    max_members: 15, max_documents: 200, storage_mb: 5120, monthly_ask_limit: 1500,
    allow_versions: true, allow_departments: false, allow_custom_llm: false,
    is_default: false,
  },
  {
    name: 'Business', price_pkr: 12500, billing_period: 'month',
    max_members: 50, max_documents: 1000, storage_mb: 25600, monthly_ask_limit: 6000,
    allow_versions: true, allow_departments: true, allow_custom_llm: true,
    is_default: false,
  },
  {
    name: 'Enterprise', price_pkr: 35000, billing_period: 'month',
    max_members: null, max_documents: null, storage_mb: null, monthly_ask_limit: null,
    allow_versions: true, allow_departments: true, allow_custom_llm: true,
    is_default: false,
  },
]

export function formatPKR(n: number): string {
  return n.toLocaleString('en-PK')
}

export function storageLabel(mb: number | null): string {
  if (mb == null) return 'Unlimited storage'
  return mb >= 1024 ? `${Math.round(mb / 1024)} GB storage` : `${mb} MB storage`
}