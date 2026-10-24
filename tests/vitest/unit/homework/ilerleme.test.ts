import { describe, it, expect } from 'vitest'
import { odevIlerleme, ilerlemeMetni, durumParcalari } from '@/src/domains/homework/lib/ilerleme'

const sayim = (y: number, n: number, m = 0, e = 0, g = 0) => ({ yapildi: y, yapilmadi: n, mazeretli: m, eksik: e, gec: g })
const toplam = (p: { n: number }[]) => p.reduce((a, b) => a + b.n, 0)

describe('odevIlerleme', () => {
  it('işaretlenmeyen öğrenci paydaya girmez: 15 kişi, 3 yaptı, 8 yapmadı → %27, 4 girilmedi', () => {
    const i = odevIlerleme(sayim(3, 8), 15)
    expect(i).toMatchObject({ yapildi: 3, payda: 11, yuzde: 27, girilmedi: 4 })
    expect(ilerlemeMetni(i)).toBe('%27 · 3 yaptı · 8 yapmadı · 4 girilmedi')
  })

  // Canlı vakalar (2026-10-24): eksik ve mazeretli metinde yoktu → sayılar mevcutla tutmuyordu
  it('12-A: 8 yaptı, 2 eksik, 8 yapmadı, 4 mazeretli = 22', () => {
    const i = odevIlerleme(sayim(8, 8, 4, 2), 22)
    expect(ilerlemeMetni(i)).toBe('%44 · 8 yaptı · 2 eksik · 8 yapmadı · 4 mazeretli')
    expect(toplam(durumParcalari(i))).toBe(22)
  })
  it('9-A Sayfa 60-61: 16 yaptı, 3 eksik, 1 yapmadı, 2 mazeretli, 2 girilmedi = 24', () => {
    const i = odevIlerleme(sayim(16, 1, 2, 3), 24)
    expect(ilerlemeMetni(i)).toBe('%80 · 16 yaptı · 3 eksik · 1 yapmadı · 2 mazeretli · 2 girilmedi')
    expect(toplam(durumParcalari(i))).toBe(24)
  })
  it('9-A Meb: 9 yaptı, 4 eksik, 11 yapmadı = 24; geç de yazılır', () => {
    expect(ilerlemeMetni(odevIlerleme(sayim(9, 11, 0, 4), 24))).toBe('%38 · 9 yaptı · 4 eksik · 11 yapmadı')
    expect(ilerlemeMetni(odevIlerleme(sayim(9, 10, 0, 4, 1), 24))).toBe('%38 · 9 yaptı · 4 eksik · 1 geç · 10 yapmadı')
  })

  it('mazeretli paydaya girmez ama girilmedi de sayılmaz', () => {
    expect(odevIlerleme(sayim(4, 0, 1), 5)).toMatchObject({ payda: 4, yuzde: 100, girilmedi: 0 })
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
