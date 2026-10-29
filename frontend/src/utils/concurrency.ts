// Runs `task` for every item with at most `limit` tasks in flight at the same time.
// Task errors are not caught here: callers are expected to handle them inside `task`.
export const runWithConcurrency = async <T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>
): Promise<void> => {
  let nextIndex = 0
  const worker = async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex++]
      await task(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}
