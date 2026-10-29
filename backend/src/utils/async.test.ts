import { describe, it, expect } from 'vitest'
import { getErrorMessage, TimeoutError, withTimeout } from './async'

describe('withTimeout', () => {
  it('should resolve with the value when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok')
  })

  it('should reject with TimeoutError when the promise takes too long', async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 200))
    await expect(withTimeout(slow, 10)).rejects.toBeInstanceOf(TimeoutError)
  })

  it('should propagate the original rejection', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 50)).rejects.toThrow('boom')
  })
})

describe('getErrorMessage', () => {
  it('should return the innermost cause message', () => {
    const withCause = (message: string, cause: Error) => Object.assign(new Error(message), { cause })
    const error = withCause(
      'Workflow execution failed',
      withCause('Activity task failed', new Error('Activity task timed out'))
    )
    expect(getErrorMessage(error)).toBe('Activity task timed out')
  })

  it('should handle non-Error values', () => {
    expect(getErrorMessage('oops')).toBe('Unknown error')
  })
})
