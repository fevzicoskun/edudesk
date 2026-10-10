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

describe('odevTakibi() — riskli öğrenciler (%30 kuralı)', () => {
  // Ali 5 ödevin 2'sini kaçırdı (%40) → riskli; Ayşe 5'te 1 (%20) → değil
  const besOdev = [hw('h1'), hw('h2'), hw('h3'), hw('h4', { subject: 'Coğrafya' }), hw('h5', { subject: 'Coğrafya' })]
  const isaretler = [
    sub('h1', 's1', 'yapilmadi'), sub('h2', 's1', 'yapildi'), sub('h3', 's1', 'yapildi'), sub('h4', 's1', 'eksik'), sub('h5', 's1', 'gec'),
    sub('h1', 's2', 'yapilmadi'), sub('h2', 's2', 'yapildi'), sub('h3', 's2', 'yapildi'), sub('h4', 's2', 'yapildi'), sub('h5', 's2', 'yapildi'),
  ]

  it('kontrol edilen ödevlerin %30+ yapılmadı/eksik → riskli, oran ve ders kırılımıyla', () => {
    const r = calistir(besOdev, isaretler)
    expect(r.riskliOgrenciler).toHaveLength(1)
    expect(r.riskliOgrenciler[0]).toMatchObject({ id: 's1', ad: 'Ali', sinif: '9-A', toplam: 2, isaretli: 5, oran: 40 })
    expect(r.riskliOgrenciler[0].dersler).toEqual([{ ad: 'Matematik', sayi: 1 }, { ad: 'Coğrafya', sayi: 1 }])
  })

  it('tam %30 sınırdadır → riskli', () => {
    const on = Array.from({ length: 10 }, (_, i) => hw(`k${i}`))
    const r = calistir(on, on.map((h, i) => sub(h.id, 's1', i < 3 ? 'yapilmadi' : 'yapildi')))
    expect(r.riskliOgrenciler.map(o => o.oran)).toEqual([30])
  })

  it("5'ten az kontrol edilmiş ödevi olan öğrenci risk listesine girmez (az veriyle %100 yanıltır)", () => {
    const dort = besOdev.slice(0, 4)
    const r = calistir(dort, dort.map(h => sub(h.id, 's1', 'yapilmadi')))
    expect(r.riskliOgrenciler).toHaveLength(0)
  })

  it('mazeretli payda dışıdır (6 işaret, 1 mazeretli, 2 kaçırma = %40)', () => {
    const alti = [...besOdev, hw('h6')]
    const r = calistir(alti, [
      sub('h1', 's1', 'yapilmadi'), sub('h2', 's1', 'eksik'), sub('h3', 's1', 'mazeretli'),
      sub('h4', 's1', 'yapildi'), sub('h5', 's1', 'yapildi'), sub('h6', 's1', 'yapildi'),
    ])
    expect(r.riskliOgrenciler[0]).toMatchObject({ isaretli: 5, oran: 40 })
  })

  it('en yüksek oran üstte', () => {
    const r = calistir(besOdev, [
      ...besOdev.map((h, i) => sub(h.id, 's1', i < 2 ? 'yapilmadi' : 'yapildi')),
      ...besOdev.map((h, i) => sub(h.id, 's2', i < 4 ? 'yapilmadi' : 'yapildi')),
    ])
    expect(r.riskliOgrenciler.map(o => [o.ad, o.oran])).toEqual([['Ayşe', 80], ['Ali', 40]])
  })

  it('ders süzmesinde yalnız o dersin ödevleri sayılır', () => {
    const r = calistir(besOdev, besOdev.map(h => sub(h.id, 's1', 'yapilmadi')), 'matematik')
    expect(r.riskliOgrenciler).toHaveLength(0) // Matematik'te yalnız 3 kontrol edilmiş ödev
  })

  it('silinmiş/başka sınıftaki öğrenciye ait teslim sayılmaz', () => {
    const r = calistir(besOdev, besOdev.map(h => sub(h.id, 'yok', 'yapilmadi')))
    expect(r.riskliOgrenciler).toHaveLength(0)
  })
})

describe('odevTakibi() — tamamlanma oranları', () => {
  it('ders satırında tamamlanma: yapıldı / (işaretli − mazeretli); işaret yoksa null', () => {
    const r = calistir([hw('h1'), hw('h2'), hw('h3', { subject: 'Coğrafya' })], [
      sub('h1', 's1', 'yapildi'), sub('h1', 's2', 'yapilmadi'), sub('h2', 's1', 'yapildi'), sub('h2', 's2', 'mazeretli'),
    ])
    expect(r.dersler.find(d => d.ad === 'Matematik')!.tamamlanma).toBe(67)
    expect(r.dersler.find(d => d.ad === 'Coğrafya')!.tamamlanma).toBeNull()
  })

  it('sınıflar: en düşük tamamlanma üstte, işaretsiz sınıf sonda', () => {
    const r = odevTakibi({
      homeworks: [hw('h1'), hw('h2', { class_id: 'c2' }), hw('h3', { class_id: 'c3' })],
      submissions: [sub('h1', 's1', 'yapildi'), sub('h2', 's3', 'yapilmadi')],
      students: [...students, { id: 's3', full_name: 'Can', class_id: 'c2' }],
      ogretmenler, siniflar: new Map([['c1', '9-A'], ['c2', '10-A'], ['c3', '11-A']]), bugun: BUGUN, ders: null,
    })
    expect(r.siniflar.map(s => [s.ad, s.odev, s.tamamlanma])).toEqual([['10-A', 1, 0], ['9-A', 1, 100], ['11-A', 1, null]])
  })

  it('sınıflar ders süzmesine uyar', () => {
    const r = calistir([hw('h1'), hw('h2', { subject: 'Coğrafya' })], [], 'coğrafya')
    expect(r.siniflar.map(s => s.odev)).toEqual([1])
  })
})

describe('odevTakibi() — öğretmenler', () => {
  it('ödev sayısı, kontrol oranı ve en eski bekleyen kontrol günü; çok ödevli üstte', () => {
    const r = calistir([
      hw('h1'), hw('h2', { due_date: '2026-09-20' }), hw('h3', { due_date: BUGUN }),
      hw('h4', { teacher_id: 't2' }),
    ], [sub('h1', 's1', 'yapildi'), sub('h4', 's1', 'yapildi')])
    expect(r.ogretmenler).toEqual([
      { ad: 'Fevzi Coşkun', odev: 3, kontrolEdildi: 1, kontrolOrani: 50, enEskiBekleyen: 9 },
      { ad: 'Hüseyin İnal', odev: 1, kontrolEdildi: 1, kontrolOrani: 100, enEskiBekleyen: null },
    ])
  })
})
