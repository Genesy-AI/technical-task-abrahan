import { describe, expect, it, vi } from 'vitest'
import { Client } from '@temporalio/client'
import { LeadToEnrich, startPhoneEnrichment } from './enrichPhones'

const lead = (overrides: Partial<LeadToEnrich> = {}): LeadToEnrich => ({
  id: 1,
  firstName: 'Ada',
  lastName: 'Lovelace',
  phoneNumber: null,
  phoneEnrichmentStatus: null,
  ...overrides,
})

const setup = (start = vi.fn().mockResolvedValue({})) => {
  const client = { workflow: { start } } as unknown as Client
  const setStatus = vi.fn().mockResolvedValue(undefined)
  return { client, start, setStatus }
}

describe('startPhoneEnrichment', () => {
  it('should start one idempotent workflow per lead and mark it as pending', async () => {
    const { client, start, setStatus } = setup()

    const result = await startPhoneEnrichment({ client, taskQueue: 'q', leads: [lead()], setStatus })

    expect(result).toEqual({ started: [1], skipped: [] })
    expect(setStatus).toHaveBeenCalledWith(1, 'PENDING')
    expect(start).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        taskQueue: 'q',
        workflowId: 'enrich-phone-1',
        workflowIdConflictPolicy: 'USE_EXISTING',
        args: [1],
      })
    )
  })

  it('should skip leads that already have a phone number', async () => {
    const { client, start, setStatus } = setup()

    const result = await startPhoneEnrichment({
      client,
      taskQueue: 'q',
      leads: [lead({ phoneNumber: '+1 555 0100' })],
      setStatus,
    })

    expect(result.skipped).toEqual([
      { leadId: 1, leadName: 'Ada Lovelace', reason: 'Lead already has a phone number' },
    ])
    expect(start).not.toHaveBeenCalled()
    expect(setStatus).not.toHaveBeenCalled()
  })

  it('should not overwrite the status of a lead whose enrichment is already running', async () => {
    const { client, start, setStatus } = setup()

    const result = await startPhoneEnrichment({
      client,
      taskQueue: 'q',
      leads: [lead({ phoneEnrichmentStatus: 'RUNNING' })],
      setStatus,
    })

    expect(result.started).toEqual([1])
    expect(start).toHaveBeenCalledTimes(1)
    expect(setStatus).not.toHaveBeenCalled()
  })

  it('should restore the previous status and report the lead when the workflow cannot start', async () => {
    const { client, setStatus } = setup(vi.fn().mockRejectedValue(new Error('Temporal unavailable')))

    const result = await startPhoneEnrichment({
      client,
      taskQueue: 'q',
      leads: [lead({ phoneEnrichmentStatus: 'NOT_FOUND' })],
      setStatus,
    })

    expect(result).toEqual({
      started: [],
      skipped: [{ leadId: 1, leadName: 'Ada Lovelace', reason: 'Temporal unavailable' }],
    })
    expect(setStatus).toHaveBeenNthCalledWith(1, 1, 'PENDING')
    expect(setStatus).toHaveBeenNthCalledWith(2, 1, 'NOT_FOUND')
  })
})
