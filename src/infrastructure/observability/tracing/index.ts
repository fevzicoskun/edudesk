import { randomUUID } from 'crypto'
import { logger } from '../logger'

export function newRequestId(): string {
  return randomUUID()
}

export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  warnMs = 1000
): Promise<T> {
  const start = Date.now()
  try {
    return await fn()
  } finally {
    const dur = Date.now() - start
    if (dur > warnMs) {
      logger.warn({ span: name, duration_ms: dur }, 'slow span')
    }
  }
}
