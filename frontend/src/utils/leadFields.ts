// Validation and normalization for optional lead fields.
// Keep in sync with backend/src/utils/leadFields.ts

// Leads come from many countries and sources, so phone numbers are not forced into a single format.
// Accepted: an optional leading "+", digits and common separators (space, dot, dash, parentheses), and an
// optional extension ("x123", "ext 123", "ext. 123"). The main number must have 7-15 digits (E.164 max).
const PHONE_PATTERN = /^\+?[\d\s().-]+?(?:\s*(?:x|ext\.?|extension)\s*\d{1,6})?$/i
const PHONE_EXTENSION = /\s*(?:x|ext\.?|extension)\s*\d{1,6}$/i

export const isValidPhoneNumber = (value: string): boolean => {
  const phone = value.trim()
  if (!PHONE_PATTERN.test(phone)) return false
  const digits = phone.replace(PHONE_EXTENSION, '').replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

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
