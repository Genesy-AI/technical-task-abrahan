import path from 'path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Context } from '@temporalio/activity'
import { Runtime, DefaultLogger, Worker } from '@temporalio/worker'
import { LeadToVerify, verifyLeadEmails } from './verifyLeadEmails'

// Simulated email provider behaviour, keyed by email:
// - hang@: never answers, so every attempt hits startToCloseTimeout
// - fail@: always throws
// - flaky@: throws on the first two attempts, then succeeds
// - invalid@: answers false
// - anything else: answers true
const attempts = new Map<string, number>()

const verifyEmail = async (email: string): Promise<boolean> => {
  const attempt = (attempts.get(email) ?? 0) + 1
  attempts.set(email, attempt)

  if (email.startsWith('hang@')) {
    await Context.current().cancelled
  }
  if (email.startsWith('fail@')) {
    throw new Error('Provider unavailable')
  }
  if (email.startsWith('flaky@') && attempt < 3) {
    throw new Error('Temporary provider error')
  }
  return !email.startsWith('invalid@')
}

// The time-skipping test server does not fast-forward while an activity is running, so the "hang" cases use a
// short total limit instead of the real VERIFY_EMAIL_TIMEOUT_MS (45s) to keep the suite fast.
const SHORT_TIMEOUT_MS = 3_000

const lead = (id: number, email: string): LeadToVerify => ({
  id,
  firstName: 'Lead',
  lastName: `${id}`,
  email,
})

describe('verifyLeadEmails', { timeout: 30_000 }, () => {
  let testEnv: TestWorkflowEnvironment
  let worker: Worker
  let workerRun: Promise<void>
  const taskQueue = 'verify-emails-test'

  beforeAll(async () => {
    Runtime.install({ logger: new DefaultLogger('ERROR') })
    testEnv = await TestWorkflowEnvironment.createTimeSkipping()
    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: path.resolve(__dirname, '../workflows/index.ts'),
      activities: { verifyEmail },
      shutdownGraceTime: '1 second',
    })
    workerRun = worker.run()
  }, 120_000)

  afterAll(async () => {
    worker?.shutdown()
    await workerRun
    await testEnv?.teardown()
  }, 60_000)

  beforeEach(() => {
    attempts.clear()
  })

  const run = (leads: LeadToVerify[], timeoutMs?: number) => {
    const saved = new Map<number, boolean>()
    const promise = verifyLeadEmails({
      client: testEnv.client,
      taskQueue,
      leads,
      saveResult: async (leadId, emailVerified) => saved.set(leadId, emailVerified),
      timeoutMs,
    })
    return promise.then((result) => ({ ...result, saved }))
  }

  it('should save valid and invalid results', async () => {
    const { results, errors, saved } = await run([lead(1, 'ok@example.com'), lead(2, 'invalid@example.com')])

    expect(errors).toEqual([])
    expect(results).toHaveLength(2)
    expect(saved).toEqual(
      new Map([
        [1, true],
        [2, false],
      ])
    )
  })

  it('should retry a failing verification and succeed on the third attempt', async () => {
    const { results, errors } = await run([lead(1, 'flaky@example.com')])

    expect(errors).toEqual([])
    expect(results).toEqual([{ leadId: 1, emailVerified: true }])
    expect(attempts.get('flaky@example.com')).toBe(3)
  })

  it('should give up after 3 attempts and report the error for that lead', async () => {
    const { results, errors, saved } = await run([lead(1, 'fail@example.com')])

    expect(results).toEqual([])
    expect(saved.size).toBe(0)
    expect(attempts.get('fail@example.com')).toBe(3)
    expect(errors).toEqual([{ leadId: 1, leadName: 'Lead 1', error: 'Provider unavailable' }])
  })

  it('should stop a verification that takes longer than the total limit', async () => {
    const { results, errors, saved } = await run([lead(1, 'hang@example.com')], SHORT_TIMEOUT_MS)

    expect(results).toEqual([])
    expect(saved.size).toBe(0)
    expect(errors).toEqual([{ leadId: 1, leadName: 'Lead 1', error: 'Workflow execution timed out' }])
  })

  it('should not let a slow lead block the others', async () => {
    const { results, errors, saved } = await run(
      [lead(1, 'hang@example.com'), lead(2, 'ok@example.com'), lead(3, 'invalid@example.com')],
      SHORT_TIMEOUT_MS
    )

    expect(results.map((result) => result.leadId).sort()).toEqual([2, 3])
    expect(errors.map((error) => error.leadId)).toEqual([1])
    expect(saved).toEqual(
      new Map([
        [2, true],
        [3, false],
      ])
    )
  })
})
