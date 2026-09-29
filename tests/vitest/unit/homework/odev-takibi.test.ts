import { describe, it, expect } from 'vitest'
import { odevTakibi, type TakipOdev, type TakipTeslim } from '@/src/domains/homework/lib/odev-takibi'

const BUGUN = '2026-09-29'

function hw(id: string, p: Partial<TakipOdev> = {}): TakipOdev {
  return {
    id, title: `Ödev ${id}`, subject: 'Matematik', class_id: 'c1', teacher_id: 't1',
    due_date: '2026-09-25', assigned_date: '2026-09-20', ...p,
  }
}
function sub(homework_id: string, student_id: string, status: TakipTeslim['status'], marked_at = '2026-09-26T10:00:00Z'): TakipTeslim {
  return { homework_id, student_id, status, marked_at }
}
const students = [
  { id: 's1', full_name: 'Ali', class_id: 'c1' },
  { id: 's2', full_name: 'Ayşe', class_id: 'c1' },
]
const ogretmenler = new Map([['t1', 'Fevzi Coşkun'], ['t2', 'Hüseyin İnal']])
const siniflar = new Map([['c1', '9-A']])

function calistir(homeworks: TakipOdev[], submissions: TakipTeslim[] = [], ders: string | null = null) {
  return odevTakibi({ homeworks, submissions, students, ogretmenler, siniflar, bugun: BUGUN, ders })
}

describe('odevTakibi() — ders satırları', () => {
  it('derse göre sayar, giren öğretmenleri çoktan aza listeler', () => {
    const r = calistir([
      hw('h1'), hw('h2'), hw('h3', { teacher_id: 't2' }),
      hw('h4', { subject: 'Coğrafya' }),
    ])
    const mat = r.dersler.find(d => d.ad === 'Matematik')!
    expect(mat.odev).toBe(3)
    expect(mat.girenler).toEqual([{ ad: 'Fevzi Coşkun', sayi: 2 }, { ad: 'Hüseyin İnal', sayi: 1 }])
    expect(r.dersler.map(d => d.ad)).toEqual(['Matematik', 'Coğrafya']) // çok ödevli önce
  })

  it('büyük/küçük harf ve boşluk farkı aynı derstir', () => {
    const r = calistir([hw('h1', { subject: 'Matematik' }), hw('h2', { subject: ' matematik ' })])
    expect(r.dersler).toHaveLength(1)
    expect(r.dersler[0].odev).toBe(2)
  })

  it('ders satırında kontrol edildi / kontrol edilecek / bekliyor ayrımı', () => {
    const r = calistir([
      hw('h1'),                                   // işaretli → kontrol edildi
      hw('h2'),                                   // teslim geçti, işaret yok → kontrol edilecek
      hw('h3', { due_date: BUGUN }),              // teslim bugün → bekliyor (henüz kontrol edilemez)
    ], [sub('h1', 's1', 'yapildi')])
    const mat = r.dersler[0]
    expect(mat).toMatchObject({ kontrolEdildi: 1, kontrolEdilecek: 1, bekliyor: 1 })
  })

  it('ders süzmesi ders satırlarını değil listeleri süzer (çipler hep görünür)', () => {
    const r = calistir([hw('h1'), hw('h2', { subject: 'Coğrafya' })], [], 'coğrafya')
    expect(r.dersler).toHaveLength(2)
    expect(r.kontrolEdilecek.map(k => k.id)).toEqual(['h2'])
  })

  it('bozuk ders adresi → tüm liste', () => {
    const r = calistir([hw('h1'), hw('h2', { subject: 'Coğrafya' })], [], 'olmayan-ders')
    expect(r.kontrolEdilecek).toHaveLength(2)
  })
})

describe('odevTakibi() — kontrol listeleri', () => {
  it('kontrol edilecek: en eskisi üstte, bekleme günü İstanbul gününe göre', () => {
    const r = calistir([hw('h1', { due_date: '2026-09-27' }), hw('h2', { due_date: '2026-09-20' })])
    expect(r.kontrolEdilecek.map(k => [k.id, k.gun])).toEqual([['h2', 9], ['h1', 2]])
    expect(r.kontrolEdilecek[0]).toMatchObject({ sinif: '9-A', ogretmen: 'Fevzi Coşkun', subject: 'Matematik' })
  })

  it('dün teslimli ödev 1 gündür bekliyor; bugün teslimli listede yok', () => {
    const r = calistir([hw('h1', { due_date: '2026-09-28' }), hw('h2', { due_date: BUGUN })])
    expect(r.kontrolEdilecek.map(k => [k.id, k.gun])).toEqual([['h1', 1]])
  })

  it('son teslimi olmayan ödev veriliş gününe göre bekler (kaybolmaz)', () => {
    const r = calistir([hw('h1', { due_date: null, assigned_date: '2026-09-22' })])
    expect(r.kontrolEdilecek.map(k => [k.id, k.gun])).toEqual([['h1', 7]])
  })

  it('3 günden fazla bekleyen gecikmiş sayılır', () => {
    const r = calistir([hw('h1', { due_date: '2026-09-26' }), hw('h2', { due_date: '2026-09-25' })])
    expect(r.gecikenler.map(k => k.id)).toEqual(['h2']) // 3 gün = sınırda, gecikmiş değil; 4 gün gecikmiş
  })

  it('kontrol edilen: son işaretlenen üstte, işaretli durum sayıları', () => {
    const r = calistir([hw('h1'), hw('h2')], [
      sub('h1', 's1', 'yapildi', '2026-09-26T10:00:00Z'),
      sub('h1', 's2', 'yapilmadi', '2026-09-26T10:00:00Z'),
      sub('h2', 's1', 'eksik', '2026-09-28T10:00:00Z'),
    ])
    expect(r.kontrolEdilen.map(k => k.id)).toEqual(['h2', 'h1'])
    expect(r.kontrolEdilen[1]).toMatchObject({ yapildi: 1, eksik: 0, yapilmadi: 1 })
    expect(r.kontrolEdilen[0]).toMatchObject({ yapildi: 0, eksik: 1, yapilmadi: 0 })
  })
})

describe('odevTakibi() — riskli öğrenciler', () => {
  const ucOdev = [hw('h1'), hw('h2'), hw('h3', { subject: 'Coğrafya' })]

  it('3+ yapılmadı/eksik → riskli, ders kırılımıyla', () => {
    const r = calistir(ucOdev, [
      sub('h1', 's1', 'yapilmadi'), sub('h2', 's1', 'eksik'), sub('h3', 's1', 'yapilmadi'),
      sub('h1', 's2', 'yapilmadi'), sub('h2', 's2', 'yapildi'), sub('h3', 's2', 'gec'),
    ])
    expect(r.riskliOgrenciler).toHaveLength(1)
    expect(r.riskliOgrenciler[0]).toMatchObject({ id: 's1', ad: 'Ali', sinif: '9-A', toplam: 3 })
    expect(r.riskliOgrenciler[0].dersler).toEqual([{ ad: 'Matematik', sayi: 2 }, { ad: 'Coğrafya', sayi: 1 }])
  })

  it('ders süzmesinde yalnız o dersin kaçırmaları sayılır', () => {
    const r = calistir(ucOdev, [
      sub('h1', 's1', 'yapilmadi'), sub('h2', 's1', 'eksik'), sub('h3', 's1', 'yapilmadi'),
    ], 'matematik')
    expect(r.riskliOgrenciler).toHaveLength(0) // Matematik'te yalnız 2
  })

  it('silinmiş/başka sınıftaki öğrenciye ait teslim sayılmaz', () => {
    const r = calistir(ucOdev, [
      sub('h1', 'yok', 'yapilmadi'), sub('h2', 'yok', 'yapilmadi'), sub('h3', 'yok', 'yapilmadi'),
    ])
    expect(r.riskliOgrenciler).toHaveLength(0)
  })
})
