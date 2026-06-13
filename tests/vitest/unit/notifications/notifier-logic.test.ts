import { describe, it, expect } from 'vitest'
import { shouldNotifyVeli } from '@/src/domains/notifications/functions/veliAbsenceNotifier'
import { filterEligibleVeliler } from '@/src/domains/notifications/functions/homeworkCreatedNotifier'

// ── shouldNotifyVeli ──────────────────────────
describe('shouldNotifyVeli()', () => {
  const base = {
    status: 'absent',
    notified_at: null,
    students: { veli_email: 'veli@test.com', veli_email_opt_out: false },
  }

  it('geçerli absent kayıt → true', () => {
    expect(shouldNotifyVeli(base)).toBe(true)
  })

  it('late status da → true', () => {
    expect(shouldNotifyVeli({ ...base, status: 'late' })).toBe(true)
  })

  it('null kayıt → false', () => {
    expect(shouldNotifyVeli(null)).toBe(false)
  })

  it('undefined kayıt → false', () => {
    expect(shouldNotifyVeli(undefined)).toBe(false)
  })

  it('excused → false', () => {
    expect(shouldNotifyVeli({ ...base, status: 'excused' })).toBe(false)
  })

  it('present → false', () => {
    expect(shouldNotifyVeli({ ...base, status: 'present' })).toBe(false)
  })

  it('zaten bildirilmiş (notified_at dolu) → false', () => {
    expect(shouldNotifyVeli({ ...base, notified_at: '2026-01-01T10:00:00Z' })).toBe(false)
  })

  it('veli_email null → false', () => {
    expect(shouldNotifyVeli({ ...base, students: { veli_email: null, veli_email_opt_out: false } })).toBe(false)
  })

  it('veli_email_opt_out true → false', () => {
    expect(shouldNotifyVeli({ ...base, students: { veli_email: 'v@t.com', veli_email_opt_out: true } })).toBe(false)
  })

  it('students null → false', () => {
    expect(shouldNotifyVeli({ ...base, students: null })).toBe(false)
  })
})

// ── filterEligibleVeliler ─────────────────────
describe('filterEligibleVeliler()', () => {
  const makeStudent = (email: string | null, optOut = false) => ({
    id: 'id',
    full_name: 'Ad',
    veli_email: email,
    veli_ad: null,
    veli_email_opt_out: optOut,
  } as Parameters<typeof filterEligibleVeliler>[0][number])

  it('opt_out false ve email olan → dahil', () => {
    expect(filterEligibleVeliler([makeStudent('a@b.com')])).toHaveLength(1)
  })

  it('email null → hariç', () => {
    expect(filterEligibleVeliler([makeStudent(null)])).toHaveLength(0)
  })

  it('50den fazla → ilk 50 alınır', () => {
    const students = Array.from({ length: 60 }, (_, i) => makeStudent(`v${i}@b.com`))
    expect(filterEligibleVeliler(students)).toHaveLength(50)
  })

  it('karma liste — sadece uygunlar kalır', () => {
    const list = [
      makeStudent('a@b.com'),
      makeStudent(null),
      makeStudent('c@b.com'),
    ]
    expect(filterEligibleVeliler(list)).toHaveLength(2)
  })
})
