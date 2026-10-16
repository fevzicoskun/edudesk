import { describe, it, expect } from 'vitest'
import {
  seviyeMiktar, sureYaz, miktarYaz, varsayilanHedef, ozetHesapla, programYuzde, dogrulukYuzde, fark,
  yeniHafta, okulOdevleri, haftaDurumu, okumaGecmisi, BOS_GORUSME, type Icerik, type Gorev,
} from '@/src/domains/mentor/takip/takipMath'
import { sinifSablonu, VARSAYILAN_DUZEN, MATEMATIK_KONULARI } from '@/src/domains/mentor/takip/sablonlar'
import type { HomeworkRecord } from '@/src/domains/homework/lib/stats'

const g = (o: Partial<Gorev> = {}): Gorev => ({
  id: 'x', gun: 0, ad: 'G', ders: null, miktar: 60, birim: 'dk', soruSatiri: false,
  konu: '', sayfa: '', yapti: false, soru: null, dogru: null, ...o,
})
const icerik = (o: Partial<Icerik> = {}): Icerik => ({ duzen: '', gorevler: [], mentorOdevleri: [], okuma: null, ...o })

describe('seviyeMiktar', () => {
  it('Normal değişmez', () => expect(seviyeMiktar(45, 1)).toBe(45))
  it('Hafif ×0,7 → 5e yuvarlanır', () => { expect(seviyeMiktar(60, 0)).toBe(40); expect(seviyeMiktar(15, 0)).toBe(10) })
  it('Yoğun ×1,25 → 5e yuvarlanır', () => { expect(seviyeMiktar(60, 2)).toBe(75); expect(seviyeMiktar(45, 2)).toBe(55) })
  it('en az 5', () => expect(seviyeMiktar(5, 0)).toBe(5))
})

describe('sureYaz / miktarYaz', () => {
  it('dakika ve saat biçimleri', () => {
    expect(sureYaz(45)).toBe('45 dk'); expect(sureYaz(60)).toBe('1 saat'); expect(sureYaz(90)).toBe('1,5 saat')
    expect(sureYaz(135)).toBe('2 saat 15 dk'); expect(sureYaz(165)).toBe('2 saat 45 dk')
  })
  it('birim', () => {
    expect(miktarYaz({ miktar: 60, birim: 'dk' }, 2)).toBe('1 saat 15 dk')
    expect(miktarYaz({ miktar: 20, birim: 'soru' }, 1)).toBe('20 soru')
    expect(miktarYaz({ miktar: null, birim: 'serbest' }, 1)).toBe('')
  })
})

describe('varsayilanHedef', () => {
  it('9–10 ve 11–12', () => {
    expect([0, 1, 2].map(s => varsayilanHedef(9, s as 0))).toEqual([120, 200, 300])
    expect([0, 1, 2].map(s => varsayilanHedef(12, s as 0))).toEqual([200, 300, 400])
  })
})

describe('ozet / yüzdeler', () => {
  it('görev + mentör ödevi sayılır, soru yalnız soru satırlarından', () => {
    const o = ozetHesapla(icerik({
      gorevler: [g({ yapti: true, soruSatiri: true, soru: 40, dogru: 30 }), g({ soru: 99, dogru: 99 }), g()],
      mentorOdevleri: [{ id: 'm', kitapId: null, kitapAdi: 'K', konu: '', sayfalar: '', yapti: true }],
      okuma: { kitap: 'R', sayfa: 120, bitti: false },
    }))
    expect(o).toEqual({ gorev_toplam: 4, gorev_yapilan: 2, soru: 40, dogru: 30, okuma_sayfa: 120, islendi: true })
    expect(programYuzde(o)).toBe(50); expect(dogrulukYuzde(o)).toBe(75)
  })
  it('payda 0 → null', () => {
    const o = ozetHesapla(icerik())
    expect(programYuzde(o)).toBeNull(); expect(dogrulukYuzde(o)).toBeNull(); expect(o.islendi).toBe(false)
  })
  it('fark yalnız iki hafta da işlendiyse', () => {
    const bu = { gorev_toplam: 1, gorev_yapilan: 1, soru: 100, dogru: 80, okuma_sayfa: 0, islendi: true }
    expect(fark(bu, { ...bu, dogru: 70 })).toBe(10)
    expect(fark(bu, { ...bu, islendi: false })).toBeNull()
    expect(fark(bu, null)).toBeNull()
  })
})

describe('yeniHafta', () => {
  it('önceki yoksa sınıf şablonu + Hafif + varsayılan hedef', () => {
    const h = yeniHafta(null, 10)
    expect(h.seviye).toBe(0); expect(h.soruHedefi).toBe(120)
    expect(h.icerik.gorevler).toEqual(sinifSablonu(10)); expect(h.icerik.duzen).toBe(VARSAYILAN_DUZEN)
    expect(h.gorusme).toEqual(BOS_GORUSME)
  })
  it('öncekinden görevler sonuçsuz kopyalanır; mentör ödevi, görüşme, bitmiş kitap taşınmaz', () => {
    const onceki = {
      seviye: 2 as const, soruHedefi: 350,
      icerik: icerik({ duzen: 'D', gorevler: [g({ yapti: true, konu: 'Türev', sayfa: '4', soru: 5, dogru: 4 })],
        mentorOdevleri: [{ id: 'm', kitapId: null, kitapAdi: 'K', konu: '', sayfalar: '', yapti: true }],
        okuma: { kitap: 'R', sayfa: 50, bitti: true } }),
      gorusme: { ...BOS_GORUSME, hedef: 'H' },
    }
    const h = yeniHafta(onceki, 11)
    expect(h.seviye).toBe(2); expect(h.soruHedefi).toBe(350); expect(h.icerik.duzen).toBe('D')
    expect(h.icerik.gorevler[0]).toEqual(g({}))
    expect(h.icerik.mentorOdevleri).toEqual([]); expect(h.icerik.okuma).toBeNull(); expect(h.gorusme).toEqual(BOS_GORUSME)
  })
  it('bitmemiş kitap sayfası boş olarak taşınır', () => {
    const h = yeniHafta({ seviye: 1, soruHedefi: 200, icerik: icerik({ okuma: { kitap: 'R', sayfa: 50, bitti: false } }), gorusme: BOS_GORUSME }, 9)
    expect(h.icerik.okuma).toEqual({ kitap: 'R', sayfa: null, bitti: false })
  })
})

describe('okulOdevleri / haftaDurumu', () => {
  const k = (id: string, due: string | null): HomeworkRecord =>
    ({ id, title: id, subject: 'Fizik', due_date: due, status: null, note: null, teacher_id: 't', bekliyor: true } as HomeworkRecord)
  it('Pzt–Paz arası, tarihe göre', () => {
    expect(okulOdevleri([k('b', '2026-10-25'), k('a', '2026-10-19'), k('d', '2026-10-26'), k('n', null)], '2026-10-19').map(o => o.id))
      .toEqual(['a', 'b'])
  })
  it('durum', () => {
    expect(haftaDurumu(null)).toBe('yok'); expect(haftaDurumu({ islendi: false })).toBe('kagitta'); expect(haftaDurumu({ islendi: true })).toBe('islendi')
  })
})

describe('şablonlar', () => {
  it('her sınıfta benzersiz id, gün 0–6', () => {
    for (const s of [9, 10, 11, 12]) {
      const t = sinifSablonu(s)
      expect(new Set(t.map(x => x.id)).size).toBe(t.length)
      expect(t.every(x => x.gun >= 0 && x.gun <= 6)).toBe(true)
    }
  })
  it('matematik satırları ders=Matematik; paragraf soru satırı', () => {
    const t = sinifSablonu(9)
    expect(t.filter(x => x.ad === 'Paragraf').every(x => x.soruSatiri && x.birim === 'soru')).toBe(true)
    expect(t.find(x => x.ad === 'Matematik: yanlışların çözümü')).toMatchObject({ ders: 'Matematik', soruSatiri: false })
  })
  it('konu listeleri dolu', () => { for (const s of [9, 10, 11, 12] as const) expect(MATEMATIK_KONULARI[s].length).toBeGreaterThan(5) })
})

describe('okumaGecmisi', () => {
  it('aynı kitap birleşir, sayfalar toplanır, bitti işaretlenir', () => {
    expect(okumaGecmisi([
      { hafta: '2026-10-05', okuma: { kitap: 'A', sayfa: 50, bitti: false } },
      { hafta: '2026-10-12', okuma: { kitap: 'A', sayfa: 70, bitti: true } },
      { hafta: '2026-10-19', okuma: { kitap: 'B', sayfa: null, bitti: false } },
      { hafta: '2026-10-26', okuma: null },
    ])).toEqual([
      { kitap: 'A', bas: '2026-10-05', son: '2026-10-12', sayfa: 120, bitti: true },
      { kitap: 'B', bas: '2026-10-19', son: '2026-10-19', sayfa: 0, bitti: false },
    ])
  })
})
