export type LeadsEnrichPhoneInput = {
  leadIds: number[]
}

export type LeadsEnrichPhoneOutput = {
  success: boolean
  started: number[]
  skipped: Array<{
    leadId: number
    leadName: string
    reason: string
  }>
}
