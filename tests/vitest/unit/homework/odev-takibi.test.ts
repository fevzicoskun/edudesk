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

describe('odevTakibi() — riskli öğrenciler (ders bazlı: en az 3 ödev, %50)', () => {
  const mat = (n: number, onEk = 'm') => Array.from({ length: n }, (_, i) => hw(`${onEk}${i}`))
  const cog = (n: number) => Array.from({ length: n }, (_, i) => hw(`c${i}`, { subject: 'Coğrafya' }))

  it("arkadaş örneği: sözellerin hepsi yapıldı, matematik kaçırıldı → yalnız Matematik'te riskli", () => {
    const m = mat(17), c = cog(8)
    const r = calistir([...m, ...c], [
      ...m.map((h, i) => sub(h.id, 's1', i < 12 ? 'yapilmadi' : 'yapildi')),
      ...c.map(h => sub(h.id, 's1', 'yapildi')),
    ])
    expect(r.riskliOgrenciler).toHaveLength(1)
    expect(r.riskliOgrenciler[0]).toMatchObject({ id: 's1', ad: 'Ali', sinif: '9-A' })
    expect(r.riskliOgrenciler[0].dersler).toEqual([{ ad: 'Matematik', kacirma: 12, payda: 17 }])
  })

  it('sulanma yok: az ödevli derste kaçırma genel ortalamada kaybolmaz', () => {
    const m = mat(22), c = cog(3)
    const r = calistir([...m, ...c], [
      ...m.map(h => sub(h.id, 's1', 'yapildi')),
      ...c.map(h => sub(h.id, 's1', 'yapilmadi')),
    ])
    expect(r.riskliOgrenciler[0].dersler).toEqual([{ ad: 'Coğrafya', kacirma: 3, payda: 3 }])
  })

  it('tam %50 sınırdadır → riskli; altı değil (eksik de kaçırma sayılır)', () => {
    const m = mat(4)
    const r = calistir(m, [
      ...m.map((h, i) => sub(h.id, 's1', i === 0 ? 'yapilmadi' : i === 1 ? 'eksik' : 'yapildi')),
      ...m.map((h, i) => sub(h.id, 's2', i === 0 ? 'yapilmadi' : 'yapildi')),
    ])
    expect(r.riskliOgrenciler.map(o => o.ad)).toEqual(['Ali'])
  })

  it("bir derste 3'ten az kontrol edilmiş ödev → o derste değerlendirilmez", () => {
    const m = mat(2)
    const r = calistir(m, m.map(h => sub(h.id, 's1', 'yapilmadi')))
    expect(r.riskliOgrenciler).toHaveLength(0)
  })

  it('mazeretli payda dışıdır (4 işaret, 1 mazeretli → payda 3)', () => {
    const m = mat(4)
    const r = calistir(m, [sub('m0', 's1', 'yapilmadi'), sub('m1', 's1', 'eksik'), sub('m2', 's1', 'mazeretli'), sub('m3', 's1', 'yapildi')])
    expect(r.riskliOgrenciler[0].dersler).toEqual([{ ad: 'Matematik', kacirma: 2, payda: 3 }])
  })

  it('sıralama: çok riskli dersi olan üstte, sonra toplam kaçırma; öğrenci içinde en yüksek oranlı ders önce', () => {
    const m = mat(4), c = cog(3)
    const r = calistir([...m, ...c], [
      ...m.map(h => sub(h.id, 's1', 'yapilmadi')),                       // Ali: yalnız Matematik 4/4
      ...m.map((h, i) => sub(h.id, 's2', i < 2 ? 'yapilmadi' : 'yapildi')), // Ayşe: Matematik 2/4
      ...c.map(h => sub(h.id, 's2', 'yapilmadi')),                       //       + Coğrafya 3/3
    ])
    expect(r.riskliOgrenciler.map(o => o.ad)).toEqual(['Ayşe', 'Ali'])
    expect(r.riskliOgrenciler[0].dersler.map(d => d.ad)).toEqual(['Coğrafya', 'Matematik'])
  })

  it('ders satırında o derste riskli öğrenci sayısı (süzmeden bağımsız)', () => {
    const m = mat(3), c = cog(3)
    const r = calistir([...m, ...c], [
      ...m.map(h => sub(h.id, 's1', 'yapilmadi')), ...m.map(h => sub(h.id, 's2', 'yapilmadi')),
      ...c.map(h => sub(h.id, 's1', 'yapildi')),
    ], 'coğrafya')
    expect(Object.fromEntries(r.dersler.map(d => [d.ad, d.riskli]))).toEqual({ Matematik: 2, Coğrafya: 0 })
  })

  it('ders süzmesinde yalnız o dersteki risk listelenir', () => {
    const m = mat(3), c = cog(3)
    const r = calistir([...m, ...c], [...m, ...c].map(h => sub(h.id, 's1', 'yapilmadi')), 'matematik')
    expect(r.riskliOgrenciler[0].dersler.map(d => d.ad)).toEqual(['Matematik'])
  })

  it('silinmiş/başka sınıftaki öğrenciye ait teslim sayılmaz', () => {
    const m = mat(3)
    const r = calistir(m, m.map(h => sub(h.id, 'yok', 'yapilmadi')))
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
