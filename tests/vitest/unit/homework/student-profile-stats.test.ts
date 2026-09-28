import { describe, it, expect } from 'vitest'
import { computeStudentHomeworkStats, bekliyorMu } from '@/src/domains/homework/lib/stats'
import type { SubmissionStatus } from '@/src/shared/types'

type Record = { id: string; title: string; subject: string; due_date: string; status: SubmissionStatus | null; note: string | null; teacher_id: string; bekliyor: boolean }

const hw = (id: string, status: SubmissionStatus | null, bekliyor = false): Record =>
  ({ id, title: `Ödev ${id}`, subject: 'Mat', due_date: '2026-06-01', status, note: null, teacher_id: 't1', bekliyor })

describe('computeStudentHomeworkStats()', () => {
  it('boş liste → sıfır istatistik, rate=0', () => {
    const s = computeStudentHomeworkStats([])
    expect(s).toEqual({ total: 0, yapildi: 0, eksik: 0, yapilmadi: 0, gec: 0, mazeretli: 0, kontrolEdilmedi: 0, bekliyor: 0, degerlendirilen: 0, completionRate: 0 })
  })

  it('tüm yapıldı → rate=100', () => {
    const s = computeStudentHomeworkStats([hw('1','yapildi'), hw('2','yapildi')])
    expect(s.completionRate).toBe(100)
    expect(s.yapildi).toBe(2)
  })

  it('mazeretli hariç tutulur: 2 yapıldı + 1 mazeretli → rate=100', () => {
    const s = computeStudentHomeworkStats([hw('1','yapildi'), hw('2','yapildi'), hw('3','mazeretli')])
    expect(s.completionRate).toBe(100)
    expect(s.total).toBe(3)
    expect(s.mazeretli).toBe(1)
  })

  it('tümü mazeretli → eligible=0 → rate=0', () => {
    const s = computeStudentHomeworkStats([hw('1','mazeretli'), hw('2','mazeretli')])
    expect(s.completionRate).toBe(0)
  })

  it('3 yapıldı / 4 eligible → rate=75', () => {
    const list = [hw('1','yapildi'), hw('2','yapildi'), hw('3','yapildi'), hw('4','yapilmadi')]
    const s = computeStudentHomeworkStats(list)
    expect(s.completionRate).toBe(75)
  })

  it('karışık durumlar — sayılar doğru', () => {
    const list = [
      hw('1','yapildi'), hw('2','eksik'), hw('3','yapilmadi'),
      hw('4','gec'), hw('5','mazeretli'),
    ]
    const s = computeStudentHomeworkStats(list)
    expect(s).toMatchObject({ total: 5, yapildi: 1, eksik: 1, yapilmadi: 1, gec: 1, mazeretli: 1 })
  })

  // Öğretmen henüz işaretlememiş ödev "yapılmadı" değildir; oranı düşürmez.
  it('kontrol edilmemiş ödev ayrı sayılır ve orana girmez', () => {
    const s = computeStudentHomeworkStats([hw('1','yapildi'), hw('2', null), hw('3', null)])
    expect(s).toMatchObject({ total: 3, yapildi: 1, yapilmadi: 0, kontrolEdilmedi: 2, completionRate: 100 })
  })

  it('teslimi gelmemiş (bekliyor) ödev ayrı sayılır, "kontrol edilmedi" değildir, orana girmez', () => {
    const s = computeStudentHomeworkStats([hw('1','yapildi'), hw('2', null, true), hw('3', null)])
    expect(s).toMatchObject({ total: 3, yapildi: 1, bekliyor: 1, kontrolEdilmedi: 1, degerlendirilen: 1, completionRate: 100 })
  })

  it('degerlendirilen = işaretli ve mazeretli olmayan (tek formül)', () => {
    const s = computeStudentHomeworkStats([hw('1','yapildi'), hw('2','eksik'), hw('3','mazeretli'), hw('4', null, true), hw('5', null)])
    expect(s.degerlendirilen).toBe(2)
    expect(s.degerlendirilen).toBe(s.total - s.mazeretli - s.kontrolEdilmedi - s.bekliyor)
  })
})

describe('bekliyorMu() — İstanbul gününe göre', () => {
  it('işaretsiz ve son teslim bugün ya da ileride → bekliyor', () => {
    expect(bekliyorMu(null, '2026-09-28', '2026-09-28')).toBe(true)
    expect(bekliyorMu(null, '2026-10-05', '2026-09-28')).toBe(true)
  })

  it('işaretsiz ve son teslim geçmiş → bekliyor değil (kontrol edilmedi)', () => {
    expect(bekliyorMu(null, '2026-09-27', '2026-09-28')).toBe(false)
  })

  it('işaretli ödev asla bekliyor değil; son teslimi yoksa bekliyor değil', () => {
    expect(bekliyorMu('yapildi', '2026-10-05', '2026-09-28')).toBe(false)
    expect(bekliyorMu(null, null, '2026-09-28')).toBe(false)
  })
})
