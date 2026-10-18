import { describe, it, expect } from 'vitest'
import { OKUL_DERSLERI, programDersi, bransDersleri, ogretmenDersleri, varsayilanDers } from '@/src/domains/homework/dersSecimi'
import type { Slot } from '@/src/domains/schedule/scheduleMath'

const s = (subject: string, class_id: string): Slot => ({ day: 1, period: 1, subject, class_id })

describe('programDersi — ders programı adı → okul ders adı', () => {
  it('kanonik ad aynen (büyük/küçük harf farkı okulun yazımına oturur)', () => {
    expect(programDersi('Matematik')).toBe('Matematik')
    expect(programDersi('GEOMETRİ')).toBe('Geometri')
    expect(programDersi('Türk Dili ve Edebiyatı')).toBe('Türk Dili ve Edebiyatı')
  })
  it('numaralı dersler ana derse: Matematik 1/2, İngilizce 1/2', () => {
    expect(programDersi('Matematik 1')).toBe('Matematik')
    expect(programDersi('Matematik 2')).toBe('Matematik')
    expect(programDersi('İngilizce 2')).toBe('İngilizce')
  })
  it('S- kısaltmaları ilgili ana derse', () => {
    expect(programDersi('S-MAT')).toBe('Matematik')
    expect(programDersi('S-FİZ')).toBe('Fizik')
    expect(programDersi('S-KİM')).toBe('Kimya')
    expect(programDersi('S-COĞ')).toBe('Coğrafya')
    expect(programDersi('S-TAR')).toBe('Tarih')
    expect(programDersi('S-TDVE')).toBe('Türk Dili ve Edebiyatı')
  })
  it('kısa adlar tam ada', () => {
    expect(programDersi('Türkçe')).toBe('Türk Dili ve Edebiyatı')
    expect(programDersi('Din Kültürü')).toBe('Din Kültürü ve Ahlak Bilgisi')
    expect(programDersi('Beden Eğitimi')).toBe('Beden Eğitimi ve Spor')
    expect(programDersi('İnkılap Tarihi')).toBe('T.C. İnkılap Tarihi ve Atatürkçülük')
  })
  it('Mentörlük ve bilinmeyen ad ders değildir', () => {
    expect(programDersi('Mentörlük')).toBeNull()
    expect(programDersi('Kulüp')).toBeNull()
    expect(programDersi('')).toBeNull()
  })
  it('her eşleme sonucu okul ders listesinde', () => {
    for (const ad of ['Matematik 1', 'S-MAT', 'Türkçe', 'Din Kültürü', 'Beden Eğitimi', 'İnkılap Tarihi', 'S-TDVE', 'Yapay Zeka', 'Almanca', 'Felsefe']) {
      expect(OKUL_DERSLERI).toContain(programDersi(ad))
    }
  })
})

describe('bransDersleri — profil branşı', () => {
  it('Matematik branşı Matematik + Geometri verir', () => {
    expect(bransDersleri('Matematik')).toEqual(['Matematik', 'Geometri'])
  })
  it('diğer branş tek ders; ders olmayan branş boş', () => {
    expect(bransDersleri('Biyoloji')).toEqual(['Biyoloji'])
    expect(bransDersleri('PDR')).toEqual([])
    expect(bransDersleri(null)).toEqual([])
  })
})

describe('ogretmenDersleri — kaynak sırası: program → branş → tüm okul', () => {
  it('programdan sınıf bazında dersler (Hüseyin İnal deseni)', () => {
    const r = ogretmenDersleri([s('Geometri', 'c11a'), s('Matematik', 'c11a'), s('Matematik 2', 'c12b'), s('S-MAT', 'c12b'), s('Mentörlük', 'c9a')], 'Matematik')
    expect(r.dersler).toEqual(['Geometri', 'Matematik'])
    expect(r.sinifDersleri).toEqual({ c11a: ['Geometri', 'Matematik'], c12b: ['Matematik'] })
    expect(r.kaynak).toBe('program')
  })
  it('program yoksa branş (Fevzi deseni: Matematik → Mat + Geo, sınıf haritası boş)', () => {
    const r = ogretmenDersleri([], 'Matematik')
    expect(r.dersler).toEqual(['Matematik', 'Geometri'])
    expect(r.sinifDersleri).toEqual({})
    expect(r.kaynak).toBe('brans')
  })
  it('programda yalnız ders olmayan kayıt varsa branşa düşer', () => {
    expect(ogretmenDersleri([s('Mentörlük', 'c9a')], 'Kimya').dersler).toEqual(['Kimya'])
  })
  it('ikisi de yoksa okulun tüm dersleri (PDR öğretmeni ödev veremez duruma düşmesin)', () => {
    const r = ogretmenDersleri([], 'PDR')
    expect(r.dersler).toEqual(OKUL_DERSLERI)
    expect(r.kaynak).toBe('okul')
  })
})

describe('varsayilanDers — seçili gelecek ders', () => {
  const sec = { dersler: ['Geometri', 'Matematik'], sinifDersleri: { c11a: ['Geometri', 'Matematik'], c12b: ['Matematik'] }, kaynak: 'program' as const }
  it('tek ders varsa o', () => {
    expect(varsayilanDers({ dersler: ['Kimya'], sinifDersleri: {}, kaynak: 'brans' }, null)).toBe('Kimya')
  })
  it('seçilen sınıfta tek ders veriyorsa o', () => {
    expect(varsayilanDers(sec, 'c12b')).toBe('Matematik')
  })
  it('sınıfta birden çok ders ya da sınıf bilinmiyorsa seçim yok', () => {
    expect(varsayilanDers(sec, 'c11a')).toBe('')
    expect(varsayilanDers(sec, null)).toBe('')
    expect(varsayilanDers(sec, 'baska')).toBe('')
  })
})
