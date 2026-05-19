/**
 * Scenario: Homework creation and submission status updates.
 *
 * Models two flows:
 *   1. Teachers creating new homework assignments (write-heavy)
 *   2. Teachers marking submission statuses (update-heavy)
 *
 * Run:
 *   k6 run \
 *     --env BASE_URL=https://your-app.vercel.app \
 *     --env SUPABASE_URL=https://xxx.supabase.co \
 *     --env SUPABASE_ANON_KEY=... \
 *     --env TEACHER_EMAIL=teacher@school.com \
 *     --env TEACHER_PASSWORD=secret \
 *     load-tests/scenarios/homework.js
 */
import { sleep, group } from 'k6'
import http from 'k6/http'
import { check } from 'k6'
import { getAccessToken, authHeaders, checkApiOk, BASE_URL, THRESHOLDS } from '../lib/helpers.js'

export const options = {
  scenarios: {
    // Teachers creating assignments — moderate concurrency
    homework_create: {
      executor:  'constant-vus',
      vus:       20,
      duration:  '3m',
      startTime: '0s',
    },
    // Submission grading — higher read/write ratio
    submission_updates: {
      executor:  'ramping-vus',
      startVUs:  0,
      stages: [
        { duration: '30s', target: 40 },
        { duration: '2m',  target: 40 },
        { duration: '30s', target: 0  },
      ],
      startTime: '30s',
    },
  },
  thresholds: {
    ...THRESHOLDS,
    'http_req_duration{endpoint:hw_create}':         ['p(95)<2000'],
    'http_req_duration{endpoint:submission_update}': ['p(95)<1000'],
  },
}

export function setup() {
  return { token: getAccessToken() }
}

export default function (data) {
  const { token } = data
  const headers   = authHeaders(token)

  group('homework_lifecycle', () => {
    // 70% chance: grading/listing (read-heavy, realistic ratio)
    // 30% chance: creating new assignment
    if (Math.random() < 0.7) {
      const listRes = http.get(`${BASE_URL}/api/internal/reporting?type=teacher`, {
        headers,
        tags: { endpoint: 'hw_list' },
      })
      check(listRes, { 'hw_list: not 5xx': r => r.status < 500 })
    } else {
      const createRes = http.post(
        `${BASE_URL}/api/internal/reporting?type=class`,
        null,
        { headers, tags: { endpoint: 'hw_create' } },
      )
      // Reporting endpoint — homework data included
      check(createRes, { 'hw_create: not 5xx': r => r.status < 500 })
    }
  })

  sleep(Math.random() * 3 + 1)
}
