import { describe, it, expect } from 'vitest'
import { denemeGidisi, haftaSatiri } from '@/src/domains/mentor/lib/veliToplantisi'
import { durumOf, durumYuzdesi } from '@/app/(dashboard)/mentorluk/[studentId]/takip/SonucKagidi'
import type { Gorev, Icerik } from '@/src/domains/mentor/takip/takipMath'

const d = (n: number) => [{ kod: 'TAR', ss: 26, d: 0, y: 0, n }]
const sinav = (id: string, tarih: string, siniflar = ['9A']) => ({ id, tur: 'TCD' as const, tarih, siniflar })

describe('denemeGidisi', () => {
  it('eskiden yeniye; katılmadı satırı 0 değil, değişim katıldığı bir öncekine göre', () => {
    const g = denemeGidisi([sinav('s3', '2026-11-20'), sinav('s1', '2026-10-01'), sinav('s2', '2026-10-30')],
      [{ sinavId: 's1', dersler: d(30), toplamNet: 30 }, { sinavId: 's3', dersler: d(33.5), toplamNet: 33.5 }], '9A')
    expect(g.TCD.map(x => [x.tarih, x.katilmadi, x.toplamNet, x.degisim])).toEqual([
      ['2026-10-01', false, 30, null],
      ['2026-10-30', true, null, null],
      ['2026-11-20', false, 33.5, 3.5],
    ])
    expect(g.TM).toEqual([])
  })
  it('yalnız başka sınıf için yüklenen sınav öğrencide görünmez', () => {
    expect(denemeGidisi([sinav('s1', '2026-10-01', ['9B'])], [], '9A').TCD).toEqual([])
  })
  it('negatif net: −2 → 2,5 değişim 4,5', () => {
    const g = denemeGidisi([sinav('a', '2026-10-01'), sinav('b', '2026-10-15')],
      [{ sinavId: 'a', dersler: d(-2), toplamNet: -2 }, { sinavId: 'b', dersler: d(2.5), toplamNet: 2.5 }], '9A')
    expect(g.TCD[1].degisim).toBe(4.5)
  })
})

const gorev = (yapti: boolean): Gorev => ({ id: Math.random().toString(36), gun: 0, ad: 'G', ders: null, miktar: 30, birim: 'dk', soruSatiri: false, konu: '', sayfa: '', yapti, soru: null, dogru: null })
const icerik = (gorevler: Gorev[], cozulen: number | null = null): Icerik => ({
  duzen: '', gorevler, mentorOdevleri: [], okuma: null,
  sonuclar: cozulen === null ? [] : [{ anahtar: 'd:Matematik', ad: 'Matematik', ders: 'Matematik', sayfa: '', cozulen, dogru: cozulen, yanlis: 0, bos: 0 }],
})

describe('haftaSatiri (sonuç kâğıdıyla aynı hesap)', () => {
  it('sonuç girilmemiş hafta: girilmedi, 0 değil', () => {
    expect(haftaSatiri('2026-10-23', icerik([gorev(false), gorev(false)]), 120))
      .toEqual({ hafta: '2026-10-23', girilmedi: true, program: null, soru: null, hedef: 120, durum: null })
  })
  it('%72 program + 96/120 soru → sonuç kâğıdının etiketi', () => {
    const gs = [...Array(18)].map(() => gorev(true)).concat([...Array(7)].map(() => gorev(false)))
    const s = haftaSatiri('2026-10-23', icerik(gs, 96), 120)
    expect(s).toMatchObject({ girilmedi: false, program: 72, soru: 96, durum: durumOf(durumYuzdesi(72, 96, 120)!) })
  })
  it('program yapılmış ama soru girilmemiş: soru null (girilmedi), durum yalnız programdan', () => {
    const s = haftaSatiri('2026-10-23', icerik([gorev(true), gorev(true)]), 120)
    expect(s).toMatchObject({ girilmedi: false, program: 100, soru: null, durum: 'iyi' })
  })
})
