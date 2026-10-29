import { describe, it, expect } from 'vitest'
import { isValidPhoneNumber, normalizeLinkedinUrl, parseYearsAtCompany } from './leadFields'

describe('isValidPhoneNumber', () => {
  it('should accept the formats found in the sample CSVs', () => {
    for (const phone of [
      '+1-280-754-0462x2154',
      '001-464-312-8555',
      '(731)123-9702',
      '063.430.8860x4762',
      '7549075690',
      '990-054-7491x78196',
      '+34 612 345 678',
      '555-0100 ext. 12',
    ]) {
      expect(isValidPhoneNumber(phone), phone).toBe(true)
    }
  })

  it('should reject values that are not phone numbers', () => {
    for (const phone of [
      '',
      'abc',
      '12345',
      '+1 (555) CALL-NOW',
      '1+234567890',
      '1234567890123456',
      '555-0100x',
    ]) {
      expect(isValidPhoneNumber(phone), phone).toBe(false)
    }
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
