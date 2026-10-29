import Papa from 'papaparse'
import { isValidCountryCode, normalizeCountryCode } from './countryCodes'
import {
  normalizePhoneNumber,
  MAX_YEARS_AT_COMPANY,
  normalizeLinkedinUrl,
  parseYearsAtCompany,
} from './leadFields'

export interface CsvLead {
  firstName: string
  lastName: string
  email: string
  jobTitle?: string
  countryCode?: string
  companyName?: string
  phoneNumber?: string
  yearsAtCompany?: number
  linkedinUrl?: string
  isValid: boolean
  errors: string[]
  // Problems that do not block the import, e.g. an invalid phone that was dropped.
  warnings: string[]
  rowIndex: number
}

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const parseCsv = (content: string): CsvLead[] => {
  if (!content?.trim()) {
    throw new Error('CSV content cannot be empty')
  }

  const parseResult = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transform: (value) => value.trim(),
    transformHeader: (header) => header.trim().toLowerCase(),
    quoteChar: '"',
  })

  if (parseResult.errors.length > 0) {
    const criticalErrors = parseResult.errors.filter(
      (error) => error.type === 'Delimiter' || error.type === 'Quotes' || error.type === 'FieldMismatch'
    )
    if (criticalErrors.length > 0) {
      throw new Error(`CSV parsing failed: ${criticalErrors[0].message}`)
    }
  }

  if (!parseResult.data || parseResult.data.length === 0) {
    throw new Error('CSV file appears to be empty or contains no valid data')
  }

  const data: CsvLead[] = []

  parseResult.data.forEach((row, index) => {
    if (Object.values(row).every((value) => !value)) return

    const lead: Partial<CsvLead> = { rowIndex: index + 2 }
    let rawYearsAtCompany = ''
    let rawLinkedinUrl = ''

    Object.entries(row).forEach(([header, value]) => {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z]/g, '')
      const trimmedValue = value?.trim() || ''

      switch (normalizedHeader) {
        case 'firstname':
          lead.firstName = trimmedValue
          break
        case 'lastname':
          lead.lastName = trimmedValue
          break
        case 'email':
          lead.email = trimmedValue
          break
        case 'jobtitle':
          lead.jobTitle = trimmedValue || undefined
          break
        case 'countrycode':
          lead.countryCode = trimmedValue ? normalizeCountryCode(trimmedValue) : undefined
          break
        case 'companyname':
          lead.companyName = trimmedValue || undefined
          break
        case 'phonenumber':
        case 'phone':
          lead.phoneNumber = trimmedValue || undefined
          break
        // The sample CSVs exported by the team use "yearsInRole" for this column.
        case 'yearsatcompany':
        case 'yearsincompany':
        case 'yearsinrole':
          rawYearsAtCompany = trimmedValue
          break
        case 'linkedinurl':
        case 'linkedin':
        case 'linkedinprofile':
        case 'linkedinprofileurl':
          rawLinkedinUrl = trimmedValue
          break
      }
    })

    const errors: string[] = []
    if (!lead.firstName?.trim()) {
      errors.push('First name is required')
    }
    if (!lead.lastName?.trim()) {
      errors.push('Last name is required')
    }
    if (!lead.email?.trim()) {
      errors.push('Email is required')
    } else if (!isValidEmail(lead.email)) {
      errors.push('Invalid email format')
    }
    if (lead.countryCode && !isValidCountryCode(lead.countryCode)) {
      errors.push(`Invalid country code "${lead.countryCode}" (expected ISO 3166-1 alpha-2, e.g. US)`)
    }
    const warnings: string[] = []
    if (lead.phoneNumber) {
      const phoneNumber = normalizePhoneNumber(lead.phoneNumber)
      if (phoneNumber === null) {
        warnings.push(`Phone "${lead.phoneNumber}" discarded (invalid format)`)
      }
      lead.phoneNumber = phoneNumber ?? undefined
    }
    if (rawYearsAtCompany) {
      const years = parseYearsAtCompany(rawYearsAtCompany)
      if (years === null) {
        errors.push(
          `Invalid years at company "${rawYearsAtCompany}" (expected a whole number between 0 and ${MAX_YEARS_AT_COMPANY})`
        )
      } else {
        lead.yearsAtCompany = years
      }
    }
    if (rawLinkedinUrl) {
      const linkedinUrl = normalizeLinkedinUrl(rawLinkedinUrl)
      if (linkedinUrl === null) {
        errors.push(`Invalid LinkedIn URL "${rawLinkedinUrl}" (expected linkedin.com/in/...)`)
      } else {
        lead.linkedinUrl = linkedinUrl
      }
    }

    data.push({
      ...lead,
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      email: lead.email || '',
      isValid: errors.length === 0,
      errors,
      warnings,
    } as CsvLead)
  })

  return data
}
