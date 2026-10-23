import { describe, expect, it } from 'vitest'

import { makeT, t } from './i18n'

describe('i18n', () => {
  it('returns English strings by default', () => {
    expect(t('documents')).toBe('Documents')
    expect(t('loading')).toBe('Loading…')
  })

  it('returns Roman Urdu when requested', () => {
    expect(t('documents', 'ur')).toBe('Documents')
    expect(t('welcomeBack', 'ur')).toBe('Khush amdeed,')
    expect(t('markPresent', 'ur')).toContain('haziri')
  })

  it('makeT binds the language once', () => {
    const ur = makeT('ur')
    expect(ur('language')).toBe('Zuban')
    expect(ur('cancel')).toBe(' Mansookh')
  })

  it('never returns an empty string for a known key', () => {
    const keys = ['askAi', 'shared', 'attendance', 'audit', 'usagePlan', 'sources'] as const
    for (const key of keys) {
      expect(t(key, 'en').length).toBeGreaterThan(0)
      expect(t(key, 'ur').length).toBeGreaterThan(0)
    }
  })
})
