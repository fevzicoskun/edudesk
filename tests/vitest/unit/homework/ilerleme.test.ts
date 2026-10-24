import { describe, it, expect } from 'vitest'
import { odevIlerleme, ilerlemeMetni } from '@/src/domains/homework/lib/ilerleme'

const sayim = (y: number, n: number, m = 0, e = 0, g = 0) => ({ yapildi: y, yapilmadi: n, mazeretli: m, eksik: e, gec: g })

describe('odevIlerleme', () => {
  it('işaretlenmeyen öğrenci paydaya girmez: 15 kişi, 3 yaptı, 8 yapmadı → %27, 4 girilmedi', () => {
    const i = odevIlerleme(sayim(3, 8), 15)
    expect(i).toMatchObject({ yapildi: 3, payda: 11, yuzde: 27, girilmedi: 4 })
    expect(ilerlemeMetni(i)).toBe('%27 · 3/11 yaptı · 4 girilmedi')
  })

  it('herkes işaretliyse girilmedi yazmaz', () => {
    expect(ilerlemeMetni(odevIlerleme(sayim(10, 5), 15))).toBe('%67 · 10/15 yaptı')
  })

  it('mazeretli paydaya girmez ama girilmedi de sayılmaz', () => {
    const i = odevIlerleme(sayim(4, 0, 1), 5)
    expect(i).toMatchObject({ payda: 4, yuzde: 100, girilmedi: 0 })
  })

  it('hiç işaretlenmemiş → yüzde yok, metin null', () => {
    const i = odevIlerleme({}, 22)
    expect(i).toMatchObject({ yuzde: null, girilmedi: 22 })
    expect(ilerlemeMetni(i)).toBeNull()
  })

  it('mevcut bilinmiyorsa (0) girilmedi 0', () => {
    expect(odevIlerleme(sayim(2, 1), 0).girilmedi).toBe(0)
  })
})
