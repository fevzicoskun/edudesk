import { describe, it, expect } from 'vitest'
import { odevTakibi, type TakipOdev, type TakipTeslim } from '@/src/domains/homework/lib/odev-takibi'
import { odevKarnesiBolumleri, KARNE_RISKLI_EN_FAZLA } from '@/src/domains/homework/lib/odevKarnesi'

const BUGUN = '2026-10-10'
const hw = (id: string, p: Partial<TakipOdev> = {}): TakipOdev => ({
  id, title: `Ödev ${id}`, subject: 'Matematik', class_id: 'c1', teacher_id: 't1',
  due_date: '2026-10-01', assigned_date: '2026-09-28', ...p,
})
const sub = (homework_id: string, student_id: string, status: string): TakipTeslim =>
  ({ homework_id, student_id, status, marked_at: '2026-10-02T10:00:00Z' })

function sonuc(homeworks: TakipOdev[], submissions: TakipTeslim[], ogrenciSayisi = 1) {
  const students = Array.from({ length: ogrenciSayisi }, (_, i) => ({ id: `s${i}`, full_name: `Öğrenci ${i}`, class_id: 'c1' }))
  return odevTakibi({
    homeworks, submissions, students, ders: null, bugun: BUGUN,
    ogretmenler: new Map([['t1', 'Fevzi Coşkun']]), siniflar: new Map([['c1', '9-A']]),
  })
}
const bolum = (b: ReturnType<typeof odevKarnesiBolumleri>, baslik: string) => b.find(x => x.baslik === baslik)!

describe('odevKarnesiBolumleri()', () => {
  const odevler = [hw('h1'), hw('h2'), hw('h3'), hw('h4'), hw('h5'), hw('h6', { title: 'Bekleyen', due_date: '2026-10-05' })]
  const isaretler = ['h1', 'h2', 'h3', 'h4', 'h5'].map((h, i) => sub(h, 's0', i < 2 ? 'yapilmadi' : 'yapildi'))
  const b = odevKarnesiBolumleri(sonuc(odevler, isaretler))

  it('bölümler sabit sırada', () => {
    expect(b.map(x => x.baslik)).toEqual([
      'Derslere göre', 'Sınıflara göre tamamlanma', 'Öğretmenlere göre', 'Riskli öğrenciler', 'Bekleyen kontroller',
    ])
  })

  it('ders satırı: ödev, kontrol edildi, bekleyen, tamamlanma, veren', () => {
    expect(bolum(b, 'Derslere göre').body).toEqual([['Matematik', '6', '5', '1', '%60', 'Fevzi Coşkun 6']])
  })

  it('sınıf ve öğretmen satırları; kontrol edilmemişte —', () => {
    expect(bolum(b, 'Sınıflara göre tamamlanma').body).toEqual([['9-A', '6', '%60']])
    expect(bolum(b, 'Öğretmenlere göre').body).toEqual([['Fevzi Coşkun', '6', '%83', '5 gün']])
  })

  it('riskli öğrenci: oran, kaçırma/kontrol, dersler', () => {
    expect(bolum(b, 'Riskli öğrenciler').body).toEqual([['Öğrenci 0', '9-A', '%40', '2/5', 'Matematik 2']])
  })

  it('bekleyen kontroller: en eski üstte, gün olarak', () => {
    expect(bolum(b, 'Bekleyen kontroller').body).toEqual([['Bekleyen', 'Matematik', '9-A', 'Fevzi Coşkun', '5 gün']])
  })

  it(`riskli öğrenci en fazla ${KARNE_RISKLI_EN_FAZLA}; kalan sayısı notta`, () => {
    const n = KARNE_RISKLI_EN_FAZLA + 3
    const isaret = Array.from({ length: n }, (_, s) => ['h1', 'h2', 'h3', 'h4', 'h5'].map(h => sub(h, `s${s}`, 'yapilmadi'))).flat()
    const r = bolum(odevKarnesiBolumleri(sonuc(odevler, isaret, n)), 'Riskli öğrenciler')
    expect(r.body).toHaveLength(KARNE_RISKLI_EN_FAZLA)
    expect(r.not).toContain('3 öğrenci daha')
  })

  it('boş veri → her bölümde açıklayıcı tek satır, çökme yok', () => {
    const bos = odevKarnesiBolumleri(sonuc([], []))
    for (const x of bos) expect(x.body).toHaveLength(1)
    expect(bolum(bos, 'Bekleyen kontroller').body[0][0]).toBe('Kontrol bekleyen ödev yok')
  })
})
