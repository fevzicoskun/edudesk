import { describe, it, expect } from 'vitest'
import { buildStudentTimeline, type TimelineSources } from '@/src/domains/classes/lib/timelineMath'

const bos: TimelineSources = {
  attendance: [], submissions: [], grades: [], meetings: [],
  mentorReports: [], contactLogs: [], studentNotes: [],
}
const W = '2026-02-01' // pencere başı

describe('buildStudentTimeline', () => {
  it('tüm kaynaklar boş → []', () => {
    expect(buildStudentTimeline(bos, W)).toEqual([])
  })

  it('kaynakları birleştirir ve yeni→eski sıralar', () => {
    const r = buildStudentTimeline({
      ...bos,
      attendance: [{ date: '2026-03-10', status: 'absent' }],
      meetings: [{ date: '2026-03-12', status: 'yapildi', teacherName: 'Ali Hoca' }],
      contactLogs: [{ date: '2026-03-11T09:30:00Z', method: 'telefon' }],
    }, W)
    expect(r.map(e => e.kind)).toEqual(['gorusme', 'veli_iletisim', 'devamsizlik'])
  })

  it('pencere dışı ve bozuk/boş tarihli kayıtlar elenir', () => {
    const r = buildStudentTimeline({
      ...bos,
      attendance: [
        { date: '2026-01-15', status: 'absent' },  // pencere öncesi
        { date: 'garbage', status: 'absent' },      // bozuk
        { date: '2026-03-01', status: 'late' },     // geçerli
      ],
      grades: [{ examDate: null, title: 'Yazılı', score: 80, maxScore: 100 }], // null tarih
    }, W)
    expect(r).toHaveLength(1)
    expect(r[0].label).toBe('Geç geldi')
  })

  it('kayda değer olmayanlar girmez: yapildi/mazeretli ödev, iptal görüşme', () => {
    const r = buildStudentTimeline({
      ...bos,
      submissions: [
        { status: 'yapildi', dueDate: '2026-03-05', title: 'A' },
        { status: 'mazeretli', dueDate: '2026-03-05', title: 'B' },
        { status: 'yapilmadi', dueDate: '2026-03-05', title: 'Kesirler' },
      ],
      meetings: [{ date: '2026-03-06', status: 'iptal', teacherName: 'X' }],
    }, W)
    expect(r).toHaveLength(1)
    expect(r[0]).toEqual({ date: '2026-03-05', kind: 'odev', label: '"Kesirler" ödevi yapılmadı' })
  })

  it('etiket biçimleri doğru', () => {
    const r = buildStudentTimeline({
      ...bos,
      grades: [{ examDate: '2026-03-02', title: '1. Yazılı', score: 85, maxScore: 100 }],
      meetings: [{ date: '2026-03-03', status: 'planlandi', teacherName: 'Ayşe Hoca' }],
      mentorReports: [{ date: '2026-03-04' }],
      contactLogs: [{ date: '2026-03-05', method: 'e-posta' }],
      studentNotes: [{ date: '2026-03-06', body: 'a'.repeat(100) }],
    }, W)
    const byKind = Object.fromEntries(r.map(e => [e.kind, e.label]))
    expect(byKind['not']).toBe('"1. Yazılı": 85/100')
    expect(byKind['gorusme']).toBe('Veli görüşmesi (planlandı) — Ayşe Hoca')
    expect(byKind['rehberlik']).toBe('Rehberlik görüşmesi')
    expect(byKind['veli_iletisim']).toBe('Veli iletişimi (e-posta)')
    expect(byKind['ogretmen_notu']).toBe('a'.repeat(80) + '…')
  })

  it('timestamp tarihler pencere karşılaştırmasında gün bazında değerlendirilir', () => {
    const r = buildStudentTimeline({
      ...bos,
      studentNotes: [{ date: '2026-02-01T00:30:00Z', body: 'sınırda not' }],
    }, W)
    expect(r).toHaveLength(1) // 2026-02-01 == pencere başı → dahil
  })
})
