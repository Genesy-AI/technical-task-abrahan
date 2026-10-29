import { Client } from '@temporalio/client'
import { verifyEmailWorkflow } from '../workflows'
import { getErrorMessage, withTimeout } from '../utils/async'

// Upper bound for verifying a single lead (all activity retries included), so clients never wait forever.
export const VERIFY_EMAIL_TIMEOUT_MS = 45_000

export type LeadToVerify = {
  id: number
  firstName: string
  lastName: string | null
  email: string
}

export type VerifyLeadEmailsResult = {
  results: Array<{ leadId: number; emailVerified: boolean }>
  errors: Array<{ leadId: number; leadName: string; error: string }>
}

type VerifyLeadEmailsOptions = {
  client: Client
  taskQueue: string
  leads: LeadToVerify[]
  saveResult: (leadId: number, emailVerified: boolean) => Promise<unknown>
  timeoutMs?: number
}

// Leads are verified in parallel and every failure is captured per lead, so a slow or failing one cannot
// block or break the rest.
export async function verifyLeadEmails({
  client,
  taskQueue,
  leads,
  saveResult,
  timeoutMs = VERIFY_EMAIL_TIMEOUT_MS,
}: VerifyLeadEmailsOptions): Promise<VerifyLeadEmailsResult> {
  const results: VerifyLeadEmailsResult['results'] = []
  const errors: VerifyLeadEmailsResult['errors'] = []

  await Promise.all(
    leads.map(async (lead) => {
      try {
        const isVerified = await withTimeout(
          client.workflow.execute(verifyEmailWorkflow, {
            taskQueue,
            workflowId: `verify-email-${lead.id}-${Date.now()}`,
            workflowExecutionTimeout: timeoutMs,
            args: [lead.email],
          }),
          // Safety net in case Temporal does not report the timeout in time.
          timeoutMs + 5_000
        )

        await saveResult(lead.id, Boolean(isVerified))
        results.push({ leadId: lead.id, emailVerified: Boolean(isVerified) })
      } catch (error) {
        errors.push({
          leadId: lead.id,
          leadName: `${lead.firstName} ${lead.lastName ?? ''}`.trim(),
          error: getErrorMessage(error),
        })
      }
    })
  )

  return { results, errors }
}
