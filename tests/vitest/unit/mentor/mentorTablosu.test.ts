import { describe, it, expect } from 'vitest'
import { mentorTablosu, hucreMetni, basTarihi } from '@/src/domains/mentor/lib/mentorTablosu'
import type { HomeworkRecord } from '@/src/domains/homework/lib/stats'

const hw = (subject: string, status: HomeworkRecord['status'], i = Math.random()): HomeworkRecord => ({
  id: `h${i}`, title: 't', subject, due_date: '2026-10-01', status, note: null, teacher_id: 'x', bekliyor: false,
})

describe('hucreMetni', () => {
  const d = (yapildi: number, degerlendirilen: number, eksik = 0, toplam = degerlendirilen) =>
    ({ ders: 'M', yapildi, eksik, gec: 0, degerlendirilen, toplam })
  it('ödev yoksa —', () => expect(hucreMetni(undefined)).toMatchObject({ metin: '—', ekler: [], renk: null }))
  it('hiç kontrol edilmemişse —, ama girilmedi yazar', () => {
    expect(hucreMetni(d(0, 0, 0, 2))).toMatchObject({ metin: '—', ekler: ['2 girilmedi'] })
  })
  it('yapılan/değerlendirilen; eksik ve girilmedi açık yazılır', () => {
    expect(hucreMetni(d(6, 7, 1, 8))).toMatchObject({ metin: '6/7', ekler: ['1 eksik', '1 girilmedi'] })
  })
  it('mazeretli girilmedi sayılmaz, açıklamada yazar', () => {
    const h = hucreMetni(d(8, 8, 0, 9), 1)
    expect(h.ekler).toEqual([])
    expect(h.aciklama).toContain('1 mazeretli')
  })
  it('tek renk kuralı: %50 altı kırmızı, %50–%80 turuncu, üstü normal (az veride de)', () => {
    expect(hucreMetni(d(2, 7)).renk).toBe('kirmizi')  // %29
    expect(hucreMetni(d(0, 1)).renk).toBe('kirmizi')  // %0 — eskiden "az veri" diye renksizdi
    expect(hucreMetni(d(4, 8)).renk).toBe('turuncu') // %50 — eskiden renksizdi
    expect(hucreMetni(d(6, 8)).renk).toBe('turuncu') // %75
    expect(hucreMetni(d(7, 8)).renk).toBeNull()      // %88
    expect(hucreMetni(d(4, 5)).renk).toBeNull()      // %80 sınırı normal
  })
  it('mentorTablosu mazeretli ve kontrol edilmemiş ödevi paydaya katmaz, ayrı sayar', () => {
    const t = mentorTablosu([{ id: 'a', full_name: 'Ali', class_name: null, homeworks: [
      hw('Fizik', 'yapildi'), hw('Fizik', 'yapildi'), hw('Fizik', 'eksik'), hw('Fizik', 'mazeretli'), hw('Fizik', null),
    ] }])
    expect(t.satirlar[0].hucreler[0]).toMatchObject({ metin: '2/3', ekler: ['1 eksik', '1 girilmedi'] })
    expect(t.satirlar[0].hucreler[0].aciklama).toContain('1 mazeretli')
  })
})

describe('mentorTablosu', () => {
  it('sütunlar tüm öğrencilerin dersleri, alfabetik; farklı yazım tek sütun', () => {
    const t = mentorTablosu([
      { id: 'a', full_name: 'Ali', class_name: '11-B', homeworks: [hw('Matematik', 'yapildi'), hw('Fizik', 'eksik')] },
      { id: 'b', full_name: 'Ayşe', class_name: '11-A', homeworks: [hw('matematik ', 'yapildi'), hw('Kimya', 'yapildi')] },
    ])
    expect(t.dersler).toEqual(['Fizik', 'Kimya', 'Matematik'])
    expect(t.satirlar[0].hucreler.map(h => h.metin)).toEqual(['0/1', '—', '1/1'])
    expect(t.satirlar[1].hucreler.map(h => h.metin)).toEqual(['—', '1/1', '1/1'])
  })
  it('satırlar Türkçe ada göre sıralı', () => {
    const t = mentorTablosu([
      { id: 'z', full_name: 'Şule', class_name: null, homeworks: [] },
      { id: 'c', full_name: 'Can', class_name: null, homeworks: [] },
    ])
    expect(t.satirlar.map(s => s.full_name)).toEqual(['Can', 'Şule'])
  })
  it('dikkat: 3+ yapılmadı/eksik, ders dökümüyle', () => {
    const t = mentorTablosu([
      { id: 'a', full_name: 'Ali', class_name: null, homeworks: [hw('Mat', 'yapilmadi'), hw('Mat', 'eksik'), hw('Fiz', 'yapilmadi')] },
      { id: 'b', full_name: 'Ayşe', class_name: null, homeworks: [hw('Mat', 'yapilmadi'), hw('Mat', 'gec')] },
    ])
    expect(t.dikkat).toEqual([{ id: 'a', full_name: 'Ali', toplam: 3, dersler: 'Fiz 1, Mat 2' }])
  })
})

describe('basTarihi', () => {
  const DB = '2026-09-08', BUGUN = '2026-10-07'
  it('yoksa dönem başı', () => expect(basTarihi(undefined, DB, BUGUN)).toBe(DB))
  it('bozuksa dönem başı', () => expect(basTarihi('abc', DB, BUGUN)).toBe(DB))
  it('geçersiz takvim günü dönem başı', () => expect(basTarihi('2026-02-31', DB, BUGUN)).toBe(DB))
  it('ileriyse bugün', () => expect(basTarihi('2099-01-01', DB, BUGUN)).toBe(BUGUN))
  it('dizi gelirse ilki', () => expect(basTarihi(['2026-09-20', 'x'], DB, BUGUN)).toBe('2026-09-20'))
  it('çok eski yıl (Postgres reddeder) dönem başı', () => expect(basTarihi('0000-01-01', DB, BUGUN)).toBe(DB))
  it('geçerliyse aynen', () => expect(basTarihi('2026-09-20', DB, BUGUN)).toBe('2026-09-20'))
})
