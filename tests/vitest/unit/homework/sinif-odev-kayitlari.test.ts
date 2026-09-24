import { describe, it, expect } from 'vitest'
import { sinifOdevKayitlari } from '@/src/domains/homework/lib/stats'

const hw = (id: string) => ({ id, title: `Ödev ${id}`, subject: 'Matematik', due_date: '2026-09-20' })
const sub = (homework_id: string, student_id: string, status: string, note: string | null = null) =>
  ({ homework_id, student_id, status, note })

describe('sinifOdevKayitlari() — toplu öğrenci ödev özeti', () => {
  it('her öğrenciye sınıfın tüm ödevleri gelir; işareti olmayan ödev status=null (kontrol edilmedi)', () => {
    const m = sinifOdevKayitlari(
      ['ali', 'ayse'],
      [hw('h1'), hw('h2')],
      [sub('h1', 'ali', 'yapildi'), sub('h2', 'ayse', 'eksik', 'yarım')],
    )
    expect(m.get('ali')!.map(r => [r.id, r.status])).toEqual([['h1', 'yapildi'], ['h2', null]])
    expect(m.get('ayse')!.map(r => [r.id, r.status, r.note])).toEqual([['h1', null, null], ['h2', 'eksik', 'yarım']])
  })

  it('başka öğrencinin teslimi karışmaz; ödevsiz sınıfta boş liste', () => {
    const m = sinifOdevKayitlari(['ali'], [], [sub('h1', 'veli', 'yapildi')])
    expect(m.get('ali')).toEqual([])
  })
})
