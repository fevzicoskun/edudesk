import { describe, it, expect } from 'vitest'
import { raporSatirlari, raporOzeti, durumListesi, sutunlaraBol, oncekiSayilar } from '@/src/domains/homework/lib/odev-rapor'
import type { SubmissionStatus } from '@/src/shared/types'

const ogrenci = (id: string, ad: string, no: string | null = null) => ({
  student_id: id, full_name: ad, student_number: no,
})

describe('raporSatirlari()', () => {
  it('öğrenciyi sıra numarası, numarası, adı ve durum etiketiyle döker', () => {
    const satirlar = raporSatirlari({
      items:    [ogrenci('s1', 'Ahmet Yılmaz', '142')],
      statuses: { s1: 'yapildi' },
      notes:    {},
      recordedIds: new Set(['s1']),
    })
    expect(satirlar).toEqual([
      { sira: 1, numara: '142', ad: 'Ahmet Yılmaz', durum: 'Yapıldı', durumKodu: 'yapildi', not: '', kez: 0 },
    ])
  })

  it('işaretlenmemiş öğrenci "Yapılmadı" değil "—" basılır', () => {
    const satirlar = raporSatirlari({
      items:    [ogrenci('s1', 'Ayşe Demir')],
      statuses: { s1: 'yapilmadi' },
      notes:    {},
      recordedIds: new Set(),
    })
    expect(satirlar[0].durum).toBe('—')
    expect(satirlar[0].durumKodu).toBeNull()
  })

  it('numarası olmayan öğrencide numara boş kalır', () => {
    const satirlar = raporSatirlari({
      items: [ogrenci('s1', 'Ayşe Demir')], statuses: { s1: 'eksik' }, notes: {}, recordedIds: new Set(['s1']),
    })
    expect(satirlar[0].numara).toBe('')
  })

  it('not varsa satıra taşınır', () => {
    const satirlar = raporSatirlari({
      items: [ogrenci('s1', 'Ayşe Demir')], statuses: { s1: 'eksik' },
      notes: { s1: '3 soru eksik' }, recordedIds: new Set(['s1']),
    })
    expect(satirlar[0].not).toBe('3 soru eksik')
  })

  it('sıra numarası listedeki sırayı takip eder', () => {
    const satirlar = raporSatirlari({
      items: [ogrenci('s1', 'Ahmet'), ogrenci('s2', 'Ayşe'), ogrenci('s3', 'Mehmet')],
      statuses: { s1: 'yapildi', s2: 'eksik', s3: 'gec' },
      notes: {}, recordedIds: new Set(['s1', 's2', 's3']),
    })
    expect(satirlar.map(s => s.sira)).toEqual([1, 2, 3])
  })
})

describe('raporOzeti()', () => {
  const statuses = (map: Record<string, SubmissionStatus>) => map

  it('sıfır olan durumlar özette görünmez', () => {
    const ozet = raporOzeti(statuses({ s1: 'yapildi', s2: 'yapildi' }), new Set(['s1', 's2']), 2)
    expect(ozet).toEqual([{ etiket: 'Yapıldı', sayi: 2, kod: 'yapildi' }])
  })

  it('durumlar sabit sırada listelenir: Yapıldı → Geç → Eksik → Yapılmadı → Mazeretli', () => {
    const ozet = raporOzeti(
      statuses({ s1: 'mazeretli', s2: 'yapilmadi', s3: 'eksik', s4: 'gec', s5: 'yapildi' }),
      new Set(['s1', 's2', 's3', 's4', 's5']), 5,
    )
    expect(ozet.map(o => o.etiket)).toEqual(['Yapıldı', 'Geç', 'Eksik', 'Yapılmadı', 'Mazeretli'])
  })

  it('işaretlenmemiş öğrenciler Yapılmadı sayılmaz, Girilmedi olarak ayrılır', () => {
    const ozet = raporOzeti(
      statuses({ s1: 'yapildi', s2: 'yapilmadi', s3: 'yapilmadi' }),
      new Set(['s1', 's2']), 3,
    )
    expect(ozet).toEqual([
      { etiket: 'Yapıldı',   sayi: 1, kod: 'yapildi' },
      { etiket: 'Yapılmadı', sayi: 1, kod: 'yapilmadi' },
      // Girilmedi gerçek bir durum değil → kod yok, rengi de ayrı
      { etiket: 'Girilmedi', sayi: 1, kod: null },
    ])
  })

  it('öğrenci yoksa özet boş döner', () => {
    expect(raporOzeti({}, new Set(), 0)).toEqual([])
  })
})

describe('durumListesi()', () => {
  const satir = (ad: string, numara: string, durumKodu: string | null, kez = 1) => ({
    sira: 1, numara, ad, durum: '', durumKodu, not: '', kez,
  })
  const adlar = (l: { ad: string }[]) => l.map(x => x.ad)

  const sinif = [
    satir('Ahmet', '201', 'yapildi'),
    satir('Ayşe', '202', 'yapilmadi'),
    satir('Emre', '205', 'gec'),
    satir('Elif', '206', 'mazeretli'),
    satir('Selin', '208', 'yapilmadi'),
    satir('Deniz', '209', 'eksik'),
  ] as never

  it('yalnız istenen durumdakileri döker', () => {
    expect(adlar(durumListesi(sinif, ['yapilmadi']))).toEqual(['Ayşe', 'Selin'])
  })

  it('eksik bırakanlar yapmayanlardan AYRI listelenir — özetteki sayılarla tutsun diye', () => {
    expect(adlar(durumListesi(sinif, ['eksik']))).toEqual(['Deniz'])
  })

  it('birden çok durum aynı anda süzülebilir', () => {
    expect(adlar(durumListesi(sinif, ['yapilmadi', 'eksik'])))
      .toEqual(['Ayşe', 'Selin', 'Deniz'])
  })

  it('çıktıda öğrenci numarası basılmaz — yalnız ad', () => {
    expect(durumListesi([satir('Ayşe', '202', 'yapilmadi', 4)] as never, ['yapilmadi'])).toEqual([{ ad: 'Ayşe', kez: 4 }])
  })

  it('işaretlenmemiş öğrenci listeye girmez — bilgi yok, suçlama yok', () => {
    expect(durumListesi([satir('Ayşe', '202', null)] as never, ['yapilmadi'])).toEqual([])
  })

  it('herkes yaptıysa boş döner', () => {
    expect(durumListesi([satir('Ahmet', '201', 'yapildi')] as never, ['yapilmadi'])).toEqual([])
  })
})

describe('sutunlaraBol() — rapor tek A4 sayfaya sığsın', () => {
  const n = (k: number) => Array.from({ length: k }, (_, i) => i + 1)

  it('az öğrenci → tek sütun', () => {
    expect(sutunlaraBol(n(20))).toEqual([n(20)])
  })

  it('orta sınıf → 2 sütun, yukarıdan aşağı sırayla (numara sırası bozulmaz)', () => {
    const s = sutunlaraBol(n(34))
    expect(s).toHaveLength(2)
    expect(s[0]).toEqual(n(17))
    expect(s[1][0]).toBe(18)
  })

  it('kalabalık sınıf → 3 sütun, hiçbir satır kaybolmaz', () => {
    const s = sutunlaraBol(n(50))
    expect(s).toHaveLength(3)
    expect(s.flat()).toEqual(n(50))
  })

  it('boş liste → tek boş sütun', () => {
    expect(sutunlaraBol([])).toEqual([[]])
  })
})

describe('tekrar sayısı (kaçıncı kez)', () => {
  const tek = (status: SubmissionStatus, onceki: Record<string, { yapilmadi: number; eksik: number }> = {}) =>
    raporSatirlari({
      items: [ogrenci('s1', 'Ayşe')], statuses: { s1: status }, notes: {}, recordedIds: new Set(['s1']), onceki,
    })[0].kez

  it('önceki kaydı olmayan yapmayan: 1. kez', () => {
    expect(tek('yapilmadi')).toBe(1)
  })

  it('yapılmadı sayısı yalnız önceki yapılmadılardan gelir — eksikler karışmaz', () => {
    expect(tek('yapilmadi', { s1: { yapilmadi: 3, eksik: 5 } })).toBe(4)
  })

  it('eksik bırakanın sayısı yalnız önceki eksiklerden gelir', () => {
    expect(tek('eksik', { s1: { yapilmadi: 3, eksik: 1 } })).toBe(2)
  })

  it('yapan / geç / mazeretli öğrencide sayı yok', () => {
    expect(tek('yapildi', { s1: { yapilmadi: 3, eksik: 1 } })).toBe(0)
    expect(tek('gec', { s1: { yapilmadi: 3, eksik: 1 } })).toBe(0)
  })

  it('işaretlenmemiş öğrencide sayı yok — bilgi yokken suçlama olmaz', () => {
    const s = raporSatirlari({
      items: [ogrenci('s1', 'Ayşe')], statuses: { s1: 'yapilmadi' }, notes: {}, recordedIds: new Set(),
      onceki: { s1: { yapilmadi: 3, eksik: 0 } },
    })[0]
    expect(s.kez).toBe(0)
  })

  it('oncekiSayilar: öğrenci başına yapılmadı ve eksik ayrı sayılır, diğer durumlar yok sayılır', () => {
    expect(oncekiSayilar([
      { student_id: 's1', status: 'yapilmadi' },
      { student_id: 's1', status: 'yapilmadi' },
      { student_id: 's1', status: 'eksik' },
      { student_id: 's2', status: 'eksik' },
      { student_id: 's2', status: 'yapildi' },
    ])).toEqual({ s1: { yapilmadi: 2, eksik: 1 }, s2: { yapilmadi: 0, eksik: 1 } })
  })
})
