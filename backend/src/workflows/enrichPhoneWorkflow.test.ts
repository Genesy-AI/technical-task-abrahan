import path from 'path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { ApplicationFailure } from '@temporalio/activity'
import { DefaultLogger, Runtime, Worker } from '@temporalio/worker'
import { enrichPhoneWorkflow } from './workflows'
import { PhoneProviderId } from '../phoneProviders/config'
import type { PhoneLookupResult, PhoneEnrichmentUpdate } from './activities'

// Simulated behaviour of each provider for the current test: a result, or an error to throw.
type ProviderBehaviour =
  | PhoneLookupResult
  | 'retryable-error'
  | 'fatal-error'
  | (() => Promise<PhoneLookupResult>)
let behaviour: Record<PhoneProviderId, ProviderBehaviour>
let calls: PhoneProviderId[]
let updates: PhoneEnrichmentUpdate[]

const activities = {
  verifyEmail: async () => true,
  getLeadForPhoneEnrichment: async () => ({
    input: { fullName: 'Ada Lovelace', email: 'ada@acme.io', jobTitle: 'CTO', companyWebsite: 'acme.io' },
  }),
  updatePhoneEnrichment: async (_leadId: number, update: PhoneEnrichmentUpdate) => {
    updates.push(update)
  },
  lookupPhone: async (providerId: PhoneProviderId): Promise<PhoneLookupResult> => {
    calls.push(providerId)
    const result = behaviour[providerId]
    if (result === 'retryable-error') throw new Error(`${providerId} responded with HTTP 500`)
    if (result === 'fatal-error')
      throw ApplicationFailure.nonRetryable(`${providerId} rejected`, 'ProviderRequestRejected')
    if (typeof result === 'function') return result()
    return result
  },
}

const NO_DATA: PhoneLookupResult = { phone: null }

// These tests boot a Temporal test server and wait for retry backoff in real time, so they are skipped by default.
// Run them with RUN_SLOW_TESTS=1 pnpm test.
describe.skipIf(!process.env.RUN_SLOW_TESTS)('enrichPhoneWorkflow', { timeout: 60_000 }, () => {
  let testEnv: TestWorkflowEnvironment
  let worker: Worker
  let workerRun: Promise<void>
  const taskQueue = 'enrich-phone-test'
  let nextLeadId = 1

  beforeAll(async () => {
    Runtime.install({ logger: new DefaultLogger('ERROR') })
    testEnv = await TestWorkflowEnvironment.createTimeSkipping()
    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: path.resolve(__dirname, './index.ts'),
      activities,
    })
    workerRun = worker.run()
  }, 120_000)

  afterAll(async () => {
    worker?.shutdown()
    await workerRun
    await testEnv?.teardown()
  }, 60_000)

  beforeEach(() => {
    calls = []
    updates = []
    behaviour = { orionConnect: NO_DATA, astraDialer: NO_DATA, nimbusLookup: NO_DATA }
  })

  const enrich = () =>
    testEnv.client.workflow.execute(enrichPhoneWorkflow, {
      taskQueue,
      workflowId: `enrich-phone-test-${nextLeadId}`,
      args: [nextLeadId++],
    })

  it('should stop at the first provider that finds a phone', async () => {
    behaviour.orionConnect = { phone: '9860567526' }

    const result = await enrich()

    expect(result).toEqual({
      status: 'FOUND',
      provider: 'orionConnect',
      phone: '9860567526',
      providerErrors: [],
    })
    expect(calls).toEqual(['orionConnect'])
    expect(updates).toEqual([
      { status: 'RUNNING', provider: 'orionConnect' },
      { status: 'FOUND', provider: 'orionConnect', phone: '9860567526' },
    ])
  })

  it('should query the providers in order until one finds a phone', async () => {
    behaviour.nimbusLookup = { phone: '1122512635' }

    const result = await enrich()

    expect(result.status).toBe('FOUND')
    expect(result.provider).toBe('nimbusLookup')
    expect(calls).toEqual(['orionConnect', 'astraDialer', 'nimbusLookup'])
  })

  it('should mark the lead as NOT_FOUND when no provider has data', async () => {
    behaviour.orionConnect = { phone: null, skipped: 'No company website' }

    const result = await enrich()

    expect(result).toEqual({ status: 'NOT_FOUND', providerErrors: [] })
    expect(updates.at(-1)).toEqual({ status: 'NOT_FOUND', provider: null })
  })

  it('should retry a failing provider 3 times and then move on to the next one', async () => {
    behaviour.orionConnect = 'retryable-error'
    behaviour.astraDialer = { phone: '2856483779' }

    const result = await enrich()

    expect(calls).toEqual(['orionConnect', 'orionConnect', 'orionConnect', 'astraDialer'])
    expect(result.status).toBe('FOUND')
    expect(result.providerErrors).toEqual([
      { provider: 'orionConnect', error: 'orionConnect responded with HTTP 500' },
    ])
  })

  it('should mark the lead as FAILED when providers fail and none finds a phone', async () => {
    behaviour.orionConnect = 'fatal-error'

    const result = await enrich()

    expect(calls).toEqual(['orionConnect', 'astraDialer', 'nimbusLookup'])
    expect(result.status).toBe('FAILED')
    expect(updates.at(-1)).toEqual({ status: 'FAILED', provider: null })
  })

  it('should attach to the running workflow instead of starting a second one for the same lead', async () => {
    let release!: () => void
    behaviour.orionConnect = () =>
      new Promise((resolve) => {
        release = () => resolve({ phone: '9860567526' })
      })
    const options = {
      taskQueue,
      workflowId: `enrich-phone-test-idempotent`,
      workflowIdConflictPolicy: 'USE_EXISTING' as const,
      args: [999] as [number],
    }

    const first = await testEnv.client.workflow.start(enrichPhoneWorkflow, options)
    const second = await testEnv.client.workflow.start(enrichPhoneWorkflow, options)
    while (!release) await new Promise((resolve) => setImmediate(resolve))
    release()

    expect(second.firstExecutionRunId).toBe(first.firstExecutionRunId)
    await expect(first.result()).resolves.toMatchObject({ status: 'FOUND' })
    expect(calls).toEqual(['orionConnect'])
  })
})
