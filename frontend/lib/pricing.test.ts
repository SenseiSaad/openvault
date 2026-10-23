import { describe, expect, it } from 'vitest'

import { FALLBACK_PLANS, PLAN_COPY, formatPKR, storageLabel } from './pricing'

describe('pricing helpers', () => {
  it('formats PKR amounts with thousands separators', () => {
    expect(formatPKR(0)).toBe('0')
    expect(formatPKR(12500)).toBe('12,500')
    expect(formatPKR(1000000)).toBe('1,000,000')
  })

  it('labels storage in MB and GB', () => {
    expect(storageLabel(null)).toBe('Unlimited storage')
    expect(storageLabel(512)).toBe('512 MB storage')
    expect(storageLabel(5120)).toBe('5 GB storage')
  })

  it('keeps the fallback plan list internally consistent', () => {
    expect(FALLBACK_PLANS.length).toBeGreaterThanOrEqual(4)
    for (const plan of FALLBACK_PLANS) {
      expect(plan.name.length).toBeGreaterThan(0)
      // Copy must exist for every plan the UI can render.
      expect(PLAN_COPY[plan.name]).toBeDefined()
      expect(plan.price_pkr).toBeGreaterThanOrEqual(0)
    }
  })

  it('has exactly one default plan', () => {
    expect(FALLBACK_PLANS.filter((p) => p.is_default)).toHaveLength(1)
  })

  it('prices tiers in ascending order', () => {
    const prices = FALLBACK_PLANS.map((p) => p.price_pkr)
    const sorted = [...prices].sort((a, b) => a - b)
    expect(prices).toEqual(sorted)
  })
})
