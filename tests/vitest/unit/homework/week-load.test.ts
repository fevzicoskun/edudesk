import { describe, it, expect } from 'vitest'
import { weekRange, buildClassWeekLoad } from '@/src/domains/homework/lib/week-load'

describe('weekRange()', () => {
  it('Pazartesi gününün haftası → Pzt–Paz', () => {
    expect(weekRange('2026-06-01')).toEqual({ start: '2026-06-01', end: '2026-06-07' })
  })
  it('Pazar gününden hafta başı bulunur', () => {
    expect(weekRange('2026-06-07')).toEqual({ start: '2026-06-01', end: '2026-06-07' })
  })
  it('Perşembe gününden hafta başı bulunur', () => {
    expect(weekRange('2026-06-04')).toEqual({ start: '2026-06-01', end: '2026-06-07' })
  })
  it('Sonraki hafta Pazartesi', () => {
    expect(weekRange('2026-06-08')).toEqual({ start: '2026-06-08', end: '2026-06-14' })
  })
  it('Yıl sonu/başı geçişi', () => {
    expect(weekRange('2026-12-31')).toEqual({ start: '2026-12-28', end: '2027-01-03' })
  })
  it('boş string → boş döner', () => {
    expect(weekRange('')).toEqual({ start: '', end: '' })
  })
  it('geçersiz format → boş döner', () => {
    expect(weekRange('invalid')).toEqual({ start: '', end: '' })
  })
  it('geçersiz tarih → boş döner', () => {
    expect(weekRange('2026-13-45')).toEqual({ start: '', end: '' })
  })
})

describe('buildClassWeekLoad()', () => {
  const raw = (subject: string, dueDate: string, teacherId: string) => ({
    subject,
    due_date: dueDate,
    teacher_id: teacherId,
    teacher_name: `Öğretmen ${teacherId}`,
  })

  it('ödev yok → count=0, level=ok', () => {
    const result = buildClassWeekLoad([], 'c1', '5/A', 't1')
    expect(result).toEqual({ classId: 'c1', className: '5/A', count: 0, items: [], level: 'ok' })
  })

  it('2 ödev → level=ok', () => {
    const result = buildClassWeekLoad(
      [raw('Matematik', '2026-06-02', 't1'), raw('Türkçe', '2026-06-03', 't2')],
      'c1', '5/A', 't1',
    )
    expect(result.count).toBe(2)
    expect(result.level).toBe('ok')
  })

  it('3 ödev → level=warn', () => {
    const rows = ['Matematik', 'Türkçe', 'Fen'].map((s, i) => raw(s, `2026-06-0${i + 1}`, 't1'))
    expect(buildClassWeekLoad(rows, 'c1', '5/A', 't1').level).toBe('warn')
  })

  it('5 ödev → level=danger', () => {
    const rows = ['Mat', 'Tür', 'Fen', 'Sos', 'İng'].map((s, i) => raw(s, `2026-06-0${i + 1}`, 't1'))
    expect(buildClassWeekLoad(rows, 'c1', '5/A', 't1').level).toBe('danger')
  })

  it('kendi ödevi → isOwn=true', () => {
    const result = buildClassWeekLoad([raw('Mat', '2026-06-01', 'me')], 'c1', '5/A', 'me')
    expect(result.items[0].isOwn).toBe(true)
  })

  it('başka öğretmenin ödevi → isOwn=false', () => {
    const result = buildClassWeekLoad([raw('Mat', '2026-06-01', 'other')], 'c1', '5/A', 'me')
    expect(result.items[0].isOwn).toBe(false)
  })

  it('items tarihe göre sıralı', () => {
    const rows = [
      raw('Fen', '2026-06-05', 't1'),
      raw('Mat', '2026-06-01', 't1'),
      raw('Tür', '2026-06-03', 't1'),
    ]
    const result = buildClassWeekLoad(rows, 'c1', '5/A', 't1')
    expect(result.items.map(i => i.subject)).toEqual(['Mat', 'Tür', 'Fen'])
  })

  it('ID dönmez — başka öğretmenin ödevine navigate edilemez', () => {
    const result = buildClassWeekLoad([raw('Mat', '2026-06-01', 'other')], 'c1', '5/A', 'me')
    expect((result.items[0] as Record<string, unknown>).id).toBeUndefined()
  })

  it('boş due_date olan satırlar filtrelenir', () => {
    const rows = [
      raw('Mat', '2026-06-01', 't1'),
      { subject: 'Fen', due_date: '', teacher_id: 't1', teacher_name: 'Öğretmen t1' },
    ]
    const result = buildClassWeekLoad(rows, 'c1', '5/A', 't1')
    expect(result.count).toBe(1)
    expect(result.items[0].subject).toBe('Mat')
  })

  it('boş subject olan satırlar filtrelenir', () => {
    const rows = [
      raw('Mat', '2026-06-01', 't1'),
      { subject: '', due_date: '2026-06-02', teacher_id: 't1', teacher_name: 'Öğretmen t1' },
    ]
    const result = buildClassWeekLoad(rows, 'c1', '5/A', 't1')
    expect(result.count).toBe(1)
  })
})
