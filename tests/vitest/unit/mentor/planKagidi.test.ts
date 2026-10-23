import { describe, it, expect } from 'vitest'
import { temizBaslik, rutinler, rutinGunuMu, gunSatirlari, planUyarilari } from '@/src/domains/mentor/takip/planKagidi'
import { tatilBul } from '@/src/domains/mentor/takip/tatiller'
import type { Gorev } from '@/src/domains/mentor/takip/takipMath'

const g = (o: Partial<Gorev> = {}): Gorev => ({
  id: Math.random().toString(36), gun: 0, ad: 'G', ders: null, miktar: 30, birim: 'dk', soruSatiri: false,
  konu: '', sayfa: '', yapti: false, soru: null, dogru: null, ...o,
})
const odev = (ad: string, teslim: string, o: Partial<Gorev> = {}) => g({ ad, ders: ad.split(' — ')[0], odevId: ad, teslim, ...o })

describe('temizBaslik: gerçek 23–29 Ekim ödev başlıkları (2026-10-24)', () => {
  it.each([
    ['Başarıyorum-1 · S.1-37', 'Başarıyorum-1 · s. 1–37'],
    ['Esen Yayınları · S.11-24', 'Esen Yayınları · s. 11–24'],
    ['Başarıyorum · S.0-24', 'Başarıyorum · s. 1–24'],
    ['Defter Kontrolü', 'Defter Kontrolü'],
    ['4K 11-17', '4K · s. 11–17'],
    ['Başarıyorum 25-26', 'Başarıyorum · s. 25–26'],
    ['Meb Kitabı Sf.14-50 Yapalım.', 'MEB kitabı · s. 14–50'],
    ['Prg 38-57', 'Prg · s. 38–57'],
    ['Başarıyorum Syf. 35 - 45 Arası Çözelim', 'Başarıyorum · s. 35–45'],
    ['Kondisyon Sy 13-22', 'Kondisyon · s. 13–22'],
    ['Meb Sy 52-53-55-56', 'MEB · s. 52, 53, 55, 56'],
    ['Meb Syf 56', 'MEB · s. 56'],
    ['Orbital', 'Orbital'],
    ['Orbital Syf 46-56', 'Orbital · s. 46–56'],
    ['Başarıyorum 38-39-40', 'Başarıyorum · s. 38, 39, 40'],
    ['Başarıyorum · S.46-48-50', 'Başarıyorum · s. 46, 48, 50'],
    ['Meb · S.35-36', 'MEB · s. 35–36'],
    ['Sayfa 60-61', 's. 60–61'],
    ["Başarıyorum -1 Sayfa 41'e Kadar Tamamlansın.", "Başarıyorum-1 · s. 41'e kadar"],
    ['Kondüsyon 7-10', 'Kondisyon · s. 7–10'],
    ['Meb Sayfa : 35', 'MEB · s. 35'],
    ['Meb Book Sayfa 30, 31(İ,J) , 32', 'MEB Book · s. 30, 31 (İ–J), 32'],
    ['St Book P27Part 3', 'Student Book P27Part 3'],
    ['Student Book 33-34', 'Student Book · s. 33–34'],
    ['Workbook Sayfa 18, 20, 21', 'Workbook · s. 18, 20, 21'],
    ['Başarıyorum-1 Ve Sınıf İçi Ders Notları', 'Başarıyorum-1 Ve Sınıf İçi Ders Notları'],
    ['Cümle Kurma', 'Cümle Kurma'],
    ['Weekend Worksheet 4', 'Weekend Worksheet 4'],
  ])('%s → %s', (girdi, beklenen) => expect(temizBaslik(girdi)).toBe(beklenen))
})

describe('rutinler: ödev olmayan ve ≥ 4 günde geçen görevler', () => {
  const hafta = [0, 1, 2, 3, 4].flatMap(gun => [
    g({ gun, ad: 'Okul tekrarı', miktar: 30 }),
    g({ gun, ad: 'Matematik soru bankası', ders: 'Matematik', miktar: 35, soruSatiri: true }),
    g({ gun, ad: 'Paragraf', ders: 'Türkçe', miktar: 10, birim: 'soru', soruSatiri: true }),
  ]).concat([0, 1, 2, 3, 4, 5, 6].map(gun => g({ gun, ad: 'Kitap okuma (en az 20 sayfa)', birim: 'serbest' })),
    [g({ gun: 5, ad: 'Matematik tarama testi', soruSatiri: true }), odev('Fizik — Kondisyon Sy 13-22', '2026-10-20', { gun: 0 })])
  it('sıra plandaki ilk geçişe göre; etiket, not ve hücre türü', () => {
    expect(rutinler(hafta).map(r => [r.etiket, r.not, r.tur, r.gunler.length])).toEqual([
      ['Okul tekrarı', '30 dk', 'kutu', 5],
      ['Mat. soru bankası', '35 dk · çözdüm/doğru', 'kesir', 5],
      ['Paragraf', '10 soru · çözdüm/doğru', 'kesir', 5],
      ['Kitap okuma', 'en az 20 sayfa', 'sayfa', 7],
    ])
  })
  it('kitaba bağlı rutin: kitap adı etikette, günün sayfa payı hücrede', () => {
    const kitapli = [0, 1, 2, 3, 4].map(gun => g({ gun, ad: 'Matematik soru bankası', ders: 'Matematik', miktar: 35, soruSatiri: true,
      grup: 'k', kitapId: 'b1', kitapAdi: 'Acil Mat', sayfaBas: 45, sayfaSon: 60 }))
    const [r] = rutinler(kitapli, '2026-10-23') // Cuma haftası: ilk pay Cuma (gun 4)
    expect(r.not).toBe('35 dk · Acil Mat · çözdüm/doğru')
    expect(r.sayfalar[4]).toBe('s. 45–48')
    expect(r.sayfalar[3]).toBe('s. 58–60')
  })
  it('resmî tatilde okul tekrarı düşer, diğerleri planda varsa kalır; yarım günde düşmez', () => {
    const [okul, banka] = rutinler(hafta)
    expect(rutinGunuMu(okul, 3, tatilBul('2026-10-29'))).toBe(false)
    expect(rutinGunuMu(banka, 3, tatilBul('2026-10-29'))).toBe(true)
    expect(rutinGunuMu(okul, 2, tatilBul('2026-10-28'))).toBe(true)
    expect(rutinGunuMu(okul, 5, null)).toBe(false) // planda Cumartesi yok
  })
})

describe('gunSatirlari: güne özel satırlar', () => {
  const rutin = new Set(['Okul tekrarı'])
  const bugun = '2026-10-23'
  it('gecikmişler üstte, rutin ve "Haftalık genel tekrar" yok, metin temiz', () => {
    const s = gunSatirlari([
      g({ gun: 4, ad: 'Okul tekrarı' }),
      g({ gun: 4, ad: 'İngilizce', ders: 'İngilizce', miktar: 25 }),
      odev("Tarih — Başarıyorum -1 Sayfa 41'e Kadar Tamamlansın.", '2026-10-20', { gun: 4 }),
      g({ gun: 4, ad: 'Haftalık genel tekrar', birim: 'serbest', miktar: null }),
    ], 4, rutin, bugun)
    expect(s.map(x => [x.ders, x.metin, x.sure, x.gecikmis])).toEqual([
      ['Tarih', "Başarıyorum-1 · s. 41'e kadar", '30 dk', true],
      ['İngilizce', 'serbest tekrar', '25 dk', false],
    ])
  })
  it('sıra taslaktaki gibi: gecikmiş → ödev → şablon görevi (plandaki sıra ne olursa olsun)', () => {
    const s = gunSatirlari([
      g({ gun: 1, ad: 'Fizik', ders: 'Fizik', miktar: 25 }),
      odev('Fizik — Başarıyorum Syf. 35 - 45 Arası Çözelim', '2026-10-27', { gun: 1 }),
      odev('Kimya — Meb Syf 56', '2026-10-20', { gun: 1 }),
    ], 1, rutin, bugun)
    expect(s.map(x => `${x.ders} — ${x.metin}`)).toEqual(['Kimya — MEB · s. 56', 'Fizik — Başarıyorum · s. 35–45', 'Fizik — serbest tekrar'])
  })
  it('genel ve şablon satırları', () => {
    const s = gunSatirlari([
      g({ ad: 'Kimya / Biyoloji' }), g({ ad: 'Edebiyat + Tarih/Coğrafya', miktar: 65 }),
      g({ ad: 'Matematik tarama testi', ders: 'Matematik', miktar: 65, soruSatiri: true }),
      g({ ad: 'Matematik: yanlışların çözümü', ders: 'Matematik' }), g({ ad: 'Matematik tekrarı', ders: 'Matematik', miktar: 40 }),
      g({ ad: 'Deneme sınavı', miktar: 90 }),
    ], 0, rutin, bugun)
    expect(s.map(x => [x.ders, x.metin, x.sure, x.test])).toEqual([
      ['Kimya / Biyoloji', 'serbest tekrar', '30 dk', false],
      ['Edebiyat + Tarih/Coğrafya', 'serbest tekrar', '65 dk', false],
      ['Matematik', 'tarama testi', '65 dk', true],
      ['Matematik', 'yanlışların çözümü', '30 dk', false],
      ['Matematik', 'haftanın tekrarı', '40 dk', false],
      ['Deneme sınavı', '', '90 dk', false],
    ])
  })
  it('aynı ders+kaynak hem gecikmiş hem normalse yalnız gecikmiş kalır', () => {
    const s = gunSatirlari([odev('Kimya — Orbital', '2026-10-30', { gun: 2 }), odev('Kimya — Orbital Syf 46-56', '2026-10-21', { gun: 2 })], 2, rutin, bugun)
    expect(s.map(x => x.metin)).toEqual(['Orbital · s. 46–56'])
  })
  it('sayfa sayısı dakikayı aşarsa uyarı (37 sayfa / 30 dk); liste ve sığan aralıkta yok', () => {
    const s = gunSatirlari([
      odev('Edebiyat — Meb Kitabı Sf.14-50 Yapalım.', '2026-10-26', { gun: 6 }),
      odev('Biyoloji — Esen Yayınları · S.11-24', '2026-10-26', { gun: 6 }),
      odev('Fizik — Meb Sy 52-53-55-56', '2026-10-26', { gun: 6 }),
    ], 6, rutin, bugun)
    expect(s.map(x => x.uyari)).toEqual(["37 sayfa · 30 dk'ya sığmaz", null, null])
  })
})

describe('tatilBul', () => {
  it('sabit tarihli bayram, arife yarım gün, sıradan gün', () => {
    expect(tatilBul('2026-10-29')).toEqual({ tur: 'tatil', ad: 'Cumhuriyet Bayramı' })
    expect(tatilBul('2027-10-28')).toEqual({ tur: 'yarim', ad: 'Cumhuriyet Bayramı arifesi' })
    expect(tatilBul('2026-10-27')).toBeNull()
  })
})

describe('planUyarilari: mentöre plan ekranında', () => {
  it('sığmaz satır + tatil gününe 2’den fazla gecikmiş', () => {
    const gec = (ad: string) => odev(ad, '2026-10-20', { gun: 3 })
    expect(planUyarilari([
      odev('Edebiyat — Meb Kitabı Sf.14-50 Yapalım.', '2026-10-26', { gun: 6 }),
      gec('Tarih — Meb Sayfa : 35'), gec('Biyoloji — Esen Yayınları · S.11-24'), gec('Kimya — Meb Syf 56'),
    ], '2026-10-23', '2026-10-23')).toEqual([
      "Pazar 25 Ekim · Edebiyat — MEB kitabı · s. 14–50: 37 sayfa · 30 dk'ya sığmaz",
      'Perşembe 29 Ekim (Cumhuriyet Bayramı): 3 gecikmiş ödev yığılmış',
    ])
  })
  it('iki gecikmiş tatilde uyarı yok', () => {
    expect(planUyarilari([odev('Tarih — Meb Sayfa : 35', '2026-10-20', { gun: 3 }), odev('Kimya — Meb Syf 56', '2026-10-20', { gun: 3 })], '2026-10-23', '2026-10-23')).toEqual([])
  })
})
