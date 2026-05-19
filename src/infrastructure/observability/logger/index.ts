import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base:  { service: 'edudesk', env: process.env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Sensitive field redaction — never log these in plain text
  redact: {
    paths: [
      'password', 'token', 'jti', 'access_token', 'refresh_token',
      '*.password', '*.token', '*.jti', '*.access_token', '*.refresh_token',
    ],
    censor: '[REDACTED]',
  },
})

// Child logger — attaches fixed context fields to every log line
export function childLogger(context: Record<string, unknown>) {
  return logger.child(context)
}

export function securityLog(
  event: string,
  data: {
    user_id?:     string
    school_id?:   string
    ip?:          string
    [key: string]: unknown
  }
): void {
  logger.warn({ ...data, security_event: event }, event)
}
