import { describe, it, expect } from 'vitest'
import { tamamlanmaSatirlari } from '@/src/domains/dashboard/lib/tamamlanma'

const hw = (id: string, due_date: string, class_id = 'c1') => ({
  id, title: `Ödev ${id}`, subject: 'Matematik', due_date, class_id, classes: { name: '11-B', grade: 11 },
})
const sub = (homework_id: string, status: string) => ({ homework_id, student_id: 'x', status })

describe('tamamlanmaSatirlari()', () => {
  it('her durum kendi sayısına gider — geç ve mazeretli "yapılmadı" SAYILMAZ', () => {
    const [s] = tamamlanmaSatirlari([hw('h1', '2026-09-20')], [
      sub('h1', 'yapildi'), sub('h1', 'yapildi'), sub('h1', 'gec'), sub('h1', 'mazeretli'), sub('h1', 'yapilmadi'), sub('h1', 'eksik'),
    ], '2026-09-26')
    expect(s.sayim).toEqual({ yapildi: 2, gec: 1, eksik: 1, yapilmadi: 1, mazeretli: 1 })
    expect(s.isaretli).toBe(6)
  })

  it('kontrol edilmemiş ödev: işaretli 0 (arayüz "%0" değil "henüz kontrol edilmedi" der)', () => {
    const [s] = tamamlanmaSatirlari([hw('h1', '2026-09-20')], [], '2026-09-26')
    expect(s.isaretli).toBe(0)
  })

  it('teslimi gelmemiş ödev listelenmez; en yeni teslim en üstte', () => {
    const satirlar = tamamlanmaSatirlari(
      [hw('eski', '2026-09-10'), hw('yeni', '2026-09-25'), hw('gelecek', '2026-09-30')], [], '2026-09-26')
    expect(satirlar.map(s => s.id)).toEqual(['yeni', 'eski'])
  })

  it('başlık kırpılmaz; sınıf adı ve teslim tarihi taşınır', () => {
    const [s] = tamamlanmaSatirlari([hw('h1', '2026-09-20')], [], '2026-09-26')
    expect(s).toMatchObject({ title: 'Ödev h1', className: '11-B', dueDate: '2026-09-20', classId: 'c1' })
  })

  it('sınıf başına en fazla 6 ödev', () => {
    const hws = Array.from({ length: 8 }, (_, i) => hw(`h${i}`, `2026-09-${10 + i}`))
    expect(tamamlanmaSatirlari(hws, [], '2026-09-26')).toHaveLength(6)
  })
})
