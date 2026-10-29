import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockActivityEnvironment } from '@temporalio/testing'
import { ApplicationFailure } from '@temporalio/activity'
import { lookupPhone } from './phoneEnrichment'
import { PhoneLookupInput } from '../../phoneProviders/adapters'
import { PhoneProviderId } from '../../phoneProviders/config'

const input: PhoneLookupInput = {
  fullName: 'Ada Lovelace',
  email: 'ada@acme.io',
  jobTitle: 'CTO',
  companyWebsite: 'acme.io',
}

const respond = (status: number, body: unknown) =>
  vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status }))

describe('lookupPhone', () => {
  const env = new MockActivityEnvironment()
  const run = (providerId: PhoneProviderId, lookupInput: PhoneLookupInput = input) =>
    env.run(lookupPhone, providerId, lookupInput)
  // Resolves with the error the activity threw (fails the test if it did not throw).
  const failureOf = (promise: Promise<unknown>) =>
    promise.then(
      () => {
        throw new Error('Expected the activity to fail')
      },
      (error: ApplicationFailure) => error
    )

  beforeEach(() => {
    vi.stubEnv('ASTRA_DIALER_API_KEY', 'key')
    vi.stubEnv('NIMBUS_LOOKUP_API_KEY', 'key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('should return the phone found by the provider', async () => {
    vi.stubGlobal('fetch', respond(200, { phoneNmbr: '2856483779' }))
    await expect(run('astraDialer')).resolves.toEqual({ phone: '2856483779' })
  })

  it('should return null when the provider has no data', async () => {
    vi.stubGlobal('fetch', respond(200, { phoneNmbr: null }))
    await expect(run('astraDialer')).resolves.toEqual({ phone: null })
  })

  it('should discard an invalid phone returned by the provider', async () => {
    vi.stubGlobal('fetch', respond(200, { phoneNmbr: '123' }))
    await expect(run('astraDialer')).resolves.toEqual({ phone: null })
  })

  it('should throw a retryable error on 5xx and 429 responses', async () => {
    for (const status of [500, 503, 429]) {
      vi.stubGlobal('fetch', respond(status, { message: 'Internal server error' }))
      const error = await failureOf(run('astraDialer'))
      expect(error).toBeInstanceOf(Error)
      expect(error).not.toBeInstanceOf(ApplicationFailure)
    }
  })

  it('should throw a non-retryable error when the provider rejects the request', async () => {
    vi.stubGlobal('fetch', respond(401, { message: 'Unauthorized' }))
    const error = await failureOf(run('astraDialer'))
    expect(error).toBeInstanceOf(ApplicationFailure)
    expect(error.nonRetryable).toBe(true)
  })

  it('should throw a non-retryable error when the API key is missing', async () => {
    vi.stubEnv('ORION_CONNECT_API_KEY', '')
    const error = await failureOf(run('orionConnect'))
    expect(error).toBeInstanceOf(ApplicationFailure)
    expect(error.type).toBe('ProviderNotConfigured')
  })

  it('should skip the provider without calling it when the lead lacks required data', async () => {
    const fetch = respond(200, {})
    vi.stubGlobal('fetch', fetch)
    const result = await run('nimbusLookup', { ...input, jobTitle: null })
    expect(result).toEqual({ phone: null, skipped: 'No job title' })
    expect(fetch).not.toHaveBeenCalled()
  })
})
