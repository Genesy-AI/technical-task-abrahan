import { isValidCountryCode, normalizeCountryCode } from './countryCodes'
import {
  normalizePhoneNumber,
  MAX_YEARS_AT_COMPANY,
  normalizeLinkedinUrl,
  parseYearsAtCompany,
} from './leadFields'

export type BulkLeadData = {
  firstName: string
  lastName: string
  email: string
  jobTitle: string | null
  countryCode: string | null
  companyName: string | null
  phoneNumber: string | null
  yearsAtCompany: number | null
  linkedinUrl: string | null
}

export type ParsedBulkLead =
  | { data: BulkLeadData; errors?: undefined }
  | { data?: undefined; errors: string[] }

const isBlank = (value: unknown) => value === undefined || value === null || value === ''

const optionalText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

// Validates and normalizes one lead from a bulk import. Optional fields may be missing, null or empty, but
// when present they must be valid, otherwise the whole lead is rejected. The phone is the exception: an invalid
// one is dropped and the lead is still imported.
export const parseBulkLead = (raw: unknown): ParsedBulkLead => {
  if (!raw || typeof raw !== 'object') return { errors: ['Lead must be an object'] }
  const lead = raw as Record<string, unknown>
  const errors: string[] = []

  for (const field of ['firstName', 'lastName', 'email'] as const) {
    if (typeof lead[field] !== 'string' || !(lead[field] as string).trim()) {
      errors.push(`${field} is required`)
    }
  }

  for (const field of ['jobTitle', 'companyName', 'countryCode', 'phoneNumber', 'linkedinUrl'] as const) {
    if (!isBlank(lead[field]) && typeof lead[field] !== 'string') {
      errors.push(`${field} must be a string`)
    }
  }

  const countryCode = optionalText(lead.countryCode)
  if (countryCode && !isValidCountryCode(countryCode)) {
    errors.push('countryCode must be a valid ISO 3166-1 alpha-2 code')
  }

  // An invalid phone is discarded (the lead is imported without it) instead of rejecting the whole lead.
  const rawPhoneNumber = optionalText(lead.phoneNumber)
  const phoneNumber = rawPhoneNumber ? normalizePhoneNumber(rawPhoneNumber) : null

  const hasYears = !isBlank(
    typeof lead.yearsAtCompany === 'string' ? lead.yearsAtCompany.trim() : lead.yearsAtCompany
  )
  const yearsAtCompany = hasYears ? parseYearsAtCompany(lead.yearsAtCompany) : null
  if (hasYears && yearsAtCompany === null) {
    errors.push(`yearsAtCompany must be a whole number between 0 and ${MAX_YEARS_AT_COMPANY}`)
  }

  const rawLinkedinUrl = optionalText(lead.linkedinUrl)
  const linkedinUrl = rawLinkedinUrl ? normalizeLinkedinUrl(rawLinkedinUrl) : null
  if (rawLinkedinUrl && !linkedinUrl) {
    errors.push('linkedinUrl must be a LinkedIn profile URL (linkedin.com/in/...)')
  }

  if (errors.length > 0) return { errors }

  return {
    data: {
      firstName: (lead.firstName as string).trim(),
      lastName: (lead.lastName as string).trim(),
      email: (lead.email as string).trim(),
      jobTitle: optionalText(lead.jobTitle),
      countryCode: countryCode ? normalizeCountryCode(countryCode) : null,
      companyName: optionalText(lead.companyName),
      phoneNumber,
      yearsAtCompany,
      linkedinUrl,
    },
  }
}
