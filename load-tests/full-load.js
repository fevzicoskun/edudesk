/**
 * Full school-day load simulation.
 *
 * Models a realistic Turkish school day:
 *   08:00 — teachers log in, check dashboards
 *   08:30 — first lesson starts → attendance burst
 *   09:00-12:00 — steady homework/note activity
 *   12:00 — lunch break (low traffic)
 *   13:00 — afternoon lessons → second attendance burst
 *   16:00 — day ends, admins run reports and exports
 *
 * This test compresses 8 hours into ~12 minutes (1:40 time ratio).
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
 *     load-tests/full-load.js
 */
import { sleep, group } from 'k6'
import http from 'k6/http'
import { check } from 'k6'
import { getAccessToken, authHeaders, checkApiOk, BASE_URL, THRESHOLDS } from './lib/helpers.js'

export const options = {
  scenarios: {
    // Morning login + dashboard check
    morning_ramp: {
      executor:  'ramping-vus',
      startVUs:  0,
      startTime: '0s',
      stages: [
        { duration: '1m',  target: 30 },  // login wave
        { duration: '1m',  target: 30 },  // steady browse
        { duration: '30s', target: 0  },
      ],
      exec: 'dashboardFlow',
    },
    // First period attendance burst
    attendance_am: {
      executor:  'ramping-vus',
      startVUs:  0,
      startTime: '2m',
      stages: [
        { duration: '30s', target: 80 },  // thundering herd
        { duration: '1m',  target: 80 },
        { duration: '30s', target: 20 },
      ],
      exec: 'attendanceFlow',
    },
    // Mid-morning homework/notes activity
    steady_state: {
      executor:  'constant-vus',
      vus:       25,
      duration:  '3m',
      startTime: '4m',
      exec:      'homeworkFlow',
    },
    // Afternoon attendance burst
    attendance_pm: {
      executor:  'ramping-vus',
      startVUs:  0,
      startTime: '7m',
      stages: [
        { duration: '30s', target: 60 },
        { duration: '1m',  target: 60 },
        { duration: '30s', target: 10 },
      ],
      exec: 'attendanceFlow',
    },
    // End of day: reports + exports
    end_of_day: {
      executor:  'constant-vus',
      vus:       15,
      duration:  '2m',
      startTime: '9m',
      exec:      'reportingFlow',
    },
  },
  thresholds: {
    ...THRESHOLDS,
    'http_req_duration{endpoint:attendance}': ['p(95)<1500'],
    'http_req_duration{endpoint:reporting}':  ['p(95)<3000'],
    'http_req_duration{endpoint:export}':     ['p(95)<500'],
    'http_req_duration{endpoint:analytics}':  ['p(95)<2500'],
  },
}

export function setup() {
  return { token: getAccessToken() }
}

export function dashboardFlow(data) {
  const { token } = data
  const res = http.get(
    `${BASE_URL}/api/internal/analytics?period=7d`,
    { headers: authHeaders(token), tags: { endpoint: 'analytics' } },
  )
  check(res, { 'dashboard: not 5xx': r => r.status < 500 })
  sleep(Math.random() * 5 + 2)
}

export function attendanceFlow(data) {
  const { token } = data
  sleep(Math.random() * 2)  // jitter

  const res = http.post(
    `${BASE_URL}/api/internal/batch/attendance`,
    JSON.stringify({
      class_id:       __ENV.CLASS_ID,
      date:           new Date().toISOString().slice(0, 10),
      default_status: 'present',
      overrides:      [],
    }),
    { headers: authHeaders(token), tags: { endpoint: 'attendance' } },
  )
  checkApiOk(res, 'attendance')
  sleep(Math.random() * 4 + 2)
}

export function homeworkFlow(data) {
  const { token } = data
  const res = http.get(
    `${BASE_URL}/api/internal/reporting?type=teacher&teacher_id=${__ENV.TEACHER_ID}&period=7d`,
    { headers: authHeaders(token), tags: { endpoint: 'reporting' } },
  )
  check(res, { 'homework: not 5xx': r => r.status < 500 })
  sleep(Math.random() * 8 + 3)
}

export function reportingFlow(data) {
  const { token } = data
  const headers   = authHeaders(token)

  if (Math.random() < 0.4) {
    const res = http.post(
      `${BASE_URL}/api/internal/export`,
      JSON.stringify({ jobType: 'excel_yoklama' }),
      { headers, tags: { endpoint: 'export' } },
    )
    check(res, { 'export: 202': r => r.status === 202 })
  } else {
    const res = http.get(
      `${BASE_URL}/api/internal/reporting?type=class&class_id=${__ENV.CLASS_ID}&period=30d`,
      { headers, tags: { endpoint: 'reporting' } },
    )
    check(res, { 'report: not 5xx': r => r.status < 500 })
  }

  sleep(Math.random() * 10 + 5)
}
