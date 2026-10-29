export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out after ${ms / 1000}s`)
    this.name = 'TimeoutError'
  }
}

export const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// Temporal wraps the real failure (activity timeout, application error...) in a chain of `cause`s,
// so the top-level message alone ("Workflow execution failed") is not useful to the user.
export const getErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) return 'Unknown error'
  let current: Error = error
  let cause = (current as { cause?: unknown }).cause
  while (cause instanceof Error) {
    current = cause
    cause = (current as { cause?: unknown }).cause
  }
  return current.message || error.message || 'Unknown error'
}
