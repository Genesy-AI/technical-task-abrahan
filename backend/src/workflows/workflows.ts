import { ActivityFailure, ApplicationFailure, log, proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'
import {
  PHONE_PROVIDERS,
  PhoneEnrichmentStatus,
  PhoneProviderConfig,
  PhoneProviderId,
} from '../phoneProviders/config'

// Some verifications take ~20s, so each attempt gets 25s. The overall budget per lead is enforced by the
// caller through workflowExecutionTimeout (see VERIFY_EMAIL_TIMEOUT_MS in services/verifyLeadEmails.ts).
const { verifyEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: '25 seconds',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    backoffCoefficient: 2,
  },
})

export async function verifyEmailWorkflow(email: string): Promise<boolean> {
  return await verifyEmail(email)
}

const { getLeadForPhoneEnrichment, updatePhoneEnrichment } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: { maximumAttempts: 5, initialInterval: '1 second', backoffCoefficient: 2 },
})

// Each provider gets its own timeouts and retry policy.
const lookupPhoneWith = (provider: PhoneProviderConfig) =>
  proxyActivities<typeof activities>({
    startToCloseTimeout: provider.attemptTimeoutMs,
    scheduleToCloseTimeout: provider.totalTimeoutMs,
    retry: {
      maximumAttempts: provider.maxAttempts,
      initialInterval: '1 second',
      backoffCoefficient: 2,
    },
  }).lookupPhone

export type EnrichPhoneResult = {
  status: Extract<PhoneEnrichmentStatus, 'FOUND' | 'NOT_FOUND' | 'FAILED'>
  provider?: PhoneProviderId
  phone?: string
  providerErrors: Array<{ provider: PhoneProviderId; error: string }>
}

// Queries the providers in order and stops at the first phone found. A provider that keeps failing after its
// retries is skipped so the next one still gets a chance. The result is NOT_FOUND only when every provider
// answered without data; if some failed and none found a phone it is FAILED, since a retry might succeed.
export async function enrichPhoneWorkflow(leadId: number): Promise<EnrichPhoneResult> {
  const lead = await getLeadForPhoneEnrichment(leadId)
  if (!lead) {
    throw ApplicationFailure.nonRetryable(`Lead ${leadId} not found`, 'LeadNotFound')
  }

  const providerErrors: EnrichPhoneResult['providerErrors'] = []

  for (const provider of PHONE_PROVIDERS) {
    await updatePhoneEnrichment(leadId, { status: 'RUNNING', provider: provider.id })
    try {
      const { phone, skipped } = await lookupPhoneWith(provider)(provider.id, lead.input)
      if (skipped) {
        log.info('Provider skipped', { leadId, provider: provider.id, reason: skipped })
      }
      if (phone) {
        await updatePhoneEnrichment(leadId, { status: 'FOUND', provider: provider.id, phone })
        return { status: 'FOUND', provider: provider.id, phone, providerErrors }
      }
    } catch (error) {
      const message = error instanceof ActivityFailure && error.cause ? error.cause.message : String(error)
      log.warn('Provider failed, trying the next one', { leadId, provider: provider.id, error: message })
      providerErrors.push({ provider: provider.id, error: message })
    }
  }

  const status = providerErrors.length > 0 ? 'FAILED' : 'NOT_FOUND'
  await updatePhoneEnrichment(leadId, { status, provider: null })
  return { status, providerErrors }
}
