import { describe, it, expect } from 'vitest'
import { kontrolBekleyenOzet } from '@/src/domains/dashboard/lib/kontrolBekleyen'

describe('kontrolBekleyenOzet', () => {
  const bugun = '2026-11-06'
  it('yalnız işaretsiz ve 14 günden eski ödevleri öğretmene göre toplar, en eskisi önce', () => {
    const r = kontrolBekleyenOzet([
      { teacher_id: 'a', referans: '2026-10-15', isaretli: 0 }, // 22 gün
      { teacher_id: 'a', referans: '2026-10-20', isaretli: 0 }, // 17 gün
      { teacher_id: 'b', referans: '2026-10-21', isaretli: 0 }, // 16 gün
      { teacher_id: 'c', referans: '2026-10-01', isaretli: 3 }, // kontrol edilmiş
      { teacher_id: 'd', referans: '2026-10-23', isaretli: 0 }, // tam 14 gün: henüz değil
    ], bugun)
    expect(r).toEqual([
      { id: 'a', odev: 2, enEskiGun: 22 },
      { id: 'b', odev: 1, enEskiGun: 16 },
    ])
  })
  it('bekleyen yoksa boş', () => {
    expect(kontrolBekleyenOzet([], bugun)).toEqual([])
  })
})
