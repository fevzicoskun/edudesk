import { describe, it, expect } from 'vitest'
import { mentorTablosu, hucreMetni, basTarihi } from '@/src/domains/mentor/lib/mentorTablosu'
import type { HomeworkRecord } from '@/src/domains/homework/lib/stats'

const hw = (subject: string, status: HomeworkRecord['status'], i = Math.random()): HomeworkRecord => ({
  id: `h${i}`, title: 't', subject, due_date: '2026-10-01', status, note: null, teacher_id: 'x', bekliyor: false,
})

describe('hucreMetni', () => {
  it('ödev yoksa —', () => expect(hucreMetni(undefined)).toEqual({ metin: '—', kirmizi: false }))
  it('yapılan/değerlendirilen, eksik parantezde', () => {
    expect(hucreMetni({ ders: 'Fizik', yapildi: 2, eksik: 1, gec: 0, degerlendirilen: 3, toplam: 3 }).metin).toBe('2/3 (1e)')
  })
  it('hiç kontrol edilmemişse —', () => {
    expect(hucreMetni({ ders: 'Fizik', yapildi: 0, eksik: 0, gec: 0, degerlendirilen: 0, toplam: 2 }).metin).toBe('—')
  })
  it('kırmızı eşiği odevSeviyesi ile aynı: 5 değerlendirilenden 1 yapıldı = risk', () => {
    expect(hucreMetni({ ders: 'M', yapildi: 1, eksik: 0, gec: 0, degerlendirilen: 5, toplam: 5 }).kirmizi).toBe(true)
    expect(hucreMetni({ ders: 'M', yapildi: 0, eksik: 0, gec: 0, degerlendirilen: 2, toplam: 2 }).kirmizi).toBe(false) // az veri
  })
})

describe('mentorTablosu', () => {
  it('sütunlar tüm öğrencilerin dersleri, alfabetik; farklı yazım tek sütun', () => {
    const t = mentorTablosu([
      { id: 'a', full_name: 'Ali', class_name: '11-B', homeworks: [hw('Matematik', 'yapildi'), hw('Fizik', 'eksik')] },
      { id: 'b', full_name: 'Ayşe', class_name: '11-A', homeworks: [hw('matematik ', 'yapildi'), hw('Kimya', 'yapildi')] },
    ])
    expect(t.dersler).toEqual(['Fizik', 'Kimya', 'Matematik'])
    expect(t.satirlar[0].hucreler.map(h => h.metin)).toEqual(['0/1 (1e)', '—', '1/1'])
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
  it('geçerliyse aynen', () => expect(basTarihi('2026-09-20', DB, BUGUN)).toBe('2026-09-20'))
})
