import { describe, it, expect } from 'vitest'
import { odevKapsami } from '@/src/domains/homework/lib/kapsam'

const okul = [
  { id: 'zb',  subject: 'Matematik' },
  { id: 'm1',  subject: 'matematik ' },  // yazım farkı aynı zümre sayılır
  { id: 'm2',  subject: 'Matematik' },
  { id: 'cog', subject: 'Coğrafya' },
  { id: 'bos', subject: null },
]

describe('odevKapsami()', () => {
  it('müdür ve MY tüm ödevleri görür', () => {
    expect(odevKapsami({ id: 'x', role: 'mudur', subject: null }, okul)).toEqual({ tumu: true })
    expect(odevKapsami({ id: 'x', role: 'mudur_yardimcisi', subject: '' }, okul)).toEqual({ tumu: true })
  })

  it('öğretmen yalnız kendi ödevlerini görür', () => {
    expect(odevKapsami({ id: 'm1', role: 'ogretmen', subject: 'Matematik' }, okul))
      .toEqual({ tumu: false, ogretmenIds: ['m1'] })
  })

  it('zümre başkanı kendi branşındaki öğretmenlerin ödevlerini görür (kendisi dahil)', () => {
    const k = odevKapsami({ id: 'zb', role: 'zumre_baskani', subject: 'Matematik' }, okul)
    expect(k.tumu).toBe(false)
    expect(!k.tumu && [...k.ogretmenIds].sort()).toEqual(['m1', 'm2', 'zb'])
  })

  it('branşı boş zümre başkanı yalnız kendini görür (tüm okula açılmaz)', () => {
    expect(odevKapsami({ id: 'zb', role: 'zumre_baskani', subject: '  ' }, okul))
      .toEqual({ tumu: false, ogretmenIds: ['zb'] })
  })
})
