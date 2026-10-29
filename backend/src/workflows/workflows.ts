import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'

// Some verifications take ~20s, so each attempt gets 25s. The overall budget per lead is enforced by the
// caller through workflowExecutionTimeout (see VERIFY_EMAIL_TIMEOUT_MS in index.ts).
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
