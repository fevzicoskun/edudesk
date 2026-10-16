import { describe, it, expect } from 'vitest'
import { kaydetSchema } from '@/src/domains/mentor/validators/takip'
import { yeniHafta } from '@/src/domains/mentor/takip/takipMath'

const gecerli = () => {
  const h = yeniHafta(null, 9)
  return { studentId: '11111111-1111-4111-8111-111111111111', hafta: '2026-10-19', seviye: h.seviye, soruHedefi: h.soruHedefi, icerik: h.icerik, gorusme: h.gorusme, sonBilinen: null }
}

describe('kaydetSchema', () => {
  it('şablon haftası geçerli', () => expect(kaydetSchema.safeParse(gecerli()).success).toBe(true))
  it('doğru > soru reddedilir', () => {
    const v = gecerli(); v.icerik.gorevler[1] = { ...v.icerik.gorevler[1], soru: 10, dogru: 11 }
    expect(kaydetSchema.safeParse(v).success).toBe(false)
  })
  it('negatif / ondalık soru reddedilir', () => {
    for (const soru of [-1, 2.5]) {
      const v = gecerli(); v.icerik.gorevler[1] = { ...v.icerik.gorevler[1], soru, dogru: 0 }
      expect(kaydetSchema.safeParse(v).success).toBe(false)
    }
  })
  it('pazartesi olmayan hafta reddedilir', () => expect(kaydetSchema.safeParse({ ...gecerli(), hafta: '2026-10-20' }).success).toBe(false))
  it('fazladan özet alanı atılır (istemci özet gönderemez)', () => {
    const r = kaydetSchema.safeParse({ ...gecerli(), ozet: { soru: 9999 } })
    expect(r.success && 'ozet' in r.data).toBe(false)
  })
})
