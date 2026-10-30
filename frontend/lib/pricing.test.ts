import { describe, expect, it } from 'vitest'
import { FALLBACK_PLANS, PLAN_COPY, formatUSD, storageLabel } from './pricing'

describe('pricing helpers', () => {
  it('formats USD amounts', () => {
    expect(formatUSD(0)).toBe('$0')
    expect(formatUSD(15)).toBe('$15')
    expect(formatUSD(1000)).toBe('$1,000')
  })

  it('formats storage', () => {
    expect(storageLabel(null)).toBe('Unlimited storage')
    expect(storageLabel(512)).toBe('512 MB storage')
    expect(storageLabel(5120)).toBe('5 GB storage')
  })

  it('has a fallback catalogue for every plan', () => {
    expect(FALLBACK_PLANS.length).toBeGreaterThanOrEqual(4)
    for (const plan of FALLBACK_PLANS) {
      expect(PLAN_COPY[plan.name]).toBeTruthy()
      expect(plan.price_usd).toBeGreaterThanOrEqual(0)
    }
  })

  it('has exactly one default plan', () => {
    expect(FALLBACK_PLANS.filter((p) => p.is_default)).toHaveLength(1)
  })

  it('orders paid plans from cheapest to most expensive', () => {
    const prices = FALLBACK_PLANS.map((p) => p.price_usd)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
    expect(new Set(prices).size).toBe(prices.length)
  })
})
