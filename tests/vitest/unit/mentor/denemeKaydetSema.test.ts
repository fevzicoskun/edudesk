import { describe, it, expect } from 'vitest'
import { denemeKaydetSema } from '@/src/domains/mentor/deneme/denemeSema'

const U = '11111111-1111-4111-8111-111111111111'
const gecerli = {
  tur: 'TCD', seviye: 9, tarih: '2026-10-20', sinifId: U,
  sonuclar: [{ studentId: U, dersler: [{ kod: 'TAR', ss: 26, d: 21, y: 5, n: 19.75 }], toplamNet: 51.75, puan: 448.309 }],
}

describe('denemeKaydetSema', () => {
  it('geçerli girdi kabul, negatif toplam net kabul', () => {
    expect(denemeKaydetSema.safeParse(gecerli).success).toBe(true)
    expect(denemeKaydetSema.safeParse({ ...gecerli, sonuclar: [{ ...gecerli.sonuclar[0], toplamNet: -12.5 }] }).success).toBe(true)
  })
  it('gelecek tarih, bilinmeyen tür, 61 sonuç reddedilir', () => {
    expect(denemeKaydetSema.safeParse({ ...gecerli, tarih: '2099-01-01' }).success).toBe(false)
    expect(denemeKaydetSema.safeParse({ ...gecerli, tur: 'GENEL' }).success).toBe(false)
    expect(denemeKaydetSema.safeParse({ ...gecerli, sonuclar: Array(61).fill(gecerli.sonuclar[0]) }).success).toBe(false)
  })
  it('sıfır sonuç kabul (herkes katılmadı), 4 ders reddedilir', () => {
    expect(denemeKaydetSema.safeParse({ ...gecerli, sonuclar: [] }).success).toBe(true)
    const d = gecerli.sonuclar[0].dersler[0]
    expect(denemeKaydetSema.safeParse({ ...gecerli, sonuclar: [{ ...gecerli.sonuclar[0], dersler: [d, d, d, d] }] }).success).toBe(false)
  })
})
