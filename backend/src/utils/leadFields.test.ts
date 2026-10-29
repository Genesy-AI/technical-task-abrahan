import { describe, it, expect } from 'vitest'
import {
  isValidPhoneNumber,
  normalizeLinkedinUrl,
  normalizePhoneNumber,
  parseYearsAtCompany,
} from './leadFields'

describe('normalizePhoneNumber', () => {
  it('should store international numbers in E.164, converting the 00 prefix to +', () => {
    expect(normalizePhoneNumber('+34 612 345 678')).toBe('+34612345678')
    expect(normalizePhoneNumber('+1-444-818-4212')).toBe('+14448184212')
    expect(normalizePhoneNumber('+1 (555) 010-0100')).toBe('+15550100100')
    expect(normalizePhoneNumber('001-464-312-8555')).toBe('+14643128555')
  })

  it('should store national numbers as digits only, stripping parentheses and separators', () => {
    expect(normalizePhoneNumber('(731)123-9702')).toBe('7311239702')
    expect(normalizePhoneNumber(' 756-913-5693 ')).toBe('7569135693')
    expect(normalizePhoneNumber('7549075690')).toBe('7549075690')
  })

  it('should discard extensions, dots and other unexpected characters', () => {
    for (const phone of [
      '063.430.8860x4762',
      '133.622.7535',
      '+1-280-754-0462x2154',
      '990-054-7491x78196',
      '555-0100 ext. 12',
      '+1 (555) CALL-NOW',
      '1+234567890',
      '(731)(123)9702',
      '(731-123-9702',
    ]) {
      expect(normalizePhoneNumber(phone), phone).toBeNull()
    }
  })

  it('should discard numbers with an invalid length or country code', () => {
    for (const phone of ['', '12345', '1234567890123456', '+1234567', '+0123456789', '00 0123456789']) {
      expect(normalizePhoneNumber(phone), phone).toBeNull()
    }
  })

  it('should keep an already normalized number unchanged', () => {
    expect(normalizePhoneNumber('+14643128555')).toBe('+14643128555')
    expect(isValidPhoneNumber('7311239702')).toBe(true)
  })
})

describe('parseYearsAtCompany', () => {
  it('should parse whole numbers within range', () => {
    expect(parseYearsAtCompany('0')).toBe(0)
    expect(parseYearsAtCompany(' 15 ')).toBe(15)
    expect(parseYearsAtCompany(80)).toBe(80)
  })

  it('should reject negative, decimal, out of range and non numeric values', () => {
    for (const value of ['-1', '2.5', 2.5, '81', 'ten', '', null, undefined, '1e1']) {
      expect(parseYearsAtCompany(value), String(value)).toBeNull()
    }
  })
})

describe('normalizeLinkedinUrl', () => {
  it('should return the canonical profile URL', () => {
    expect(normalizeLinkedinUrl('https://www.linkedin.com/in/jane-doe')).toBe(
      'https://www.linkedin.com/in/jane-doe'
    )
    expect(normalizeLinkedinUrl('linkedin.com/in/jane-doe/')).toBe('https://www.linkedin.com/in/jane-doe')
    expect(normalizeLinkedinUrl('http://es.linkedin.com/in/jane-doe?trk=x')).toBe(
      'https://www.linkedin.com/in/jane-doe'
    )
  })

  it('should reject non LinkedIn or non profile URLs', () => {
    for (const url of [
      '',
      'jane-doe',
      'https://example.com/in/jane-doe',
      'https://linkedin.com.evil.com/in/jane-doe',
      'https://www.linkedin.com/company/acme',
      'https://www.linkedin.com/in/',
      'javascript:alert(1)',
      'ftp://linkedin.com/in/jane-doe',
    ]) {
      expect(normalizeLinkedinUrl(url), url).toBeNull()
    }
  })
})
