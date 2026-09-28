import { describe, it, expect } from 'vitest'
import { aktifMi, gunOnce, AKTIF_GUN } from '@/src/domains/dashboard/lib/aktiflik'

describe('gunOnce — YYYY-MM-DD gün aritmetiği (saat dilimi etkisiz)', () => {
  it('ay ve yıl sınırını doğru geçer', () => {
    expect(gunOnce('2026-09-29', 0)).toBe('2026-09-29')
    expect(gunOnce('2026-09-29', 13)).toBe('2026-09-16')
    expect(gunOnce('2026-10-05', 10)).toBe('2026-09-25')
    expect(gunOnce('2026-01-03', 5)).toBe('2025-12-29')
    expect(gunOnce('2024-03-01', 1)).toBe('2024-02-29') // artık yıl
  })
})

describe('aktifMi — son 14 gün (bugün dahil) içinde uygulamayı kullanan öğretmen aktiftir', () => {
  const bugun = '2026-09-29'
  it('pencere 14 gün', () => expect(AKTIF_GUN).toBe(14))

  it('bugün ya da pencerenin ilk günü kullandıysa aktif', () => {
    expect(aktifMi('2026-09-29', bugun)).toBe(true)
    expect(aktifMi('2026-09-16', bugun)).toBe(true) // 14. gün (bugün dahil)
  })

  it('pencerenin dışındaysa ya da hiç kullanım yoksa pasif', () => {
    expect(aktifMi('2026-09-15', bugun)).toBe(false)
    expect(aktifMi(undefined, bugun)).toBe(false)
    expect(aktifMi(null, bugun)).toBe(false)
  })
})
