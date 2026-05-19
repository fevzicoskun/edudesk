import { check } from 'k6'
import http from 'k6/http'

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Shared performance thresholds
export const THRESHOLDS = {
  http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  http_req_failed:   ['rate<0.01'],
}

/**
 * Exchange email/password for a JWT access_token via Supabase Auth.
 * Set TEACHER_EMAIL and TEACHER_PASSWORD in environment.
 */
export function getAccessToken() {
  const supabaseUrl = __ENV.SUPABASE_URL
  const anonKey     = __ENV.SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required')
  }

  const res = http.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email:    __ENV.TEACHER_EMAIL    || 'test@example.com',
      password: __ENV.TEACHER_PASSWORD || 'testpassword',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey':        anonKey,
      },
    },
  )

  check(res, { 'auth: 200': r => r.status === 200 })
  const body = JSON.parse(res.body)
  return body.access_token
}

/**
 * Build standard JSON headers for internal API calls.
 * token — access_token from getAccessToken()
 */
export function authHeaders(token, requestId) {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Request-ID':  requestId || `k6-${Math.random().toString(36).slice(2)}`,
  }
}

/**
 * Assert ApiResponse shape: { ok: true, data: ... }
 */
export function checkApiOk(res, tag) {
  return check(res, {
    [`${tag}: status 2xx`]: r => r.status >= 200 && r.status < 300,
    [`${tag}: ok true`]:    r => {
      try { return JSON.parse(r.body).ok === true } catch { return false }
    },
  })
}
