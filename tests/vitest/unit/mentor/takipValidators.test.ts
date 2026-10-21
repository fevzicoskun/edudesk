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
  it('görevde kitap + sayfa aralığı geçerli; ters aralık reddedilir', () => {
    const v = gecerli(); v.icerik.gorevler[1] = { ...v.icerik.gorevler[1], kitapId: '22222222-2222-4222-8222-222222222222', kitapAdi: 'Acil Mat', sayfaBas: 45, sayfaSon: 60 }
    expect(kaydetSchema.safeParse(v).success).toBe(true)
    v.icerik.gorevler[1] = { ...v.icerik.gorevler[1], sayfaBas: 60, sayfaSon: 45 }
    expect(kaydetSchema.safeParse(v).success).toBe(false)
  })
  it("sonuç satırı: D ≤ Ç zorunlu, Ç'siz doğru reddedilir; D+Y+B > Ç yalnız uyarı (kabul)", () => {
    const satir = (o: object) => ({ anahtar: 'k:x', ad: 'A', ders: 'Matematik', sayfa: '', cozulen: 40, dogru: 30, yanlis: 8, bos: 2, ...o })
    const v = gecerli()
    expect(kaydetSchema.safeParse({ ...v, icerik: { ...v.icerik, sonuclar: [satir({})] } }).success).toBe(true)
    expect(kaydetSchema.safeParse({ ...v, icerik: { ...v.icerik, sonuclar: [satir({ yanlis: 20 })] } }).success).toBe(true)
    expect(kaydetSchema.safeParse({ ...v, icerik: { ...v.icerik, sonuclar: [satir({ dogru: 41 })] } }).success).toBe(false)
    expect(kaydetSchema.safeParse({ ...v, icerik: { ...v.icerik, sonuclar: [satir({ cozulen: null })] } }).success).toBe(false)
  })
  it('pazartesi olmayan hafta reddedilir', () => expect(kaydetSchema.safeParse({ ...gecerli(), hafta: '2026-10-20' }).success).toBe(false))
  it('fazladan özet alanı atılır (istemci özet gönderemez)', () => {
    const r = kaydetSchema.safeParse({ ...gecerli(), ozet: { soru: 9999 } })
    expect(r.success && 'ozet' in r.data).toBe(false)
  })
})

describe('kaydetSchema — otomatik ödev görevi (2026-10-21)', () => {
  const OID = '33333333-3333-4333-8333-333333333333'
  it('odevId + teslim + gizliOdevler geçer', () => {
    const v = gecerli()
    v.icerik = { ...v.icerik, gizliOdevler: [OID], gorevler: [...v.icerik.gorevler, { ...v.icerik.gorevler[0], id: `o-${OID}`, grup: undefined, odevId: OID, teslim: '2026-10-22' }] }
    expect(kaydetSchema.safeParse(v).success).toBe(true)
  })
  it('geçersiz odevId / teslim reddedilir', () => {
    for (const ek of [{ odevId: 'x' }, { odevId: OID, teslim: '22.10.2026' }]) {
      const v = gecerli(); v.icerik.gorevler[0] = { ...v.icerik.gorevler[0], ...ek }
      expect(kaydetSchema.safeParse(v).success).toBe(false)
    }
  })
})
