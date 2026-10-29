import { ApplicationFailure, Context } from '@temporalio/activity'
import { prisma } from '../../db'
import { PHONE_PROVIDER_ADAPTERS, PhoneLookupInput, toPhoneLookupInput } from '../../phoneProviders/adapters'
import { PhoneEnrichmentStatus, PhoneProviderId } from '../../phoneProviders/config'
import { normalizePhoneNumber } from '../../utils/leadFields'

export type PhoneLookupResult = { phone: string | null; skipped?: string }

// Calls one provider. Errors that may succeed on retry (timeouts, 5xx, 429, network) are thrown as regular errors
// so Temporal retries them; errors that never will (bad credentials, rejected request) are non-retryable.
export async function lookupPhone(
  providerId: PhoneProviderId,
  input: PhoneLookupInput
): Promise<PhoneLookupResult> {
  const adapter = PHONE_PROVIDER_ADAPTERS[providerId]
  const apiKey = process.env[adapter.apiKeyEnv]
  if (!apiKey) {
    throw ApplicationFailure.nonRetryable(`${adapter.apiKeyEnv} is not configured`, 'ProviderNotConfigured')
  }

  const request = adapter.buildRequest(input, apiKey)
  if ('skipReason' in request) {
    return { phone: null, skipped: request.skipReason }
  }

  const response = await fetch(request.url, { ...request.init, signal: Context.current().cancellationSignal })

  if (!response.ok) {
    const message = `${providerId} responded with HTTP ${response.status}`
    if (response.status === 408 || response.status === 429 || response.status >= 500) {
      throw new Error(message)
    }
    throw ApplicationFailure.nonRetryable(message, 'ProviderRequestRejected')
  }

  const rawPhone = adapter.parsePhone(await response.json())
  const phone = rawPhone ? normalizePhoneNumber(rawPhone) : null
  if (rawPhone && !phone) {
    // Bad data from the provider is treated as "no data" so the next provider gets a chance.
    Context.current().log.warn('Discarding invalid phone returned by provider', {
      providerId,
      phone: rawPhone,
    })
    return { phone: null }
  }
  return { phone }
}

export type LeadForPhoneEnrichment = { input: PhoneLookupInput } | null

export async function getLeadForPhoneEnrichment(leadId: number): Promise<LeadForPhoneEnrichment> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } })
  return lead ? { input: toPhoneLookupInput(lead) } : null
}

export type PhoneEnrichmentUpdate = {
  status: PhoneEnrichmentStatus
  provider?: PhoneProviderId | null
  phone?: string
}

export async function updatePhoneEnrichment(leadId: number, update: PhoneEnrichmentUpdate): Promise<void> {
  const isFinal = update.status !== 'PENDING' && update.status !== 'RUNNING'
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      phoneEnrichmentStatus: update.status,
      phoneEnrichmentProvider: update.provider ?? null,
      ...(isFinal && { phoneEnrichedAt: new Date() }),
      ...(update.phone && { phoneNumber: update.phone }),
    },
  })
}
