import { describe, it, expect } from 'vitest'
import {
  computeAttendanceKpi,
  computeClassAbsence,
  computeWeeklyAbsenceTrend,
  computeChronicAbsentees,
  computeCoverage,
  type AbsenceRowA,
  type StudentA,
  type ClassA,
} from '@/src/domains/attendance/lib/analitik'

const students: StudentA[] = [
  { id: 's1', class_id: 'c1', full_name: 'Ali Veli', student_number: '1' },
  { id: 's2', class_id: 'c1', full_name: 'Ayşe Can', student_number: '2' },
  { id: 's3', class_id: 'c2', full_name: 'Mert Su', student_number: '3' },
]
const classes: ClassA[] = [
  { id: 'c1', name: '9-A', grade: 9 },
  { id: 'c2', name: '10-B', grade: 10 },
]
const classesWithEmpty: ClassA[] = [...classes, { id: 'c3', name: '11-C', grade: 11 }]

function absences(studentId: string, status: string, n: number, startDay = 1): AbsenceRowA[] {
  const out: AbsenceRowA[] = []
  let d = startDay
  while (out.length < n) {
    const dow = new Date(2025, 0, d).getDay()
    if (dow !== 0 && dow !== 6) out.push({ student_id: studentId, status, date: `2025-01-${String(d).padStart(2, '0')}` })
    d++
  }
  return out
}

describe('computeAttendanceKpi', () => {
  it('boş veri → hepsi 0, takenToday/totalClasses aynen yansır', () => {
    const k = computeAttendanceKpi([], students, 5, 8)
    expect(k).toEqual({ totalUnexcused: 0, overLimit: 0, inWarn: 0, takenToday: 5, totalClasses: 8 })
  })

  it('eşik sınırları: 14 uyarı değil, 15 uyarı, 19 uyarı, 20 sınır', () => {
    const rows = [
      ...absences('s1', 'absent', 14),
      ...absences('s2', 'absent', 15),
      ...absences('s3', 'absent', 20),
    ]
    const k = computeAttendanceKpi(rows, students, 0, 2)
    expect(k.inWarn).toBe(1)
    expect(k.overLimit).toBe(1)
    expect(k.totalUnexcused).toBe(14 + 15 + 20)
  })

  it('late 0.5 katkısı', () => {
    const rows = absences('s1', 'late', 4)
    expect(computeAttendanceKpi(rows, students, 0, 2).totalUnexcused).toBe(2)
  })
})

describe('computeClassAbsence', () => {
  it('sınıf başına ortalama özürsüz, öğrencisiz sınıf düşer, azalan sıralı', () => {
    const rows = [
      ...absences('s1', 'absent', 4),
      ...absences('s3', 'absent', 6),
    ]
    const stats = computeClassAbsence(rows, students, classesWithEmpty)
    expect(stats.map(s => s.name)).toEqual(['10-B', '9-A'])
    expect(stats.find(s => s.name === '11-C')).toBeUndefined()
    expect(stats[1].avgUnexcused).toBe(2)
  })
})

describe('computeWeeklyAbsenceTrend', () => {
  it('8 nokta döner, oran 0–100, studentCount 0 → rate 0', () => {
    const pts = computeWeeklyAbsenceTrend([], 0, 8)
    expect(pts).toHaveLength(8)
    expect(pts.every(p => p.rate === 0)).toBe(true)
  })

  it('hafta içi devamsızlık orana yansır, hafta sonu sayılmaz', () => {
    const rows: AbsenceRowA[] = [
      { student_id: 's1', status: 'absent', date: '2025-01-04' },
      { student_id: 's1', status: 'absent', date: '2025-01-06' },
    ]
    const pts = computeWeeklyAbsenceTrend(rows, 10, 520)
    const wk = pts.find(p => p.weekStart === '2025-01-06')
    expect(wk).toBeDefined()
    expect(wk!.rate).toBe(2)
  })
})

describe('computeChronicAbsentees', () => {
  it('yalnız ≥ warnDays, level eşiği, azalan, className eşleşir', () => {
    const rows = [
      ...absences('s1', 'absent', 16),
      ...absences('s2', 'absent', 22),
      ...absences('s3', 'absent', 10),
    ]
    const list = computeChronicAbsentees(rows, students, classes, 15)
    expect(list.map(c => c.studentId)).toEqual(['s2', 's1'])
    expect(list[0].level).toBe('danger')
    expect(list[1].level).toBe('warn')
    expect(list[1].className).toBe('9-A')
  })
})

describe('computeCoverage', () => {
  it('boş rpc → [], yüzde max(covered)e göre, artan, bilinmeyen class atlanır', () => {
    expect(computeCoverage([], classes)).toEqual([])
    const cov = computeCoverage(
      [
        { class_id: 'c1', covered_days: 10 },
        { class_id: 'c2', covered_days: 20 },
        { class_id: 'cX', covered_days: 5 },
      ],
      classes,
    )
    expect(cov.map(c => c.name)).toEqual(['9-A', '10-B'])
    expect(cov[0].coveragePct).toBe(50)
    expect(cov[1].coveragePct).toBe(100)
  })
})
