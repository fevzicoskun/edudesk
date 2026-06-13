import { describe, it, expect } from 'vitest'
import { buildExcelRows } from '@/src/domains/attendance/lib/absenceReport'
import type { RaporRow } from '@/src/domains/attendance/lib/absenceReport'

const base: RaporRow = {
  studentId: 's1', fullName: 'Ali Yılmaz', studentNo: '101',
  className: '9-A', unexcused: 22, excused: 1, risk: 'tehlike',
}

describe('buildExcelRows()', () => {
  it('unexcused=22 → "22g"', () => {
    expect(buildExcelRows([base])[0]['Özürsüz Gün']).toBe('22g')
  })

  it('excused=0 → "0g"', () => {
    expect(buildExcelRows([{ ...base, excused: 0 }])[0]['Özürlü Gün']).toBe('0g')
  })

  it('tehlike → "Tehlike"', () => {
    expect(buildExcelRows([base])[0]['Durum']).toBe('Tehlike')
  })

  it('uyari → "Uyarı"', () => {
    expect(buildExcelRows([{ ...base, unexcused: 15, risk: 'uyari' }])[0]['Durum']).toBe('Uyarı')
  })

  it('takip → "Takipte"', () => {
    expect(buildExcelRows([{ ...base, unexcused: 5, risk: 'takip' }])[0]['Durum']).toBe('Takipte')
  })

  it("Sıra 1'den başlar", () => {
    expect(buildExcelRows([base])[0]['Sıra']).toBe(1)
  })

  it('boş liste → boş dizi', () => {
    expect(buildExcelRows([])).toHaveLength(0)
  })

  it('studentNo null → "—"', () => {
    expect(buildExcelRows([{ ...base, studentNo: null }])[0]['Numara']).toBe('—')
  })
})
