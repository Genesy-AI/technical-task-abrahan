import { describe, it, expect } from 'vitest'
import {
  companyWebsiteFromEmail,
  PHONE_PROVIDER_ADAPTERS,
  PhoneLookupInput,
  toPhoneLookupInput,
} from './adapters'

const input: PhoneLookupInput = {
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  jobTitle: 'CTO',
  companyWebsite: 'example.com',
}

const bodyOf = (init: RequestInit) => JSON.parse(String(init.body))

describe('PHONE_PROVIDER_ADAPTERS', () => {
  it('should build the Orion Connect request with the auth header', () => {
    const request = PHONE_PROVIDER_ADAPTERS.orionConnect.buildRequest(input, 'key')
    if ('skipReason' in request) throw new Error('unexpected skip')
    expect(request.url).toBe('https://api.enginy.ai/api/tmp/orionConnect')
    expect(request.init.headers).toMatchObject({ 'x-auth-me': 'key' })
    expect(bodyOf(request.init)).toEqual({ fullName: 'Ada Lovelace', companyWebsite: 'example.com' })
  })

  it('should skip Orion Connect when there is no company website', () => {
    expect(
      PHONE_PROVIDER_ADAPTERS.orionConnect.buildRequest({ ...input, companyWebsite: null }, 'key')
    ).toEqual({
      skipReason: expect.any(String),
    })
  })

  it('should build the Astra Dialer request with the apiKey header', () => {
    const request = PHONE_PROVIDER_ADAPTERS.astraDialer.buildRequest(input, 'key')
    if ('skipReason' in request) throw new Error('unexpected skip')
    expect(request.init.headers).toMatchObject({ apiKey: 'key' })
    expect(bodyOf(request.init)).toEqual({ email: 'ada@example.com' })
  })

  it('should send the Nimbus Lookup key as a query parameter and skip without job title', () => {
    const request = PHONE_PROVIDER_ADAPTERS.nimbusLookup.buildRequest(input, 'k&y')
    if ('skipReason' in request) throw new Error('unexpected skip')
    expect(request.url).toBe('https://api.enginy.ai/api/tmp/numbusLookup?api=k%26y')
    expect(bodyOf(request.init)).toEqual({ email: 'ada@example.com', jobTitle: 'CTO' })
    const withoutJobTitle = PHONE_PROVIDER_ADAPTERS.nimbusLookup.buildRequest(
      { ...input, jobTitle: null },
      'k'
    )
    expect(withoutJobTitle).toEqual({ skipReason: 'No job title' })
  })

  it('should parse each provider response shape', () => {
    expect(PHONE_PROVIDER_ADAPTERS.orionConnect.parsePhone({ phone: '9860567526' })).toBe('9860567526')
    expect(PHONE_PROVIDER_ADAPTERS.orionConnect.parsePhone({ phone: null })).toBeNull()
    expect(PHONE_PROVIDER_ADAPTERS.astraDialer.parsePhone({ phoneNmbr: '2856483779' })).toBe('2856483779')
    expect(PHONE_PROVIDER_ADAPTERS.astraDialer.parsePhone({ phoneNmbr: null })).toBeNull()
    expect(PHONE_PROVIDER_ADAPTERS.astraDialer.parsePhone({})).toBeNull()
    // Documented shape and the shape the API actually returns.
    expect(PHONE_PROVIDER_ADAPTERS.nimbusLookup.parsePhone({ number: 1122512635, countryCode: 'ES' })).toBe(
      '1122512635'
    )
    expect(
      PHONE_PROVIDER_ADAPTERS.nimbusLookup.parsePhone({ phoneNmbr: 6775261718, countryCode: 'ES' })
    ).toBe('6775261718')
    expect(PHONE_PROVIDER_ADAPTERS.nimbusLookup.parsePhone('not an object')).toBeNull()
  })
})

describe('companyWebsiteFromEmail', () => {
  it('should use corporate email domains and ignore free email providers', () => {
    expect(companyWebsiteFromEmail('jane@acme.io')).toBe('acme.io')
    expect(companyWebsiteFromEmail('jane@gmail.com')).toBeNull()
    expect(companyWebsiteFromEmail('jane@yahoo.co.uk')).toBeNull()
    expect(companyWebsiteFromEmail('invalid')).toBeNull()
  })
})

describe('toPhoneLookupInput', () => {
  it('should build the normalized provider input from a lead', () => {
    expect(
      toPhoneLookupInput({ firstName: 'Ada', lastName: null, email: ' ada@acme.io ', jobTitle: '  ' })
    ).toEqual({ fullName: 'Ada', email: 'ada@acme.io', jobTitle: null, companyWebsite: 'acme.io' })
  })
})
