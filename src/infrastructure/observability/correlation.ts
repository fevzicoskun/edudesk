import { AsyncLocalStorage } from 'async_hooks'
import { randomUUID } from 'crypto'

// ─── AsyncLocalStorage store (background jobs / Inngest functions) ────────────

const store = new AsyncLocalStorage<string>()

export function withCorrelationId<T>(id: string, fn: () => T): T {
  return store.run(id, fn)
}

export function newCorrelationId(): string {
  return randomUUID()
}

// ─── Get correlation ID — prefers header over ALS ────────────────────────────
//
// Priority:
//   1. X-Request-ID header (set by internal API middleware or upstream proxy)
//   2. AsyncLocalStorage (set via withCorrelationId — used in Inngest jobs)
//   3. undefined

export function getCorrelationId(headers?: Headers): string | undefined {
  if (headers) {
    const fromHeader = headers.get('x-request-id')
    if (fromHeader) return fromHeader
  }
  return store.getStore()
}
