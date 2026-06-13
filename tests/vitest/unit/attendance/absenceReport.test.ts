import { describe, it, expect } from 'vitest'
import { getRisk, buildReportRows } from '@/src/domains/attendance/lib/absenceReport'
import type { StudentMeta } from '@/src/domains/attendance/lib/absenceReport'

const mkStudent = (id: string, fullName: string, className = '9-A'): StudentMeta => ({
  id, fullName, studentNo: null, className,
})

describe('getRisk()', () => {
  it('14.5 → takip', () => expect(getRisk(14.5)).toBe('takip'))
  it('15 → uyari', ()  => expect(getRisk(15)).toBe('uyari'))
  it('19.5 → uyari', () => expect(getRisk(19.5)).toBe('uyari'))
  it('20 → tehlike', () => expect(getRisk(20)).toBe('tehlike'))
  it('0 → takip', ()  => expect(getRisk(0)).toBe('takip'))
  it('25 → tehlike', () => expect(getRisk(25)).toBe('tehlike'))
})

describe('buildReportRows()', () => {
  it('her ikisi sıfır → hariç', () => {
    expect(buildReportRows({ s1: { unexcused: 0, excused: 0 } }, [mkStudent('s1', 'Ali')])).toHaveLength(0)
  })

  it('sadece excused > 0 → dahil, risk=takip', () => {
    const rows = buildReportRows({ s1: { unexcused: 0, excused: 3 } }, [mkStudent('s1', 'Ali')])
    expect(rows).toHaveLength(1)
    expect(rows[0].risk).toBe('takip')
  })

  it('counts içinde olmayan öğrenci → hariç', () => {
    expect(buildReportRows({}, [mkStudent('s1', 'Ali')])).toHaveLength(0)
  })

  it('unexcused DESC sıralanır', () => {
    const counts = { s1: { unexcused: 10, excused: 0 }, s2: { unexcused: 20, excused: 0 } }
    const rows = buildReportRows(counts, [mkStudent('s1', 'Ali'), mkStudent('s2', 'Berk')])
    expect(rows[0].studentId).toBe('s2')
  })

  it('eşit unexcused → fullName ASC', () => {
    const counts = { s1: { unexcused: 15, excused: 0 }, s2: { unexcused: 15, excused: 0 } }
    const rows = buildReportRows(counts, [mkStudent('s1', 'Zeynep'), mkStudent('s2', 'Ahmet')])
    expect(rows[0].fullName).toBe('Ahmet')
  })

  it('boş input → boş dizi', () => {
    expect(buildReportRows({}, [])).toHaveLength(0)
  })

  it('risk alanları doğru atanır', () => {
    const counts = {
      s1: { unexcused: 20, excused: 0 },
      s2: { unexcused: 15, excused: 0 },
      s3: { unexcused: 5,  excused: 0 },
    }
    const rows = buildReportRows(counts, [mkStudent('s1', 'A'), mkStudent('s2', 'B'), mkStudent('s3', 'C')])
    expect(rows.find(r => r.studentId === 's1')?.risk).toBe('tehlike')
    expect(rows.find(r => r.studentId === 's2')?.risk).toBe('uyari')
    expect(rows.find(r => r.studentId === 's3')?.risk).toBe('takip')
  })
})
