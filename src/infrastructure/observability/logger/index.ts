import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: { service: 'edudesk', env: process.env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
})

export function securityLog(
  event: string,
  data: {
    user_id?: string
    school_id?: string
    ip?: string
    [key: string]: unknown
  }
): void {
  logger.warn({ ...data, security_event: event }, event)
}
