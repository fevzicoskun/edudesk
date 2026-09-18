import { describe, it, expect } from 'vitest'
import { raporSatirlari, raporOzeti, yapmayanlar } from '@/src/domains/homework/lib/odev-rapor'
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
      { sira: 1, numara: '142', ad: 'Ahmet Yılmaz', durum: 'Yapıldı', durumKodu: 'yapildi', not: '' },
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

describe('yapmayanlar()', () => {
  const satir = (ad: string, numara: string, durumKodu: string | null) => ({
    sira: 1, numara, ad, durum: '', durumKodu, not: '',
  })

  it('yalnız yapmayanları döker — yapıldı/geç/mazeretli listeye girmez', () => {
    const liste = yapmayanlar([
      satir('Ahmet', '201', 'yapildi'),
      satir('Ayşe', '202', 'yapilmadi'),
      satir('Emre', '205', 'gec'),
      satir('Elif', '206', 'mazeretli'),
      satir('Selin', '208', 'yapilmadi'),
    ] as never)
    expect(liste).toEqual(['Ayşe (202)', 'Selin (208)'])
  })

  it('eksik teslim de yapmayan sayılır', () => {
    const liste = yapmayanlar([satir('Ayşe', '202', 'eksik')] as never)
    expect(liste).toEqual(['Ayşe (202)'])
  })

  it('numarası olmayan öğrenci parantezsiz yazılır', () => {
    const liste = yapmayanlar([satir('Ayşe', '', 'yapilmadi')] as never)
    expect(liste).toEqual(['Ayşe'])
  })

  it('işaretlenmemiş öğrenci yapmayan sayılmaz — bilgi yok, suçlama yok', () => {
    const liste = yapmayanlar([satir('Ayşe', '202', null)] as never)
    expect(liste).toEqual([])
  })

  it('herkes yaptıysa boş döner', () => {
    expect(yapmayanlar([satir('Ahmet', '201', 'yapildi')] as never)).toEqual([])
  })
})
