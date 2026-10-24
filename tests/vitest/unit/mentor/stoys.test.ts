import { describe, it, expect } from 'vitest'
import { parseStoys, adAnahtari, eslestir, netYaz, type StoysSatir } from '@/src/domains/mentor/deneme/stoys'

const blok = (kod: string) => ['SS', 'D', 'Y', 'N', 'YB'].map(s => `${kod}-${s}`)
const baslik = (kodlar: string[]) => ['OKUL', 'SINIF', 'Öğrenci No', 'Adı Soyadı', ...kodlar.flatMap(blok), ...blok('TOP'), 'AGIS-Puan', 'AGIS-Sınıf', 'AGIS-Okul', 'AGIS-Genel']

// Gerçek 9-A TCD dosyasından (2026-10-22)
const TCD = [
  [' Stoys Rapor '],
  baslik(['TAR', 'COĞ', 'DİN']),
  ['BKD', '9-A', '101', 'KUZEY OKYAR', '26', '21', '5', '19.75', '75.96', '26', '24', '0', '24', '92.31', '8', '8', '0', '8', '100', '60', '53', '5', '51.75', '86.25', '448.309', '', '', ''],
  ['BKD', '9-A', '102', 'SELİN SEZEN', '26', '8', '6', '6.5', '25', '26', '8', '8', '6', '23.08', '8', '0', '8', '-2', '-25', '60', '16', '22', '12.5', '20.83', '', '', '', ''],
  ['', '', '', '', ''],
]

describe('parseStoys', () => {
  it('TCD: tür, sınıf, seviye; netler (negatif dahil) ve puan', () => {
    const r = parseStoys(TCD)
    expect(r).toMatchObject({ tur: 'TCD', sinif: '9-A', seviye: 9 })
    if ('error' in r) throw new Error(r.error)
    expect(r.satirlar).toHaveLength(2)
    const [kuzey, selin] = r.satirlar
    expect(kuzey).toMatchObject({ ad: 'KUZEY OKYAR', toplamNet: 51.75, puan: 448.309 })
    expect(kuzey.dersler[0]).toEqual({ kod: 'TAR', ss: 26, d: 21, y: 5, n: 19.75 })
    expect(selin.dersler.find(d => d.kod === 'DİN')!.n).toBe(-2)
    expect(selin.puan).toBeNull()
  })
  it('TM ve FKB türleri sütunlardan', () => {
    const satir = (n: number) => ['BKD', '10-B', '1', 'A B', ...Array(n * 5 + 5).fill('1')]
    expect(parseStoys([baslik(['TÜR', 'MAT']), satir(2)])).toMatchObject({ tur: 'TM', seviye: 10 })
    expect(parseStoys([baslik(['FİZ', 'KİM', 'BİY']), satir(3)])).toMatchObject({ tur: 'FKB' })
  })
  it('seviye sınıf adındaki ilk sayıdan ("__PW_TEST__ 9-A" → 9)', () => {
    expect(parseStoys([TCD[1], ['BKD', '__PW_TEST__ 9-A', ...TCD[2].slice(2)]])).toMatchObject({ sinif: '__PW_TEST__ 9-A', seviye: 9 })
  })
  it('tanınmayan dosya: öğrenci listesi, boş, Hazırlık sınıfı → hata', () => {
    expect(parseStoys([['S.No', 'Öğrenci No', 'Adı Soyadı'], ['1', '5', 'Ali Veli']])).toHaveProperty('error')
    expect(parseStoys([])).toHaveProperty('error')
    expect(parseStoys([TCD[1], ['BKD', 'Hazırlık', ...TCD[2].slice(2)]])).toHaveProperty('error')
    expect(parseStoys([TCD[1]])).toHaveProperty('error') // öğrenci satırı yok
  })
})

describe('adAnahtari', () => {
  it('Türkçe büyük harf, fazla boşluk', () => {
    expect(adAnahtari('  Beren   Çıbıkçı ')).toBe(adAnahtari('BEREN ÇIBIKÇI'))
    expect(adAnahtari('İdo Elçiçek')).toBe('İDO ELÇİÇEK')
  })
})

describe('eslestir', () => {
  const s = (ad: string): StoysSatir => ({ ad, dersler: [], toplamNet: 10, puan: null })
  it('yalnız dosyanın sınıfı aday; eşleşen / katılmayan / eşleşmeyen satır', () => {
    const e = eslestir([s('ALİ AK'), s('YABANCI KİŞİ')], [
      { id: 'a', full_name: 'Ali Ak', class_name: '9-A' },
      { id: 'b', full_name: 'Bora Can', class_name: '9-A' },
      { id: 'c', full_name: 'Cem Dal', class_name: '9-B' },
    ], '9-A')
    expect(e.eslesen.map(x => x.studentId)).toEqual(['a'])
    expect(e.katilmayan).toEqual(['b'])
    expect(e.eslesmeyenSatirlar.map(x => x.ad)).toEqual(['YABANCI KİŞİ'])
  })
  it('aynı adlı iki öğrenci: ikisi de eşleşmez, satır eşleşmeyenlere', () => {
    const e = eslestir([s('ALİ AK')], [
      { id: 'a', full_name: 'Ali Ak', class_name: '9-A' }, { id: 'a2', full_name: 'ALİ  AK', class_name: '9-A' },
    ], '9-A')
    expect(e.eslesen).toEqual([])
    expect(e.katilmayan.sort()).toEqual(['a', 'a2'])
    expect(e.eslesmeyenSatirlar).toHaveLength(1)
  })
})

describe('netYaz', () => {
  it('Türkçe ondalık, gerçek eksi işareti', () => {
    expect(netYaz(51.75)).toBe('51,75')
    expect(netYaz(-2)).toBe('−2,00')
    expect(netYaz(0)).toBe('0,00')
  })
})
