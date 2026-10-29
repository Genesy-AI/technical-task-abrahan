import { PhoneProviderId } from './config'

// Normalized lead data every provider adapter works from. Each adapter picks what its API needs.
export type PhoneLookupInput = {
  fullName: string
  email: string
  jobTitle: string | null
  companyWebsite: string | null
}

export type ProviderRequest = { url: string; init: RequestInit }

// Returned when the lead lacks the data a provider needs; the provider is skipped instead of called.
export type ProviderSkip = { skipReason: string }

export type PhoneProviderAdapter = {
  id: PhoneProviderId
  // Environment variable holding the API key.
  apiKeyEnv: string
  buildRequest: (input: PhoneLookupInput, apiKey: string) => ProviderRequest | ProviderSkip
  // Extracts the phone from the response body, or null when the provider has no data.
  parsePhone: (body: unknown) => string | null
}

const BASE_URL = 'https://api.enginy.ai/api/tmp'

const jsonPost = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
})

const asRecord = (body: unknown): Record<string, unknown> =>
  body && typeof body === 'object' ? (body as Record<string, unknown>) : {}

// Providers return phones as strings or numbers; anything else counts as "no data".
const phoneValue = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

export const PHONE_PROVIDER_ADAPTERS: Record<PhoneProviderId, PhoneProviderAdapter> = {
  orionConnect: {
    id: 'orionConnect',
    apiKeyEnv: 'ORION_CONNECT_API_KEY',
    buildRequest: (input, apiKey) =>
      input.companyWebsite
        ? {
            url: `${BASE_URL}/orionConnect`,
            init: jsonPost(
              { fullName: input.fullName, companyWebsite: input.companyWebsite },
              { 'x-auth-me': apiKey }
            ),
          }
        : { skipReason: 'No company website (lead email is not on a company domain)' },
    parsePhone: (body) => phoneValue(asRecord(body).phone),
  },
  astraDialer: {
    id: 'astraDialer',
    apiKeyEnv: 'ASTRA_DIALER_API_KEY',
    buildRequest: (input, apiKey) => ({
      url: `${BASE_URL}/astraDialer`,
      init: jsonPost({ email: input.email }, { apiKey }),
    }),
    parsePhone: (body) => phoneValue(asRecord(body).phoneNmbr),
  },
  nimbusLookup: {
    id: 'nimbusLookup',
    apiKeyEnv: 'NIMBUS_LOOKUP_API_KEY',
    buildRequest: (input, apiKey) =>
      input.jobTitle
        ? {
            url: `${BASE_URL}/numbusLookup?api=${encodeURIComponent(apiKey)}`,
            init: jsonPost({ email: input.email, jobTitle: input.jobTitle }),
          }
        : { skipReason: 'No job title' },
    // The docs say `number`, but the API currently answers `phoneNmbr`; accept both.
    parsePhone: (body) => {
      const record = asRecord(body)
      return phoneValue(record.number ?? record.phoneNmbr)
    },
  },
}

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'gmx.com',
  'mail.com',
  'yandex.com',
])

// Leads have no website field, so the company website is inferred from a corporate email domain.
export const companyWebsiteFromEmail = (email: string): string | null => {
  const domain = email.trim().toLowerCase().split('@')[1]
  if (!domain || !domain.includes('.')) return null
  if (FREE_EMAIL_DOMAINS.has(domain) || /^(yahoo|hotmail|outlook|live)\./.test(domain)) return null
  return domain
}

export const toPhoneLookupInput = (lead: {
  firstName: string
  lastName: string | null
  email: string
  jobTitle: string | null
}): PhoneLookupInput => ({
  fullName: `${lead.firstName} ${lead.lastName ?? ''}`.trim(),
  email: lead.email.trim(),
  jobTitle: lead.jobTitle?.trim() || null,
  companyWebsite: companyWebsiteFromEmail(lead.email),
})
