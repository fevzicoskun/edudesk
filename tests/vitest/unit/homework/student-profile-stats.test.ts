import { describe, it, expect } from 'vitest'
import { computeStudentHomeworkStats } from '@/src/domains/homework/lib/stats'
import type { SubmissionStatus } from '@/src/shared/types'

type Record = { id: string; title: string; subject: string; due_date: string; status: SubmissionStatus; note: string | null }

const hw = (id: string, status: SubmissionStatus): Record =>
  ({ id, title: `Ödev ${id}`, subject: 'Mat', due_date: '2026-06-01', status, note: null })

describe('computeStudentHomeworkStats()', () => {
  it('boş liste → sıfır istatistik, rate=0', () => {
    const s = computeStudentHomeworkStats([])
    expect(s).toEqual({ total: 0, yapildi: 0, eksik: 0, yapilmadi: 0, gec: 0, mazeretli: 0, completionRate: 0 })
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
})
