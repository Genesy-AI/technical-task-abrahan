import { describe, it, expect } from 'vitest'
import { parseBulkLead } from './bulkLead'

const base = { firstName: ' Jane ', lastName: 'Doe', email: 'jane@example.com' }

describe('parseBulkLead', () => {
  it('should accept a lead without optional fields and set them to null', () => {
    expect(parseBulkLead(base)).toEqual({
      data: {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        jobTitle: null,
        countryCode: null,
        companyName: null,
        phoneNumber: null,
        yearsAtCompany: null,
        linkedinUrl: null,
      },
    })
  })

  it('should treat empty optional values as missing', () => {
    const result = parseBulkLead({ ...base, phoneNumber: ' ', yearsAtCompany: '', linkedinUrl: null })
    expect(result.data).toMatchObject({ phoneNumber: null, yearsAtCompany: null, linkedinUrl: null })
  })

  it('should normalize valid optional fields', () => {
    const result = parseBulkLead({
      ...base,
      countryCode: 'es',
      phoneNumber: ' +1-280-754-0462x2154 ',
      yearsAtCompany: '7',
      linkedinUrl: 'linkedin.com/in/jane-doe',
    })
    expect(result.data).toMatchObject({
      countryCode: 'ES',
      phoneNumber: '+1-280-754-0462x2154',
      yearsAtCompany: 7,
      linkedinUrl: 'https://www.linkedin.com/in/jane-doe',
    })
  })

  it('should reject the lead when an optional field is invalid', () => {
    expect(parseBulkLead({ ...base, phoneNumber: 'call me' }).errors).toEqual([
      'phoneNumber is not a valid phone number',
    ])
    expect(parseBulkLead({ ...base, yearsAtCompany: -2 }).errors).toEqual([
      'yearsAtCompany must be a whole number between 0 and 80',
    ])
    expect(parseBulkLead({ ...base, linkedinUrl: 'https://example.com/jane' }).errors).toEqual([
      'linkedinUrl must be a LinkedIn profile URL (linkedin.com/in/...)',
    ])
    expect(parseBulkLead({ ...base, phoneNumber: 123456789 }).errors).toEqual([
      'phoneNumber must be a string',
    ])
  })

  it('should report missing required fields', () => {
    expect(parseBulkLead({ firstName: 'Jane' }).errors).toEqual(['lastName is required', 'email is required'])
    expect(parseBulkLead(null).errors).toEqual(['Lead must be an object'])
  })
})
