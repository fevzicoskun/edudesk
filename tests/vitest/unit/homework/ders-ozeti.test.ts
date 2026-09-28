import { describe, it, expect } from 'vitest'
import { computeStudentHomeworkStats, dersOzeti, dersOzetiMetni, derseGore, type HomeworkRecord } from '@/src/domains/homework/lib/stats'

let n = 0
const r = (subject: string, status: HomeworkRecord['status']): HomeworkRecord =>
  ({ id: `h${++n}`, title: 't', subject, due_date: '2026-09-20', status, note: null, teacher_id: 'x', bekliyor: false })

describe('dersOzeti() — öğrencinin ders bazlı ödev durumu', () => {
  it('ders başına yapıldı / değerlendirilen; tamamlama oranıyla aynı tanım (mazeretli ve kontrol edilmemiş paydada yok)', () => {
    const o = dersOzeti([
      r('Matematik', 'yapildi'), r('Matematik', 'yapildi'), r('Matematik', 'eksik'),
      r('Matematik', 'mazeretli'), r('Matematik', null),
      r('Fizik', 'gec'), r('Fizik', 'yapilmadi'),
    ])
    expect(o).toEqual([
      { ders: 'Fizik', yapildi: 0, eksik: 0, gec: 1, degerlendirilen: 2, toplam: 2 },
      { ders: 'Matematik', yapildi: 2, eksik: 1, gec: 0, degerlendirilen: 3, toplam: 5 },
    ])
  })

  it('ders başlıkları büyük/küçük harf ve boşluk farkıyla bölünmez; Türkçe sıralanır; boş ders "Diğer"', () => {
    const o = dersOzeti([r(' matematik', 'yapildi'), r('Matematik ', 'eksik'), r('Çözümlü', null), r('Biyoloji', null), r('  ', 'yapildi')])
    expect(o.map(d => d.ders)).toEqual(['Biyoloji', 'Çözümlü', 'Diğer', 'matematik'])
    expect(o.find(d => d.ders === 'matematik')).toEqual({ ders: 'matematik', yapildi: 1, eksik: 1, gec: 0, degerlendirilen: 2, toplam: 2 })
  })

  it('dersler toplandığında genel istatistikle tutarlıdır', () => {
    const kayitlar = [r('A', 'yapildi'), r('B', 'eksik'), r('B', 'mazeretli'), r('C', null), r('C', 'yapildi')]
    const o = dersOzeti(kayitlar)
    const s = computeStudentHomeworkStats(kayitlar)
    expect(o.reduce((t, d) => t + d.toplam, 0)).toBe(s.total)
    expect(o.reduce((t, d) => t + d.yapildi, 0)).toBe(s.yapildi)
    expect(o.reduce((t, d) => t + d.degerlendirilen, 0)).toBe(s.total - s.mazeretli - s.kontrolEdilmedi)
  })

  it('ödev yoksa boş', () => {
    expect(dersOzeti([])).toEqual([])
  })
})

describe('dersOzetiMetni() — iki ekranın ortak metni', () => {
  const m = (yapildi: number, eksik: number, gec: number, degerlendirilen: number) =>
    dersOzetiMetni({ ders: 'Matematik', yapildi, eksik, gec, degerlendirilen, toplam: degerlendirilen })

  it('eksik ve geç parantezde; hesap değişmez (2/3 kalır)', () => {
    expect(m(2, 1, 0, 3)).toBe('Matematik 2/3 (1 eksik)')
    expect(m(1, 0, 1, 2)).toBe('Matematik 1/2 (1 geç)')
    expect(m(1, 2, 1, 4)).toBe('Matematik 1/4 (2 eksik, 1 geç)')
  })

  it('eksik/geç yoksa parantez yok; değerlendirilen yoksa tire', () => {
    expect(m(3, 0, 0, 3)).toBe('Matematik 3/3')
    expect(m(0, 0, 0, 0)).toBe('Matematik —')
  })
})

describe('derseGore() — Ödev Geçmişi süzmesi', () => {
  const kayitlar = [r('Matematik', 'yapildi'), r(' matematik ', 'eksik'), r('Fizik', null), r('  ', 'yapildi')]

  it('ders özetiyle aynı normalleştirme: harf/boşluk farkı süzmeden düşürmez', () => {
    expect(derseGore(kayitlar, 'Matematik').map(k => k.subject)).toEqual(['Matematik', ' matematik '])
    expect(derseGore(kayitlar, 'MATEMATİK').length).toBe(2) // Türkçe büyük İ → i (tr-TR küçültme)
  })

  it('boş ders adı "Diğer" ile süzülür (satırda öyle görünüyor)', () => {
    expect(derseGore(kayitlar, 'Diğer').map(k => k.subject)).toEqual(['  '])
  })

  it('süzme yoksa ya da eşleşen ders yoksa tüm liste (bozuk adres boş ekran göstermez)', () => {
    expect(derseGore(kayitlar, null)).toEqual(kayitlar)
    expect(derseGore(kayitlar, 'Kimya')).toEqual(kayitlar)
  })

  it('ders özetindeki her ders adı süzmede en az bir kayıt bulur ve toplamlar tutar', () => {
    for (const d of dersOzeti(kayitlar)) expect(derseGore(kayitlar, d.ders).length).toBe(d.toplam)
  })
})
