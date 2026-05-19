/**
 * Scenario: Reporting endpoint load.
 *
 * Reports are the most query-intensive endpoint — they join attendance,
 * homework, and notes across multiple tables. This scenario validates
 * that reporting stays within latency budget under concurrent load.
 *
 * Run:
 *   k6 run \
 *     --env BASE_URL=https://your-app.vercel.app \
 *     --env SUPABASE_URL=https://xxx.supabase.co \
 *     --env SUPABASE_ANON_KEY=... \
 *     --env TEACHER_EMAIL=teacher@school.com \
 *     --env TEACHER_PASSWORD=secret \
 *     --env CLASS_ID=<uuid> \
 *     --env TEACHER_ID=<uuid> \
 *     --env STUDENT_ID=<uuid> \
 *     load-tests/scenarios/reports.js
 */
import { sleep, group } from 'k6'
import http from 'k6/http'
import { check } from 'k6'
import { getAccessToken, authHeaders, BASE_URL, THRESHOLDS } from '../lib/helpers.js'

export const options = {
  scenarios: {
    report_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 30 },
        { duration: '3m', target: 30 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    ...THRESHOLDS,
    // Reports are heavier — allow 3s budget at p95
    'http_req_duration{endpoint:report_class}':   ['p(95)<3000'],
    'http_req_duration{endpoint:report_teacher}': ['p(95)<3000'],
    'http_req_duration{endpoint:report_student}': ['p(95)<2000'],
    'http_req_duration{endpoint:analytics}':      ['p(95)<2500'],
  },
}

export function setup() {
  return { token: getAccessToken() }
}

export default function (data) {
  const { token }   = data
  const headers     = authHeaders(token)
  const classId     = __ENV.CLASS_ID
  const teacherId   = __ENV.TEACHER_ID
  const studentId   = __ENV.STUDENT_ID

  // Round-robin across report types to get realistic mix
  const roll = Math.random()

  group('reporting', () => {
    if (roll < 0.25) {
      // Class report — heaviest (all students × all subjects)
      const res = http.get(
        `${BASE_URL}/api/internal/reporting?type=class&class_id=${classId}&period=30d`,
        { headers, tags: { endpoint: 'report_class' } },
      )
      check(res, { 'class report: not 5xx': r => r.status < 500 })

    } else if (roll < 0.5) {
      // Teacher report — moderate
      const res = http.get(
        `${BASE_URL}/api/internal/reporting?type=teacher&teacher_id=${teacherId}&period=30d`,
        { headers, tags: { endpoint: 'report_teacher' } },
      )
      check(res, { 'teacher report: not 5xx': r => r.status < 500 })

    } else if (roll < 0.75) {
      // Student report — lightest individual query
      const res = http.get(
        `${BASE_URL}/api/internal/reporting?type=student&student_id=${studentId}&period=30d`,
        { headers, tags: { endpoint: 'report_student' } },
      )
      check(res, { 'student report: not 5xx': r => r.status < 500 })

    } else {
      // Analytics — 6 parallel DB queries
      const res = http.get(
        `${BASE_URL}/api/internal/analytics?period=30d`,
        { headers, tags: { endpoint: 'analytics' } },
      )
      check(res, { 'analytics: not 5xx': r => r.status < 500 })
    }
  })

  // Reports are opened, read, and navigated — realistic think time
  sleep(Math.random() * 8 + 3)
}
