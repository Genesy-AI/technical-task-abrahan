import { describe, it, expect } from 'vitest'
import { ISO_3166_1_ALPHA_2_CODES, isValidCountryCode, normalizeCountryCode } from './countryCodes'

describe('ISO_3166_1_ALPHA_2_CODES', () => {
  it('should contain the 249 officially assigned codes', () => {
    expect(ISO_3166_1_ALPHA_2_CODES.size).toBe(249)
    ISO_3166_1_ALPHA_2_CODES.forEach((code) => expect(code).toMatch(/^[A-Z]{2}$/))
  })
})

describe('normalizeCountryCode', () => {
  it('should trim and uppercase the code', () => {
    expect(normalizeCountryCode(' es ')).toBe('ES')
  })
})

describe('isValidCountryCode', () => {
  it('should return true for assigned codes regardless of case and whitespace', () => {
    expect(isValidCountryCode('US')).toBe(true)
    expect(isValidCountryCode('GB')).toBe(true)
    expect(isValidCountryCode('es')).toBe(true)
    expect(isValidCountryCode(' FR ')).toBe(true)
  })

  it('should return false for malformed codes', () => {
    expect(isValidCountryCode('')).toBe(false)
    expect(isValidCountryCode('XXX')).toBe(false)
    expect(isValidCountryCode('12')).toBe(false)
    expect(isValidCountryCode('U')).toBe(false)
    expect(isValidCountryCode('USA')).toBe(false)
  })

  it('should return false for well-formed but unassigned or reserved codes', () => {
    expect(isValidCountryCode('UK')).toBe(false)
    expect(isValidCountryCode('XX')).toBe(false)
    expect(isValidCountryCode('AA')).toBe(false)
    expect(isValidCountryCode('EU')).toBe(false)
  })
})
