import { describe, it, expect } from 'vitest'
import {
  seviyeMiktar, sureYaz, miktarYaz, varsayilanHedef, ozetHesapla, programYuzde, dogrulukYuzde, fark,
  yeniHafta, okulOdevleri, okulOdevBolumleri, okulDurumYaz, haftaDurumu, okumaGecmisi, kitapSayfaYaz, sonucSatirlari, sonucNet, sonucDogruluk, sonucUyarisi, dersDogruluk,
  planKopyala, takipHaftaEtiketi, gecenHaftaOzeti, BOS_GORUSME, type Icerik, type Gorev,
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
  it('üç bölüm: tamamlanmamış (yapılmadı + teslimi geçmiş), bu hafta, gelecek hafta (2026-10-17)', () => {
    const d = (id: string, due: string | null, status: HomeworkRecord['status']) => ({ ...k(id, due), status })
    const b = okulOdevBolumleri([
      d('eskiYapilmadi', '2026-10-08', 'yapilmadi'), d('eskiYapildi', '2026-10-09', 'yapildi'), d('eskiEksik', '2026-10-10', 'eksik'),
      d('eskiIsaretsiz', '2026-10-12', null), d('buHafta', '2026-10-21', null), d('buHaftaYapilmadi', '2026-10-20', 'yapilmadi'),
      d('gelecek', '2026-10-27', null), d('gelecekSonu', '2026-11-01', null), d('cokIleri', '2026-11-02', null), d('tarihsiz', null, 'yapilmadi'),
    ], '2026-10-19')
    expect(b.tamamlanmamis.map(o => o.id)).toEqual(['eskiYapilmadi'])
    expect(b.buHafta.map(o => o.id)).toEqual(['buHaftaYapilmadi', 'buHafta'])
    expect(b.gelecek.map(o => o.id)).toEqual(['gelecek', 'gelecekSonu'])
  })
  it('teslim durumu yalnız öğretmen işaretinden', () => {
    const o = (status: string | null) => ({ id: 'x', subject: 'F', title: 'T', due_date: '2026-10-20', status, bekliyor: false })
    expect(okulDurumYaz(o('yapildi'))).toBe('Yapıldı'); expect(okulDurumYaz(o('gec'))).toBe('Yapıldı (geç)')
    expect(okulDurumYaz(o('yapilmadi'))).toBe('Yapılmadı'); expect(okulDurumYaz(o(null))).toBe('Henüz işaretlenmedi')
    expect(okulDurumYaz(o('eksik'))).toBe('Eksik'); expect(okulDurumYaz(o('mazeretli'))).toBe('Mazeretli')
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

// studyPlan/planMath'ten taşındı (2026-10-16: eski çalışma planı kaldırıldı)
describe('haftaBasi / haftaKaydir', async () => {
  const { haftaBasi, haftaKaydir } = await import('@/src/domains/mentor/takip/takipMath')
  it('Pazartesi kendisi', () => expect(haftaBasi('2026-09-07')).toBe('2026-09-07'))
  it('Çarşamba → Pazartesi', () => expect(haftaBasi('2026-09-09')).toBe('2026-09-07'))
  it('Pazar → önceki Pazartesi (getDay=0 tuzağı)', () => expect(haftaBasi('2026-09-13')).toBe('2026-09-07'))
  it('yıl geçişi: 2027-01-01 (Cuma) → 2026-12-28', () => expect(haftaBasi('2027-01-01')).toBe('2026-12-28'))
  it('+1 hafta', () => expect(haftaKaydir('2026-09-07', 1)).toBe('2026-09-14'))
  it('-1 hafta yıl geçişi', () => expect(haftaKaydir('2027-01-04', -1)).toBe('2026-12-28'))
})

describe('kitapSayfaYaz (görev satırı, 2026-10-17)', () => {
  it('kitap + sayfa aralığı', () => expect(kitapSayfaYaz(g({ kitapId: 'k', kitapAdi: 'Acil Mat', sayfaBas: 45, sayfaSon: 60 }))).toBe('Acil Mat s. 45–60'))
  it('tek sayfa', () => expect(kitapSayfaYaz(g({ kitapId: 'k', kitapAdi: 'Acil Mat', sayfaBas: 45, sayfaSon: 45 }))).toBe('Acil Mat s. 45'))
  it('sayfasız kitap', () => expect(kitapSayfaYaz(g({ kitapId: 'k', kitapAdi: 'Acil Mat' }))).toBe('Acil Mat'))
  it('kitapsız görevde eski serbest sayfa metni', () => expect(kitapSayfaYaz(g({ sayfa: 's. 12' }))).toBe('s. 12'))
  it('eski kayıt (alan yok) boş', () => expect(kitapSayfaYaz(g())).toBe(''))
})

describe('soru sonuçları: kitap/ders başına tek satır (2026-10-17)', () => {
  const kitaplar = [{ id: 'k1', ders: 'Matematik' }, { id: 'k2', ders: '' }]
  const plan = icerik({ gorevler: [
    g({ id: 'a', soruSatiri: true, ders: 'Matematik', kitapId: 'k1', kitapAdi: 'Acil Mat', sayfaBas: 45, sayfaSon: 50 }),
    g({ id: 'b', soruSatiri: true, ders: 'Matematik', kitapId: 'k1', kitapAdi: 'Acil Mat', sayfaBas: 51, sayfaSon: 60 }),
    g({ id: 'c', soruSatiri: true, ders: 'Türkçe', ad: 'Paragraf' }),
    g({ id: 'd', soruSatiri: true, ders: 'Türkçe', ad: 'Paragraf' }),
    g({ id: 'e', soruSatiri: true, ders: null, ad: 'TYT denemesi' }),
    g({ id: 'f', soruSatiri: true, ders: 'Fizik', kitapId: 'k2', kitapAdi: 'Fizik SB' }),
    g({ id: 'x', soruSatiri: false, ders: 'Matematik', kitapId: 'k1', kitapAdi: 'Acil Mat', sayfaBas: 1, sayfaSon: 99 }),
  ] })

  it('kitap başına bir satır (sayfa aralığı birleşir), kitapsız soru görevleri derse göre; soru satırı olmayan görev girmez', () => {
    expect(sonucSatirlari(plan, kitaplar).map(s => [s.anahtar, s.ad, s.ders, s.sayfa])).toEqual([
      ['k:k1', 'Acil Mat', 'Matematik', 's. 45–60'],
      ['d:Türkçe', 'Türkçe', 'Türkçe', ''],
      ['d:TYT denemesi', 'TYT denemesi', 'Diğer', ''],
      ['k:k2', 'Fizik SB', 'Fizik', ''],
    ])
  })
  it('girilmiş sayılar anahtarla eşleşir; plandan çıkan satırın girilmiş sonucu kaybolmaz', () => {
    const s = sonucSatirlari({ ...plan, sonuclar: [
      { anahtar: 'k:k1', ad: 'Acil Mat', ders: 'Matematik', sayfa: 's. 45–60', cozulen: 40, dogru: 30, yanlis: 8, bos: 2 },
      { anahtar: 'k:eski', ad: 'Eski kitap', ders: 'Kimya', sayfa: '', cozulen: 10, dogru: 5, yanlis: 5, bos: 0 },
    ] }, kitaplar)
    expect(s[0]).toMatchObject({ cozulen: 40, dogru: 30, yanlis: 8, bos: 2 })
    expect(s[1]).toMatchObject({ cozulen: null, dogru: null })
    expect(s.at(-1)).toMatchObject({ anahtar: 'k:eski', cozulen: 10 })
  })
  it('net = D − Y/4, doğruluk = D/Ç; boş satırda null', () => {
    expect(sonucNet({ dogru: 30, yanlis: 8 })).toBe(28)
    expect(sonucNet({ dogru: null, yanlis: null })).toBeNull()
    expect(sonucDogruluk({ cozulen: 40, dogru: 30 })).toBe(75)
    expect(sonucDogruluk({ cozulen: 0, dogru: 0 })).toBeNull()
  })
  it('D+Y+B Çözülen\'i geçerse uyarı', () => {
    expect(sonucUyarisi({ cozulen: 40, dogru: 30, yanlis: 8, bos: 2 })).toBeNull()
    expect(sonucUyarisi({ cozulen: 40, dogru: 30, yanlis: 9, bos: 2 })).toMatch(/41/)
  })
  it('özet soru/doğru sonuç satırlarından (eski görev bazlı girişlerle toplanır); sonuç girilince işlendi', () => {
    const o = ozetHesapla({ ...plan, sonuclar: [
      { anahtar: 'k:k1', ad: 'Acil Mat', ders: 'Matematik', sayfa: '', cozulen: 40, dogru: 30, yanlis: 8, bos: 2 },
      { anahtar: 'd:Türkçe', ad: 'Türkçe', ders: 'Türkçe', sayfa: '', cozulen: 20, dogru: 18, yanlis: null, bos: null },
    ] })
    expect(o).toMatchObject({ soru: 60, dogru: 48, islendi: true })
  })
  it('ders bazında doğruluk', () => {
    expect(dersDogruluk([
      { anahtar: 'k:k1', ad: 'A', ders: 'Matematik', sayfa: '', cozulen: 40, dogru: 30, yanlis: null, bos: null },
      { anahtar: 'k:k3', ad: 'B', ders: 'Matematik', sayfa: '', cozulen: 60, dogru: 40, yanlis: null, bos: null },
      { anahtar: 'd:Türkçe', ad: 'Türkçe', ders: 'Türkçe', sayfa: '', cozulen: 20, dogru: 18, yanlis: null, bos: null },
      { anahtar: 'd:Fizik', ad: 'Fizik', ders: 'Fizik', sayfa: '', cozulen: null, dogru: null, yanlis: null, bos: null },
    ])).toEqual([{ ders: 'Matematik', cozulen: 100, dogru: 70, yuzde: 70 }, { ders: 'Türkçe', cozulen: 20, dogru: 18, yuzde: 90 }])
  })
  it('yeni hafta sonuçları taşımaz', () => {
    const h = yeniHafta({ seviye: 1, soruHedefi: 200, icerik: { ...plan, sonuclar: [{ anahtar: 'k:k1', ad: 'A', ders: 'M', sayfa: '', cozulen: 1, dogru: 1, yanlis: 0, bos: 0 }] }, gorusme: BOS_GORUSME }, 9)
    expect(h.icerik.sonuclar ?? []).toEqual([])
  })
})

describe('planKopyala: kitap sayfası kaldığı yerden devam (2026-10-17)', () => {
  const onceki = (gorevler: Gorev[]) => ({ seviye: 2 as const, soruHedefi: 350, icerik: icerik({ duzen: 'D', gorevler,
    sonuclar: [{ anahtar: 'k:k1', ad: 'A', ders: 'M', sayfa: '', cozulen: 1, dogru: 1, yanlis: 0, bos: 0 }] }), gorusme: { ...BOS_GORUSME, iyi: 'x' } })
  it('tek görev 45–60 → 61–76', () => {
    const h = planKopyala(onceki([g({ kitapId: 'k1', kitapAdi: 'A', sayfaBas: 45, sayfaSon: 60, yapti: true })]))
    expect(h.icerik.gorevler[0]).toMatchObject({ kitapId: 'k1', sayfaBas: 61, sayfaSon: 76, yapti: false })
  })
  it('aynı kitap iki görevde (45–50, 51–56) → blok birlikte kayar (57–62, 63–68); başka kitap kendi aralığıyla', () => {
    const h = planKopyala(onceki([
      g({ id: 'a', kitapId: 'k1', sayfaBas: 45, sayfaSon: 50 }), g({ id: 'b', kitapId: 'k1', sayfaBas: 51, sayfaSon: 56 }),
      g({ id: 'c', kitapId: 'k2', sayfaBas: 10, sayfaSon: 10 }), g({ id: 'd', kitapId: 'k3' }),
    ]))
    expect(h.icerik.gorevler.map(x => [x.sayfaBas, x.sayfaSon])).toEqual([[57, 62], [63, 68], [11, 11], [undefined, undefined]])
  })
  it('seviye, hedef, düzen taşınır; sonuç ve görüşme taşınmaz', () => {
    const h = planKopyala(onceki([g()]))
    expect([h.seviye, h.soruHedefi, h.icerik.duzen]).toEqual([2, 350, 'D'])
    expect(h.icerik.sonuclar ?? []).toEqual([]); expect(h.gorusme).toEqual(BOS_GORUSME)
  })
  it('yeni haftanın otomatik taslağı da sayfayı devam ettirir', () => {
    expect(yeniHafta(onceki([g({ kitapId: 'k1', sayfaBas: 45, sayfaSon: 60 })]), 9).icerik.gorevler[0]).toMatchObject({ sayfaBas: 61, sayfaSon: 76 })
  })
})

describe('takipHaftaEtiketi: plan Cmt/Paz da kapsar → Pzt–Paz (2026-10-17)', () => {
  it('aynı ay', () => expect(takipHaftaEtiketi('2026-10-12')).toBe('12–18 Ekim'))
  it('ay geçişi', () => expect(takipHaftaEtiketi('2026-10-26')).toBe('26 Ekim – 1 Kasım'))
})

describe('gecenHaftaOzeti (mentörlük tablosu "Geçen hafta")', () => {
  it('işlenmemiş ya da kayıt yok → null', () => {
    expect(gecenHaftaOzeti(null)).toBeNull()
    expect(gecenHaftaOzeti({ islendi: false, gorev_toplam: 10, gorev_yapilan: 0, soru: 0, dogru: 0 })).toBeNull()
  })
  it('program ve doğruluk yüzdesi; soru yoksa doğruluk null', () => {
    expect(gecenHaftaOzeti({ islendi: true, gorev_toplam: 24, gorev_yapilan: 18, soru: 40, dogru: 18 })).toEqual({ program: 75, dogruluk: 45 })
    expect(gecenHaftaOzeti({ islendi: true, gorev_toplam: 4, gorev_yapilan: 1, soru: 0, dogru: 0 })).toEqual({ program: 25, dogruluk: null })
  })
})
