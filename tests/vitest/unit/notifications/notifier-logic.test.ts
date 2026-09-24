import { describe, it, expect } from 'vitest'
import { shouldNotifyVeli } from '@/src/domains/notifications/functions/veliAbsenceNotifier'
import { filterEligibleVeliler } from '@/src/domains/notifications/functions/homeworkCreatedNotifier'
import { filterMissingCandidates, yesterdayInTurkey } from '@/src/domains/notifications/functions/odevSonrasiVeliNotifier'
import { findMissingClasses } from '@/src/domains/notifications/functions/yoklamaHatirlatici'

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

// ── yesterdayInTurkey ─────────────────────────
describe('yesterdayInTurkey()', () => {
  it('YYYY-MM-DD formatında döner', () => {
    expect(yesterdayInTurkey()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('bugünden farklı olmalı', () => {
    const today = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
    expect(yesterdayInTurkey()).not.toBe(today)
  })
})

// ── filterMissingCandidates ───────────────────
describe('filterMissingCandidates()', () => {
  const hw = { id: 'hw1', title: 'Ödev', due_date: '2026-01-10', school_id: 'sch1', class_id: 'cls1' }
  const student = { id: 'st1', full_name: 'Ali', veli_email: 'v@t.com', veli_ad: 'Veli Ali', class_id: 'cls1' }

  const M = '2026-01-10T10:00:00Z' // öğretmenin işaretlediği an
  const sub = (status: string, marked_at: string | null = M) => [{ homework_id: 'hw1', student_id: 'st1', status, marked_at }]

  it('öğretmen "yapılmadı" işaretlediyse → aday listesine girer', () => {
    const result = filterMissingCandidates([hw], [student], sub('yapilmadi'))
    expect(result).toHaveLength(1)
    expect(result[0].studentId).toBe('st1')
  })

  // 2026-09-24 bulgusu: ödevle otomatik açılan boş satır (status=yapilmadi, marked_at=null)
  // veliye "teslim edilmedi" e-postası gönderiyordu — öğretmen hiç kontrol etmemişken.
  it('işaretlenmemiş varsayılan satır → aday DEĞİL', () => {
    expect(filterMissingCandidates([hw], [student], sub('yapilmadi', null))).toHaveLength(0)
  })

  it('hiç satır yoksa → aday DEĞİL (kontrol edilmemiş)', () => {
    expect(filterMissingCandidates([hw], [student], [])).toHaveLength(0)
  })

  it('yapildi durumundaki → hariç', () => {
    expect(filterMissingCandidates([hw], [student], sub('yapildi'))).toHaveLength(0)
  })

  it('mazeretli durumundaki → hariç', () => {
    expect(filterMissingCandidates([hw], [student], sub('mazeretli'))).toHaveLength(0)
  })

  it('eksik durumundaki → aday listesinde kalır', () => {
    expect(filterMissingCandidates([hw], [student], sub('eksik'))).toHaveLength(1)
  })

  it('farklı sınıftaki öğrenci → eşleşmez', () => {
    const otherStudent = { ...student, class_id: 'cls2' }
    expect(filterMissingCandidates([hw], [otherStudent], sub('yapilmadi'))).toHaveLength(0)
  })

  it('veli adı null ise varsayılan atanır', () => {
    const s = { ...student, veli_ad: null }
    const result = filterMissingCandidates([hw], [s], sub('yapilmadi'))
    expect(result[0].veliAd).toBe('Sayın Veli')
  })
})

// ── findMissingClasses ────────────────────────
describe('findMissingClasses()', () => {
  const classes = [
    { id: 'cls1', name: '9-A', school_id: 'sch1', mentor_teacher_id: 't1' },
    { id: 'cls2', name: '9-B', school_id: 'sch1', mentor_teacher_id: null },
  ]

  it('tüm yoklamalar alınmışsa boş döner', () => {
    expect(findMissingClasses(classes, [{ class_id: 'cls1' }, { class_id: 'cls2' }])).toHaveLength(0)
  })

  it('yoklaması alınmayanlar listelenir', () => {
    const result = findMissingClasses(classes, [{ class_id: 'cls1' }])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('cls2')
  })

  it('hiç yoklama alınmamışsa hepsi listelenir', () => {
    expect(findMissingClasses(classes, [])).toHaveLength(2)
  })

  it('boş sınıf listesi → boş döner', () => {
    expect(findMissingClasses([], [{ class_id: 'cls1' }])).toHaveLength(0)
  })
})
