import { describe, it, expect } from 'vitest'
import { aylikRapor, raporAyi, oncekiAy, sonrakiAy } from '@/src/domains/dashboard/lib/aylikRapor'
import type { TakipOdev, TakipTeslim } from '@/src/domains/homework/lib/odev-takibi'

describe('raporAyi', () => {
  it('ayın ilk 7 günü geçen ay, sonrası bu ay', () => {
    expect(raporAyi('2026-11-01')).toBe('2026-10')
    expect(raporAyi('2026-11-07')).toBe('2026-10')
    expect(raporAyi('2026-11-08')).toBe('2026-11')
    expect(raporAyi('2027-01-03')).toBe('2026-12')
  })
  it('oncekiAy yıl sınırını geçer', () => {
    expect(oncekiAy('2026-10')).toBe('2026-09')
    expect(oncekiAy('2027-01')).toBe('2026-12')
    expect(sonrakiAy('2026-12')).toBe('2027-01')
    expect(sonrakiAy('2026-09')).toBe('2026-10')
  })
})

const odev = (id: string, cls: string, due: string, teacher = 't1'): TakipOdev =>
  ({ id, title: id, subject: 'Matematik', class_id: cls, teacher_id: teacher, due_date: due, assigned_date: due })
const isaret = (hw: string, stu: string, status: string): TakipTeslim =>
  ({ homework_id: hw, student_id: stu, status, marked_at: '2026-10-20T10:00:00Z' })

// 9-A: eylülde %0, ekimde %100; 9-B: eylülde %100, ekimde %0
const students = ['a1', 'a2', 'a3', 'b1'].map(id => ({ id, full_name: id, class_id: id.startsWith('a') ? 'A' : 'B' }))
const homeworks = [
  odev('e1', 'A', '2026-09-10'), odev('e2', 'A', '2026-09-12'), odev('e3', 'A', '2026-09-14'),
  odev('k1', 'A', '2026-10-10', 't2'),
  odev('eb', 'B', '2026-09-10'), odev('kb', 'B', '2026-10-10'),
  odev('bekleyen', 'B', '2026-10-01'), // hiç işaretlenmemiş, teslimi geçmiş
]
const submissions = [
  ...['e1', 'e2', 'e3'].map(h => isaret(h, 'a1', 'yapilmadi')),
  isaret('k1', 'a1', 'yapildi'), isaret('k1', 'a2', 'yapildi'), isaret('k1', 'a3', 'mazeretli'),
  isaret('eb', 'b1', 'yapildi'), isaret('kb', 'b1', 'eksik'),
]
const girdi = {
  homeworks, submissions, students,
  ogretmenler: new Map([['t1', 'Ayşe'], ['t2', 'Mehmet']]),
  siniflar: new Map([['A', '9-A'], ['B', '9-B']]),
  bugun: '2026-10-20', ay: '2026-10', bulten: { bu: 4, gecen: 0 },
}

describe('aylikRapor', () => {
  const r = aylikRapor(girdi)
  const satir = (ad: string) => r.ozet.find(s => s.ad === ad)!

  it('ödevleri teslim gününe göre aya ayırır', () => {
    expect(r.gecenAy).toBe('2026-09')
    expect(satir('Verilen ödev')).toMatchObject({ bu: 3, gecen: 4 })
    expect(satir('Ödev veren öğretmen')).toMatchObject({ bu: 2, gecen: 1 })
    expect(satir('Gönderilen veli bülteni')).toMatchObject({ bu: 4, gecen: 0 })
  })

  it('tamamlanma mazeretliyi paydadan düşer (Ödev Takibi tanımı)', () => {
    // ekim: k1 2 yapıldı + 1 mazeretli, kb 1 eksik → 2/3 = %67; eylül: 1/4 = %25
    expect(satir('Ödev tamamlanma')).toMatchObject({ bu: 67, gecen: 25 })
  })

  it('kontrol oranı: teslimi geçmiş ödevlerden işaretlenenlerin payı', () => {
    expect(satir('Öğretmen kontrol oranı')).toMatchObject({ bu: 67, gecen: 100 })
  })

  it('riskli sayısı bugünkü Ödev Takibi ile aynı, geçen ayla kıyaslanmaz', () => {
    // eşik veri biriktikçe dolar — kıyas yanıltıcı olurdu
    expect(satir('Riskli öğrenci (bugün)')).toMatchObject({ bu: 1, gecen: null })
    expect([...r.iyi, ...r.dikkat].some(m => m.includes('Riskli'))).toBe(false)
  })

  it('sınıflar en çok düşen önce; iyi/dikkat maddeleri sayılardan çıkar', () => {
    expect(r.siniflar.map(c => c.ad)).toEqual(['9-B', '9-A'])
    expect(r.iyi).toContain('9-A tamamlanma %0 → %100')
    expect(r.iyi).toContain('Okul geneli ödev tamamlanma %25 → %67')
    expect(r.dikkat).toContain('9-B tamamlanma %100 → %0')
    expect(r.dikkat.some(d => d.startsWith('1 ödev 3 günden uzun'))).toBe(true)
  })

  it('küçük oynamalar madde üretmez', () => {
    const r2 = aylikRapor({ ...girdi, homeworks: [odev('x', 'A', '2026-10-10'), odev('y', 'A', '2026-09-10')],
      submissions: [isaret('x', 'a1', 'yapildi'), isaret('y', 'a1', 'yapildi')] })
    expect(r2.iyi).toEqual([])
    expect(r2.dikkat).toEqual([])
  })
})
