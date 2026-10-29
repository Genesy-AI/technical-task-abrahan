export interface Lead {
  firstName: string
  lastName?: string | null
  email?: string | null
  jobTitle?: string | null
  companyName?: string | null
  countryCode?: string | null
  phoneNumber?: string | null
  yearsAtCompany?: number | null
  linkedinUrl?: string | null
}

// Single source of truth for the fields usable in message templates. The frontend reads this list from
// GET /leads/template-fields, so adding a field here is enough to make it available in the composer.
export const TEMPLATE_FIELDS = [
  { key: 'firstName', label: 'First name', group: 'Contact' },
  { key: 'lastName', label: 'Last name', group: 'Contact' },
  { key: 'email', label: 'Email', group: 'Contact' },
  { key: 'phoneNumber', label: 'Phone number', group: 'Contact' },
  { key: 'linkedinUrl', label: 'LinkedIn profile', group: 'Contact' },
  { key: 'jobTitle', label: 'Job title', group: 'Work' },
  { key: 'companyName', label: 'Company', group: 'Work' },
  { key: 'yearsAtCompany', label: 'Years at company', group: 'Work' },
  { key: 'countryCode', label: 'Country code', group: 'Location' },
] as const satisfies ReadonlyArray<{ key: keyof Lead; label: string; group: string }>

const TEMPLATE_FIELD_KEYS = new Set<string>(TEMPLATE_FIELDS.map((field) => field.key))

export function generateMessageFromTemplate(template: string, lead: Lead): string {
  let message = template

  const templateVariables = template.match(/\{(\w+)\}/g) || []

  for (const variable of templateVariables) {
    const fieldName = variable.slice(1, -1)

    if (!TEMPLATE_FIELD_KEYS.has(fieldName)) {
      throw new Error(`Unknown field in template: ${fieldName}`)
    }

    const fieldValue = lead[fieldName as keyof Lead]

    if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
      throw new Error(`Missing required field: ${fieldName}`)
    }

    // A replacer function avoids "$" sequences in the value being interpreted as replacement patterns.
    message = message.replace(new RegExp(`\\{${fieldName}\\}`, 'g'), () => String(fieldValue))
  }

  return message
}
