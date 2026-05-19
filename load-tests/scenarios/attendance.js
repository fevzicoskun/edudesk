/**
 * Scenario: 100 teachers submitting attendance simultaneously.
 *
 * Tests batch attendance endpoint throughput under concurrent load.
 * All VUs share one auth token — measures server capacity, not multi-user behavior.
 * For realistic multi-teacher simulation, load distinct credentials per VU from a CSV file.
 *
 * Run:
 *   k6 run \
 *     --env BASE_URL=https://your-app.vercel.app \
 *     --env SUPABASE_URL=https://xxx.supabase.co \
 *     --env SUPABASE_ANON_KEY=... \
 *     --env TEACHER_EMAIL=teacher@school.com \
 *     --env TEACHER_PASSWORD=secret \
 *     --env CLASS_ID=<uuid> \
 *     load-tests/scenarios/attendance.js
 */
import { sleep } from 'k6'
import http from 'k6/http'
import { getAccessToken, authHeaders, checkApiOk, BASE_URL, THRESHOLDS } from '../lib/helpers.js'

export const options = {
  scenarios: {
    concurrent_attendance: {
      executor:           'ramping-vus',
      startVUs:           0,
      stages: [
        { duration: '30s', target: 100 },  // ramp up to 100 teachers
        { duration: '2m',  target: 100 },  // hold — peak lesson-start period
        { duration: '30s', target: 0   },  // ramp down
      ],
    },
  },
  thresholds: {
    ...THRESHOLDS,
    // Batch attendance must be fast — teachers wait for confirmation
    'http_req_duration{endpoint:batch_attendance}': ['p(95)<1500'],
  },
}

export function setup() {
  return { token: getAccessToken() }
}

export default function (data) {
  const { token } = data
  const classId   = __ENV.CLASS_ID
  const today     = new Date().toISOString().slice(0, 10)

  // All VUs share one token — tests endpoint throughput, not multi-user concurrency.
  // For true multi-teacher simulation, pre-seed 100 teacher accounts and load credentials from a CSV.
  sleep(Math.random() * 2)

  const res = http.post(
    `${BASE_URL}/api/internal/batch/attendance`,
    JSON.stringify({
      class_id:       classId,
      date:           today,
      default_status: 'present',
      overrides:      [],
    }),
    {
      headers: authHeaders(token),
      tags:    { endpoint: 'batch_attendance' },
    },
  )

  checkApiOk(res, 'batch_attendance')

  // Teachers typically wait a few seconds before the next action
  sleep(Math.random() * 5 + 2)
}
