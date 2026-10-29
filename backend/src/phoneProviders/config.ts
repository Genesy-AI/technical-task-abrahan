// Static configuration of the phone providers. This file is imported by the Temporal workflow, so it must stay
// free of side effects and Node APIs (pure data only).

export type PhoneProviderId = 'orionConnect' | 'astraDialer' | 'nimbusLookup'

// Providers currently have no limits (all null = unlimited). They announced limits are coming; a limiter (for
// example a token bucket per provider, or a dedicated task queue per provider using the worker's
// maxTaskQueueActivitiesPerSecond) will read these values. Keep them per provider, as each one will publish its own.
export type RateLimitConfig = {
  requestsPerSecond: number | null
  requestsPerMinute: number | null
  maxConcurrentRequests: number | null
}

export type PhoneProviderConfig = {
  id: PhoneProviderId
  name: string
  // Max duration of a single HTTP attempt.
  attemptTimeoutMs: number
  // Max duration for the provider including every retry, so a failing provider cannot stall the workflow.
  totalTimeoutMs: number
  maxAttempts: number
  rateLimit: RateLimitConfig
}

const UNLIMITED: RateLimitConfig = {
  requestsPerSecond: null,
  requestsPerMinute: null,
  maxConcurrentRequests: null,
}

// Queried in this order; the workflow stops at the first provider that returns a phone.
export const PHONE_PROVIDERS: readonly PhoneProviderConfig[] = [
  // Best data but slow (~5s observed) and fails sometimes.
  {
    id: 'orionConnect',
    name: 'Orion Connect',
    attemptTimeoutMs: 10_000,
    totalTimeoutMs: 40_000,
    maxAttempts: 3,
    rateLimit: UNLIMITED,
  },
  // Fastest (~1s observed) but worst data.
  {
    id: 'astraDialer',
    name: 'Astra Dialer',
    attemptTimeoutMs: 5_000,
    totalTimeoutMs: 20_000,
    maxAttempts: 3,
    rateLimit: UNLIMITED,
  },
  // New provider (~2.5s observed).
  {
    id: 'nimbusLookup',
    name: 'Nimbus Lookup',
    attemptTimeoutMs: 8_000,
    totalTimeoutMs: 30_000,
    maxAttempts: 3,
    rateLimit: UNLIMITED,
  },
]

export const PHONE_ENRICHMENT_STATUSES = ['PENDING', 'RUNNING', 'FOUND', 'NOT_FOUND', 'FAILED'] as const
export type PhoneEnrichmentStatus = (typeof PHONE_ENRICHMENT_STATUSES)[number]
