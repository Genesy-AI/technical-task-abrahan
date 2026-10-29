import { Client } from '@temporalio/client'
import { enrichPhoneWorkflow } from '../workflows'
import { PhoneEnrichmentStatus } from '../phoneProviders/config'
import { getErrorMessage } from '../utils/async'

// Safety net: each provider is already bounded by its own total timeout (~90s for all three).
export const ENRICH_PHONE_WORKFLOW_TIMEOUT_MS = 5 * 60_000

// One workflow id per lead makes the enrichment idempotent: see startPhoneEnrichment.
export const phoneEnrichmentWorkflowId = (leadId: number) => `enrich-phone-${leadId}`

export type LeadToEnrich = {
  id: number
  firstName: string
  lastName: string | null
  phoneNumber: string | null
  phoneEnrichmentStatus: string | null
}

export type StartPhoneEnrichmentResult = {
  started: number[]
  skipped: Array<{ leadId: number; leadName: string; reason: string }>
}

type StartPhoneEnrichmentOptions = {
  client: Client
  taskQueue: string
  leads: LeadToEnrich[]
  setStatus: (leadId: number, status: PhoneEnrichmentStatus | null) => Promise<unknown>
}

const isInProgress = (status: string | null) => status === 'PENDING' || status === 'RUNNING'

// Starts (without waiting for) one enrichment workflow per lead. Requesting a lead whose workflow is still running
// attaches to that execution instead of starting a second one (USE_EXISTING); once it has finished, the lead can be
// enriched again (ALLOW_DUPLICATE), e.g. to retry a FAILED or NOT_FOUND result.
export async function startPhoneEnrichment({
  client,
  taskQueue,
  leads,
  setStatus,
}: StartPhoneEnrichmentOptions): Promise<StartPhoneEnrichmentResult> {
  const started: StartPhoneEnrichmentResult['started'] = []
  const skipped: StartPhoneEnrichmentResult['skipped'] = []

  for (const lead of leads) {
    const leadName = `${lead.firstName} ${lead.lastName ?? ''}`.trim()

    if (lead.phoneNumber) {
      skipped.push({ leadId: lead.id, leadName, reason: 'Lead already has a phone number' })
      continue
    }

    // Marked before starting so the UI shows feedback right away. Not done when a workflow is already running,
    // to avoid overwriting the provider it is currently querying.
    const wasInProgress = isInProgress(lead.phoneEnrichmentStatus)
    try {
      if (!wasInProgress) await setStatus(lead.id, 'PENDING')
      await client.workflow.start(enrichPhoneWorkflow, {
        taskQueue,
        workflowId: phoneEnrichmentWorkflowId(lead.id),
        workflowIdConflictPolicy: 'USE_EXISTING',
        workflowIdReusePolicy: 'ALLOW_DUPLICATE',
        workflowExecutionTimeout: ENRICH_PHONE_WORKFLOW_TIMEOUT_MS,
        args: [lead.id],
      })
      started.push(lead.id)
    } catch (error) {
      if (!wasInProgress) await setStatus(lead.id, lead.phoneEnrichmentStatus as PhoneEnrichmentStatus | null)
      skipped.push({ leadId: lead.id, leadName, reason: getErrorMessage(error) })
    }
  }

  return { started, skipped }
}
