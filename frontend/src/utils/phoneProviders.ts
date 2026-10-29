// Mirrors backend/src/phoneProviders/config.ts (ids and display names only).
export type PhoneProviderId = 'orionConnect' | 'astraDialer' | 'nimbusLookup'

export type PhoneEnrichmentStatus = 'PENDING' | 'RUNNING' | 'FOUND' | 'NOT_FOUND' | 'FAILED'

export const PHONE_PROVIDER_NAMES: Record<PhoneProviderId, string> = {
  orionConnect: 'Orion Connect',
  astraDialer: 'Astra Dialer',
  nimbusLookup: 'Nimbus Lookup',
}

export const isPhoneEnrichmentInProgress = (status: PhoneEnrichmentStatus | null) =>
  status === 'PENDING' || status === 'RUNNING'
