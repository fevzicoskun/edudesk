import { logger } from './logger'
import { PERF } from './metrics'
import { getCorrelationId } from './correlation'

// ─── trackedQuery ─────────────────────────────────────────────────────────────
//
// Wraps any async DB call. Logs a warning if it exceeds PERF.DB_WARN_MS.
// Use selectively on queries known to be expensive — not every repo call.
//
// Usage:
//   const { data } = await trackedQuery('attendance.findHistory', () =>
//     supabase.from('attendance').select('*').eq('class_id', classId)
//   )

export async function trackedQuery<T>(
  label:   string,
  fn:      () => Promise<T>,
  warnMs = PERF.DB_WARN_MS,
): Promise<T> {
  const start = Date.now()
  try {
    return await fn()
  } finally {
    const ms = Date.now() - start
    if (ms >= warnMs) {
      logger.warn({
        label,
        duration_ms:    ms,
        threshold_ms:   warnMs,
        correlation_id: getCorrelationId(),
        severity:       ms >= PERF.DB_ERROR_MS ? 'error' : 'warn',
      }, 'slow query')
    }
  }
}
