/**
 * Scenario: Concurrent export job enqueuing.
 *
 * Exports are async (Inngest-backed) but the enqueue endpoint is sync.
 * This test validates the queue entry point under burst load —
 * NOT the actual export processing (which runs in background workers).
 *
 * Key risk: multiple admins requesting exports simultaneously
 * (e.g., end-of-semester report day).
 *
 * Run:
 *   k6 run \
 *     --env BASE_URL=https://your-app.vercel.app \
 *     --env SUPABASE_URL=https://xxx.supabase.co \
 *     --env SUPABASE_ANON_KEY=... \
 *     --env TEACHER_EMAIL=admin@school.com \
 *     --env TEACHER_PASSWORD=secret \
 *     load-tests/scenarios/concurrent-export.js
 */
import { sleep } from 'k6'
import http from 'k6/http'
import { check } from 'k6'
import { getAccessToken, authHeaders, BASE_URL, THRESHOLDS } from '../lib/helpers.js'

export const options = {
  scenarios: {
    export_burst: {
      executor:  'constant-vus',
      vus:       25,
      duration:  '2m',
    },
  },
  thresholds: {
    ...THRESHOLDS,
    // Enqueue must be fast — user is waiting for job acceptance
    'http_req_duration{endpoint:export_enqueue}': ['p(95)<500'],
    'http_req_duration{endpoint:export_status}':  ['p(95)<300'],
  },
}

const JOB_TYPES = ['excel_odevler', 'excel_yoklama', 'pdf_rapor']

export function setup() {
  return { token: getAccessToken() }
}

export default function (data) {
  const { token } = data
  const headers   = authHeaders(token)

  // Enqueue a random export job type
  const jobType = JOB_TYPES[Math.floor(Math.random() * JOB_TYPES.length)]

  const enqueueRes = http.post(
    `${BASE_URL}/api/internal/export`,
    JSON.stringify({ jobType }),
    { headers, tags: { endpoint: 'export_enqueue' } },
  )

  const enqueueOk = check(enqueueRes, {
    'enqueue: 202': r => r.status === 202,
    'enqueue: jobId present': r => {
      try { return !!JSON.parse(r.body)?.data?.jobId } catch { return false }
    },
  })

  if (enqueueOk) {
    // Poll status once — simulates user checking if job was accepted
    const jobId = JSON.parse(enqueueRes.body)?.data?.jobId
    if (jobId) {
      sleep(0.5)
      const statusRes = http.get(
        `${BASE_URL}/api/internal/export?jobId=${jobId}`,
        { headers, tags: { endpoint: 'export_status' } },
      )
      check(statusRes, { 'status: not 5xx': r => r.status < 500 })
    }
  }

  // Real users don't spam exports — think time before next attempt
  sleep(Math.random() * 10 + 5)
}
