import { describe, it, expect } from 'vitest'
import {
  mondayOf,
  buildHwMissMap,
  buildAbsenceMap,
  computeAlerts,
} from '@/src/domains/dashboard/services/TeacherDashboardService'

// ─── mondayOf ────────────────────────────────────────────────
// Haftanın Pazartesisini döndürür; Pazar için önceki Pazartesi.

describe('mondayOf()', () => {
  it('Pazartesi girişi → aynı tarihi döndürür', () => {
    expect(mondayOf('2026-06-01')).toBe('2026-06-01') // 2026-06-01 Pazartesi
  })

  it('Çarşamba girişi → o haftanın Pazartesini döndürür', () => {
    expect(mondayOf('2026-06-03')).toBe('2026-06-01') // 2026-06-03 Çarşamba
  })

  it('Pazar girişi → önceki Pazartesiyi döndürür (diff = -6)', () => {
    expect(mondayOf('2026-06-07')).toBe('2026-06-01') // 2026-06-07 Pazar
  })

  it('Cuma girişi → o haftanın Pazartesini döndürür', () => {
    expect(mondayOf('2026-06-05')).toBe('2026-06-01') // 2026-06-05 Cuma
  })

  it('Ay sınırını doğru geçer — Mayıs sonu / Haziran başı', () => {
    expect(mondayOf('2026-06-02')).toBe('2026-06-01') // Salı → Pazartesi aynı hafta
    expect(mondayOf('2026-05-31')).toBe('2026-05-25') // Pazar → önceki Pazartesi
  })

  it('YYYY-MM-DD formatını döndürür (zero-pad)', () => {
    const result = mondayOf('2026-03-04') // Çarşamba
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result).toBe('2026-03-02')
  })
})

// ─── buildHwMissMap ──────────────────────────────────────────
// eksik / yapilmadi / gec → miss olarak sayılır; yapildi / mazeretli sayılmaz.

describe('buildHwMissMap()', () => {
  it('eksik statüs sayılır', () => {
    const map = buildHwMissMap([
      { homework_id: 'hw1', student_id: 'stu1', status: 'eksik' },
    ])
    expect(map.get('stu1')).toBe(1)
  })

  it('yapilmadi statüs sayılır', () => {
    const map = buildHwMissMap([
      { homework_id: 'hw1', student_id: 'stu1', status: 'yapilmadi' },
    ])
    expect(map.get('stu1')).toBe(1)
  })

  it('gec statüs sayılır', () => {
    const map = buildHwMissMap([
      { homework_id: 'hw1', student_id: 'stu1', status: 'gec' },
    ])
    expect(map.get('stu1')).toBe(1)
  })

  it('yapildi ve mazeretli sayılmaz', () => {
    const map = buildHwMissMap([
      { homework_id: 'hw1', student_id: 'stu1', status: 'yapildi' },
      { homework_id: 'hw2', student_id: 'stu1', status: 'mazeretli' },
    ])
    expect(map.get('stu1')).toBeUndefined()
  })

  it('aynı öğrencinin birden fazla eksiki toplanır', () => {
    const map = buildHwMissMap([
      { homework_id: 'hw1', student_id: 'stu1', status: 'eksik' },
      { homework_id: 'hw2', student_id: 'stu1', status: 'yapilmadi' },
      { homework_id: 'hw3', student_id: 'stu1', status: 'gec' },
    ])
    expect(map.get('stu1')).toBe(3)
  })

  it('limitToHwIds: sadece verilen ödev id\'lerindeki eksikler sayılır', () => {
    const limit = new Set(['hw1'])
    const map = buildHwMissMap([
      { homework_id: 'hw1', student_id: 'stu1', status: 'eksik' },
      { homework_id: 'hw2', student_id: 'stu1', status: 'eksik' }, // limit dışı
    ], limit)
    expect(map.get('stu1')).toBe(1)
  })

  it('limitToHwIds boş set → tüm eksikler filtrelenir', () => {
    const map = buildHwMissMap([
      { homework_id: 'hw1', student_id: 'stu1', status: 'eksik' },
    ], new Set())
    expect(map.get('stu1')).toBeUndefined()
  })

  it('farklı öğrenciler bağımsız sayılır', () => {
    const map = buildHwMissMap([
      { homework_id: 'hw1', student_id: 'stu1', status: 'eksik' },
      { homework_id: 'hw1', student_id: 'stu2', status: 'eksik' },
      { homework_id: 'hw2', student_id: 'stu2', status: 'eksik' },
    ])
    expect(map.get('stu1')).toBe(1)
    expect(map.get('stu2')).toBe(2)
  })
})

// ─── buildAbsenceMap ─────────────────────────────────────────
// Sadece 'absent' sayılır; 'present' ve 'late' sayılmaz.

describe('buildAbsenceMap()', () => {
  it('absent sayılır', () => {
    const map = buildAbsenceMap([{ student_id: 'stu1', status: 'absent' }])
    expect(map.get('stu1')).toBe(1)
  })

  it('present sayılmaz', () => {
    const map = buildAbsenceMap([{ student_id: 'stu1', status: 'present' }])
    expect(map.get('stu1')).toBeUndefined()
  })

  it('late sayılmaz', () => {
    const map = buildAbsenceMap([{ student_id: 'stu1', status: 'late' }])
    expect(map.get('stu1')).toBeUndefined()
  })

  it('birden fazla absent toplanır', () => {
    const map = buildAbsenceMap([
      { student_id: 'stu1', status: 'absent' },
      { student_id: 'stu1', status: 'absent' },
      { student_id: 'stu1', status: 'present' },
    ])
    expect(map.get('stu1')).toBe(2)
  })
})

// ─── computeAlerts ───────────────────────────────────────────
// En kritik davranış: RISK_HW_LOOKBACK (=5) per-class penceresi.

describe('computeAlerts()', () => {
  const makeStudent = (id: string, classId = 'cls1') => ({
    id, full_name: `Öğrenci ${id}`, class_id: classId, classes: { name: 'Test Sınıfı' },
  })

  it('sorunsuz öğrenci alert listesinde yer almaz', () => {
    const alerts = computeAlerts(
      [{ id: 'hw1', title: 'Ödev', subject: 'Mat', due_date: '2026-01-01', class_id: 'cls1', classes: null }],
      [{ homework_id: 'hw1', student_id: 'stu1', status: 'yapildi' }],
      [{ student_id: 'stu1', status: 'present' }],
      [makeStudent('stu1')],
    )
    expect(alerts).toHaveLength(0)
  })

  it('eksik ödev olan öğrenci alert\'e girer', () => {
    const alerts = computeAlerts(
      [{ id: 'hw1', title: 'Ödev', subject: 'Mat', due_date: '2026-01-01', class_id: 'cls1', classes: null }],
      [{ homework_id: 'hw1', student_id: 'stu1', status: 'eksik' }],
      [],
      [makeStudent('stu1')],
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0].studentId).toBe('stu1')
    expect(alerts[0].hwMisses).toBe(1)
  })

  it('devamsız öğrenci alert\'e girer', () => {
    const alerts = computeAlerts(
      [],
      [],
      [{ student_id: 'stu1', status: 'absent' }],
      [makeStudent('stu1')],
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0].absences).toBe(1)
  })

  it('high risk önce sıralanır', () => {
    const alerts = computeAlerts(
      [
        { id: 'hw1', title: '', subject: '', due_date: '', class_id: 'cls1', classes: null },
        { id: 'hw2', title: '', subject: '', due_date: '', class_id: 'cls1', classes: null },
        { id: 'hw3', title: '', subject: '', due_date: '', class_id: 'cls1', classes: null },
      ],
      [
        // stu1: 1 miss (low), stu2: 3 miss (high)
        { homework_id: 'hw1', student_id: 'stu1', status: 'eksik' },
        { homework_id: 'hw1', student_id: 'stu2', status: 'eksik' },
        { homework_id: 'hw2', student_id: 'stu2', status: 'eksik' },
        { homework_id: 'hw3', student_id: 'stu2', status: 'eksik' },
      ],
      [],
      [makeStudent('stu1'), makeStudent('stu2')],
    )
    expect(alerts[0].studentId).toBe('stu2')
    expect(alerts[0].riskLevel).toBe('high')
    expect(alerts[1].studentId).toBe('stu1')
    expect(alerts[1].riskLevel).toBe('low')
  })

  it('RISK_HW_LOOKBACK (5): 6. ödev pencere dışında kalır — miss sayılmaz', () => {
    // 6 ödev, öğrenci hepsinde eksik — ama limit 5 olduğu için max 5 miss sayılmalı
    const homeworks = Array.from({ length: 6 }, (_, i) => ({
      id: `hw${i + 1}`, title: '', subject: '', due_date: '', class_id: 'cls1', classes: null,
    }))
    const submissions = homeworks.map(hw => ({
      homework_id: hw.id, student_id: 'stu1', status: 'eksik',
    }))

    const alerts = computeAlerts(homeworks, submissions, [], [makeStudent('stu1')])

    expect(alerts).toHaveLength(1)
    expect(alerts[0].hwMisses).toBe(5) // 6. ödev pencere dışı
  })

  it('per-class RISK_HW_LOOKBACK: iki sınıf bağımsız pencereye sahip', () => {
    // cls1: 3 ödev, cls2: 3 ödev — her sınıf kendi 5-penceresiyle sayılır
    const homeworks = [
      { id: 'c1h1', title: '', subject: '', due_date: '', class_id: 'cls1', classes: null },
      { id: 'c1h2', title: '', subject: '', due_date: '', class_id: 'cls1', classes: null },
      { id: 'c2h1', title: '', subject: '', due_date: '', class_id: 'cls2', classes: null },
      { id: 'c2h2', title: '', subject: '', due_date: '', class_id: 'cls2', classes: null },
    ]
    const submissions = homeworks.map(hw => ({
      homework_id: hw.id, student_id: hw.class_id === 'cls1' ? 'stu1' : 'stu2', status: 'eksik',
    }))

    const alerts = computeAlerts(
      homeworks,
      submissions,
      [],
      [makeStudent('stu1', 'cls1'), makeStudent('stu2', 'cls2')],
    )

    const s1 = alerts.find(a => a.studentId === 'stu1')!
    const s2 = alerts.find(a => a.studentId === 'stu2')!
    expect(s1.hwMisses).toBe(2)
    expect(s2.hwMisses).toBe(2)
  })
})
