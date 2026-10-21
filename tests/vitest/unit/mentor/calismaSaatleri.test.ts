import { describe, it, expect } from 'vitest'
import {
  kagitDuzeni, netSure, sureKisa, saatYaz, duzenMetni, planlananDk, gorevSaatleri, saatlerVarMi, BOS_SAATLER, type GunSaati,
} from '@/src/domains/mentor/takip/calismaSaatleri'
import type { Gorev } from '@/src/domains/mentor/takip/takipMath'
import { VARSAYILAN_DUZEN } from '@/src/domains/mentor/takip/sablonlar'

const s = (bas: string, bit: string, molaBas?: string, molaBit?: string): GunSaati => ({ bas, bit, ...(molaBas && { molaBas, molaBit }) })
const g = (o: Partial<Gorev> = {}): Gorev => ({
  id: o.ad ?? 'x', gun: 2, ad: 'G', ders: null, miktar: 30, birim: 'dk', soruSatiri: false,
  konu: '', sayfa: '', yapti: false, soru: null, dogru: null, ...o,
})

describe('netSure / sureKisa / saatYaz', () => {
  it('molayı düşer, boş gün 0', () => {
    expect(netSure(s('18:00', '20:30', '19:30', '20:00'))).toBe(120)
    expect(netSure(s('18:00', '20:30'))).toBe(150)
    expect(netSure(null)).toBe(0)
  })
  it('kısa süre yazımı', () => {
    expect(sureKisa(135)).toBe('2 sa 15 dk'); expect(sureKisa(45)).toBe('45 dk'); expect(sureKisa(120)).toBe('2 sa'); expect(sureKisa(0)).toBe('0 dk')
  })
  it('noktalı saat', () => expect(saatYaz('18:05')).toBe('18.05'))
})

describe('saatlerVarMi', () => {
  it('hepsi boş → false, biri dolu → true, null → false', () => {
    expect(saatlerVarMi(BOS_SAATLER)).toBe(false)
    expect(saatlerVarMi(null)).toBe(false)
    expect(saatlerVarMi({ gunler: [null, s('18:00', '19:00'), null, null, null, null, null], not: '' })).toBe(true)
  })
})

describe('duzenMetni', () => {
  const hi = s('18:00', '20:30', '19:30', '20:00')
  it('ardışık aynı günleri birleştirir, mola ve not yazar', () => {
    expect(duzenMetni({ gunler: [hi, hi, hi, hi, hi, s('10:00', '13:00'), null], not: 'Salı kurs var' }))
      .toBe('Pzt–Cum 18.00–20.30 (mola 19.30–20.00) · Cmt 10.00–13.00 · Salı kurs var')
  })
  it('farklı gün araya girerse ayrı yazar', () => {
    expect(duzenMetni({ gunler: [hi, s('19:00', '21:00'), hi, null, null, null, null], not: '' }))
      .toBe('Pzt 18.00–20.30 (mola 19.30–20.00) · Sal 19.00–21.00 · Çar 18.00–20.30 (mola 19.30–20.00)')
  })
  it('boş saatler + boş not → boş', () => expect(duzenMetni(BOS_SAATLER)).toBe(''))
  it('yalnız not', () => expect(duzenMetni({ ...BOS_SAATLER, not: ' Salı kurs ' })).toBe('Salı kurs'))
})

describe('kagitDuzeni', () => {
  const sa = { gunler: [s('18:00', '20:00'), null, null, null, null, null, null], not: '' }
  it('boş ya da eski varsayılan metin → saatlerden; mentör metni aynen', () => {
    expect(kagitDuzeni('', sa)).toBe('Pzt 18.00–20.00')
    expect(kagitDuzeni(VARSAYILAN_DUZEN, sa)).toBe('Pzt 18.00–20.00')
    expect(kagitDuzeni('Kendi metnim', sa)).toBe('Kendi metnim')
    expect(kagitDuzeni('', null)).toBe('')
  })
})

describe('planlananDk', () => {
  it('dk toplar; soru/serbest 0; her gün grubu kendi gününe', () => {
    const gorevler = [
      g({ ad: 'a', gun: 2, miktar: 30 }), g({ ad: 'b', gun: 2, miktar: 15, birim: 'soru' }),
      g({ ad: 'c', gun: 2, miktar: 60, grup: 'h-1' }), g({ ad: 'd', gun: 3, miktar: 60, grup: 'h-1' }),
      g({ ad: 'e', gun: 2, miktar: null, birim: 'serbest' }),
    ]
    expect(planlananDk(gorevler, 2)).toBe(90)
    expect(planlananDk(gorevler, 3)).toBe(60)
  })
})

describe('gorevSaatleri', () => {
  const sat = (gun: GunSaati | null, gorevler: Gorev[]) => gorevSaatleri(gun, gorevler).map(x => [x.gorev.ad, x.saat])
  it('sırayla; molaya denk gelen molanın bitişine kayar; soru sona saatsiz', () => {
    expect(sat(s('18:00', '20:30', '18:30', '19:00'), [g({ ad: 'A', miktar: 30 }), g({ ad: 'C', miktar: 20, birim: 'soru' }), g({ ad: 'B', miktar: 60 })]))
      .toEqual([['A', '18.00'], ['B', '19.00'], ['C', null]])
  })
  it('molayı kesen görev molanın bitişinden başlar', () => {
    expect(sat(s('18:00', '20:30', '18:30', '19:00'), [g({ ad: 'A', miktar: 20 }), g({ ad: 'B', miktar: 30 })]))
      .toEqual([['A', '18.00'], ['B', '19.00']])
  })
  it('saatsiz günde saat yok, sıra yine uygulanır', () => {
    expect(sat(null, [g({ ad: 'A' }), g({ ad: 'S', birim: 'serbest', miktar: null })])).toEqual([['A', null], ['S', null]])
  })
  it('ödev görevleri önce, teslime göre', () => {
    expect(sat(s('18:00', '21:00'), [
      g({ ad: 'El' }), g({ ad: 'O2', odevId: '2', teslim: '2026-10-24' }), g({ ad: 'O1', odevId: '1', teslim: '2026-10-22' }),
    ])).toEqual([['O1', '18.00'], ['O2', '18.30'], ['El', '19.00']])
  })
})
