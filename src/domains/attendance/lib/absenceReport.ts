import { ATTENDANCE_WARN_DAYS, ATTENDANCE_LIMIT_DAYS } from '@/src/shared/constants/attendance'
import type { AbsenceCount } from '../types'

export type RaporRow = {
  studentId:  string
  fullName:   string
  studentNo:  string | null
  className:  string
  unexcused:  number
  excused:    number
  risk:       'tehlike' | 'uyari' | 'takip'
}

export type StudentMeta = {
  id:        string
  fullName:  string
  studentNo: string | null
  className: string
}

export function getRisk(unexcused: number): 'tehlike' | 'uyari' | 'takip' {
  if (unexcused >= ATTENDANCE_LIMIT_DAYS) return 'tehlike'
  if (unexcused >= ATTENDANCE_WARN_DAYS)  return 'uyari'
  return 'takip'
}

export function buildReportRows(
  counts:   Record<string, AbsenceCount>,
  students: StudentMeta[]
): RaporRow[] {
  return students
    .filter(s => {
      const c = counts[s.id]
      return c && (c.unexcused > 0 || c.excused > 0)
    })
    .map(s => {
      const c = counts[s.id]!
      return {
        studentId: s.id,
        fullName:  s.fullName,
        studentNo: s.studentNo,
        className: s.className,
        unexcused: c.unexcused,
        excused:   c.excused,
        risk:      getRisk(c.unexcused),
      }
    })
    .sort((a, b) => {
      if (b.unexcused !== a.unexcused) return b.unexcused - a.unexcused
      return a.fullName.localeCompare(b.fullName, 'tr')
    })
}

const RISK_EXCEL_LABELS: Record<RaporRow['risk'], string> = {
  tehlike: 'Tehlike',
  uyari:   'Uyarı',
  takip:   'Takipte',
}

export function buildExcelRows(rows: RaporRow[]): Record<string, unknown>[] {
  return rows.map((r, i) => ({
    'Sıra':        i + 1,
    'Ad Soyad':    r.fullName,
    'Numara':      r.studentNo ?? '—',
    'Sınıf':       r.className,
    'Özürsüz Gün': `${r.unexcused}g`,
    'Özürlü Gün':  `${r.excused}g`,
    'Durum':       RISK_EXCEL_LABELS[r.risk],
  }))
}
