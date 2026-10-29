// Validation and normalization for optional lead fields.
// Keep in sync with backend/src/utils/leadFields.ts

// Phones are stored in a single standard format:
// - International numbers (written with "+" or the "00" prefix) as E.164: "+" and 8-15 digits, e.g. +14643128555.
// - National numbers as digits only (7-15), e.g. 7311239702, since the lead's country is not reliable enough to
//   infer the country calling code.
// Input may use spaces, dashes and one pair of parentheses around the area code; they are stripped. Anything
// else (extensions such as "x123", dots, letters, a "+" in the middle) makes the number invalid.
const PHONE_FORMAT = /^\+?[\d\s-]*(?:\(\d{1,5}\)[\d\s-]*)?$/

// Returns the phone in the standard format, or null when it is not a valid phone number.
export const normalizePhoneNumber = (value: string): string | null => {
  const phone = value.trim()
  if (!PHONE_FORMAT.test(phone)) return null

  const digits = phone.replace(/\D/g, '')
  if (phone.startsWith('+') || digits.startsWith('00')) {
    const number = phone.startsWith('+') ? digits : digits.slice(2)
    // Country calling codes never start with 0.
    return number.length >= 8 && number.length <= 15 && !number.startsWith('0') ? `+${number}` : null
  }
  return digits.length >= 7 && digits.length <= 15 ? digits : null
}

export const isValidPhoneNumber = (value: string): boolean => normalizePhoneNumber(value) !== null

export const MAX_YEARS_AT_COMPANY = 80

// Accepts a whole number (or a string holding one) between 0 and MAX_YEARS_AT_COMPANY.
export const parseYearsAtCompany = (value: unknown): number | null => {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : ''
  if (!/^\d+$/.test(text)) return null
  const years = Number(text)
  return years <= MAX_YEARS_AT_COMPANY ? years : null
}

// Returns the canonical profile URL (https://www.linkedin.com/in/<slug>) or null when the value is not a
// LinkedIn profile URL. The scheme is optional ("linkedin.com/in/jane" is accepted).
export const normalizeLinkedinUrl = (value: string): string | null => {
  const raw = value.trim()
  if (!raw) return null

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()
  if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return null

  const match = url.pathname.match(/^\/in\/([^/]+)\/?$/)
  if (!match) return null

  return `https://www.linkedin.com/in/${match[1]}`
}

export const isValidLinkedinUrl = (value: string): boolean => normalizeLinkedinUrl(value) !== null
