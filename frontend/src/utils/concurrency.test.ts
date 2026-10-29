import { describe, it, expect } from 'vitest'
import { runWithConcurrency } from './concurrency'

describe('runWithConcurrency', () => {
  it('should run the task for every item', async () => {
    const seen: number[] = []
    await runWithConcurrency([1, 2, 3, 4], 2, async (n) => {
      seen.push(n)
    })
    expect(seen.sort()).toEqual([1, 2, 3, 4])
  })

  it('should never exceed the concurrency limit', async () => {
    let inFlight = 0
    let maxInFlight = 0
    await runWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight--
    })
    expect(maxInFlight).toBe(2)
  })

  it('should resolve immediately for an empty list', async () => {
    await expect(runWithConcurrency([], 3, async () => {})).resolves.toBeUndefined()
  })
})
