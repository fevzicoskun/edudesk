import { describe, it, expect } from 'vitest'
import { yoklamaOzetRows } from '@/src/domains/export/services/XlsxBuilder'

describe('yoklamaOzetRows()', () => {
  const detail = [
    { 'Sınıf': '9-A', 'No': '12', 'Ad Soyad': 'Ali Kaya',  'Tarih': '08.06.2026', 'Durum': 'Gelmedi' },
    { 'Sınıf': '9-A', 'No': '12', 'Ad Soyad': 'Ali Kaya',  'Tarih': '09.06.2026', 'Durum': 'Geç Geldi' },
    { 'Sınıf': '9-A', 'No': '12', 'Ad Soyad': 'Ali Kaya',  'Tarih': '10.06.2026', 'Durum': 'Özürlü' },
    { 'Sınıf': '9-A', 'No': '7',  'Ad Soyad': 'Ece Demir', 'Tarih': '08.06.2026', 'Durum': 'Gelmedi' },
  ]

  it('öğrenci başına tek özet satırı üretir', () => {
    const rows = yoklamaOzetRows(detail)
    expect(rows).toHaveLength(2)
  })

  it('durumları sayar ve özürsüz günü hesaplar (geç=0.5)', () => {
    const ali = yoklamaOzetRows(detail).find(r => r['Ad Soyad'] === 'Ali Kaya')!
    expect(ali['Gelmedi']).toBe(1)
    expect(ali['Geç']).toBe(1)
    expect(ali['Özürlü']).toBe(1)
    expect(ali['Özürsüz Gün']).toBe(1.5)
  })

  it('Ece Demir — yalnız 1 gelmedi', () => {
    const ece = yoklamaOzetRows(detail).find(r => r['Ad Soyad'] === 'Ece Demir')!
    expect(ece['Gelmedi']).toBe(1)
    expect(ece['Geç']).toBe(0)
    expect(ece['Özürlü']).toBe(0)
    expect(ece['Özürsüz Gün']).toBe(1)
  })

  it('boş girişte boş döner', () => {
    expect(yoklamaOzetRows([])).toEqual([])
  })
})
