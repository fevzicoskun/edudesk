import { describe, it, expect } from 'vitest'
import { sonOdevEksik } from '@/src/domains/classes/lib/sonOdevEksik'

describe('sonOdevEksik', () => {
  // odevler yeniden eskiye: h1 en yeni
  const odevler = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  const sub = (h: string, status: string, s = 'a') => ({ homework_id: h, student_id: s, status })

  it('işaretli en yeni 5 ödevde yapılmadı ve eksik AYRI sayılır; geç sayılmaz', () => {
    const r = sonOdevEksik(odevler, [sub('h1', 'yapilmadi'), sub('h2', 'eksik'), sub('h3', 'gec'), sub('h4', 'yapildi'), sub('h5', 'yapilmadi'), sub('h6', 'yapilmadi')])
    expect(r.get('a')).toEqual({ bakilan: 5, yapilmadi: 2, eksik: 1 })
  })

  it('işaretlenmemiş ve mazeretli ödev pencereye girmez', () => {
    const r = sonOdevEksik(odevler, [sub('h2', 'mazeretli'), sub('h3', 'yapilmadi')])
    expect(r.get('a')).toEqual({ bakilan: 1, yapilmadi: 1, eksik: 0 })
  })

  it('başka ödevin satırı ve hiç işaretlenmemiş öğrenci yok sayılır', () => {
    const r = sonOdevEksik(odevler, [sub('baska', 'yapilmadi', 'b')])
    expect(r.has('b')).toBe(false)
  })
})
