import { describe, it, expect } from 'vitest'
import { raporDosyaAdi, paylasmaYolu } from '@/src/domains/homework/lib/raporPaylas'

describe('raporDosyaAdi', () => {
  it('sınıf adı + İstanbul günü, dosya adına uygun biçimde', () => {
    // 27 Eyl 22:30 UTC = 28 Eyl İstanbul
    expect(raporDosyaAdi('11-B', new Date('2026-09-27T22:30:00Z'))).toBe('odev-raporu-11-B-2026-09-28.png')
  })

  it('boşluk ve dosya adında sorunlu karakterleri temizler, Türkçe harf kalır', () => {
    expect(raporDosyaAdi('12 SAY/A: Şube', new Date('2026-09-27T09:00:00Z'))).toBe('odev-raporu-12-SAY-A-Şube-2026-09-27.png')
  })

  it('sınıf adı yoksa yalnız tarih', () => {
    expect(raporDosyaAdi('', new Date('2026-09-27T09:00:00Z'))).toBe('odev-raporu-2026-09-27.png')
  })
})

describe('paylasmaYolu', () => {
  const dosya = new File(['x'], 'r.png', { type: 'image/png' })

  it('tarayıcı dosya paylaşımını destekliyorsa paylaşır', () => {
    expect(paylasmaYolu({ canShare: () => true, share: async () => {} }, dosya)).toBe('paylas')
  })

  it('canShare dosyayı reddediyorsa indirir (ör. masaüstü Firefox)', () => {
    expect(paylasmaYolu({ canShare: () => false, share: async () => {} }, dosya)).toBe('indir')
  })

  it('Web Share API hiç yoksa indirir', () => {
    expect(paylasmaYolu({}, dosya)).toBe('indir')
  })
})
