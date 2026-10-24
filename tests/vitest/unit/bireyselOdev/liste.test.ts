import { describe, it, expect } from 'vitest'
import { gecikmisMi, listeSirala, filtrele, ekleSema, duzenleSema, type BireyselOdev } from '@/src/domains/bireyselOdev/lib/liste'

const BUGUN = '2026-10-24'
const o = (id: string, p: Partial<BireyselOdev> = {}): BireyselOdev => ({
  id, ogrenciId: 's', ogrenciAd: 'Ali', sinifId: 'c', sinifAd: '9-A', aciklama: id, teslimTarihi: null,
  yapildi: false, yapildiTarihi: null, olusturmaTarihi: '2026-10-20T08:00:00Z', ...p,
})

describe('gecikmisMi', () => {
  it('teslim geçmiş ve yapılmamış → gecikmiş; bugün teslim, tarihsiz ya da yapılmış değil', () => {
    expect(gecikmisMi(o('a', { teslimTarihi: '2026-10-23' }), BUGUN)).toBe(true)
    expect(gecikmisMi(o('b', { teslimTarihi: BUGUN }), BUGUN)).toBe(false)
    expect(gecikmisMi(o('c'), BUGUN)).toBe(false)
    expect(gecikmisMi(o('d', { teslimTarihi: '2026-10-01', yapildi: true }), BUGUN)).toBe(false)
  })
})

describe('listeSirala', () => {
  it('gecikmişler üstte (en eski teslim önce), sonra bekleyenler teslime göre (tarihsiz sonda), en altta yapılanlar', () => {
    const l = listeSirala([
      o('yapildi', { yapildi: true, teslimTarihi: '2026-10-01', yapildiTarihi: '2026-10-02T00:00:00Z' }),
      o('tarihsiz'),
      o('yarin', { teslimTarihi: '2026-10-25' }),
      o('gec2', { teslimTarihi: '2026-10-22' }),
      o('gec1', { teslimTarihi: '2026-10-10' }),
      o('haftaya', { teslimTarihi: '2026-10-31' }),
    ], BUGUN)
    expect(l.map(x => x.id)).toEqual(['gec1', 'gec2', 'yarin', 'haftaya', 'tarihsiz', 'yapildi'])
  })
  it('tarihsiz bekleyenler yeniden eskiye', () => {
    const l = listeSirala([o('eski', { olusturmaTarihi: '2026-10-01T00:00:00Z' }), o('yeni', { olusturmaTarihi: '2026-10-22T00:00:00Z' })], BUGUN)
    expect(l.map(x => x.id)).toEqual(['yeni', 'eski'])
  })
})

describe('filtrele', () => {
  it('bekleyenler yalnız yapılmamışlar; tümü hepsi', () => {
    const l = [o('a'), o('b', { yapildi: true })]
    expect(filtrele(l, 'bekleyen').map(x => x.id)).toEqual(['a'])
    expect(filtrele(l, 'tumu')).toHaveLength(2)
  })
})

describe('ekleSema / duzenleSema', () => {
  const U = '11111111-1111-4111-8111-111111111111'
  it('açıklama kırpılır, boş teslim null olur', () => {
    expect(ekleSema.parse({ ogrenciId: U, aciklama: '  Türev testi ', teslimTarihi: '' }))
      .toEqual({ ogrenciId: U, aciklama: 'Türev testi', teslimTarihi: null })
  })
  it('boş açıklama, 300+ karakter, bozuk tarih reddedilir', () => {
    expect(ekleSema.safeParse({ ogrenciId: U, aciklama: '   ', teslimTarihi: '' }).success).toBe(false)
    expect(ekleSema.safeParse({ ogrenciId: U, aciklama: 'x'.repeat(301), teslimTarihi: '' }).success).toBe(false)
    expect(ekleSema.safeParse({ ogrenciId: U, aciklama: 'a', teslimTarihi: '30.10.2026' }).success).toBe(false)
    expect(ekleSema.safeParse({ ogrenciId: 'x', aciklama: 'a', teslimTarihi: '' }).success).toBe(false)
  })
  it('düzenleme kimlik ister', () => {
    expect(duzenleSema.parse({ id: U, aciklama: 'b', teslimTarihi: '2026-10-30' })).toEqual({ id: U, aciklama: 'b', teslimTarihi: '2026-10-30' })
    expect(duzenleSema.safeParse({ aciklama: 'b', teslimTarihi: '' }).success).toBe(false)
  })
})
