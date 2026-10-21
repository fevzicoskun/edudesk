import { describe, it, expect } from 'vitest'
import { odevleriBirlestir, odevEtiketi, odevGorevAdi, planDisi } from '@/src/domains/mentor/takip/odevYerlesim'
import type { CalismaSaatleri, GunSaati } from '@/src/domains/mentor/takip/calismaSaatleri'
import type { Gorev } from '@/src/domains/mentor/takip/takipMath'
import type { HomeworkRecord } from '@/src/domains/homework/lib/stats'

// Hafta 2026-10-19 (Pzt) · bugün 2026-10-21 (Çar)
const HAFTA = '2026-10-19', BUGUN = '2026-10-21'
const hi: GunSaati = { bas: '18:00', bit: '20:30' } // 150 dk → ödev payı 75
const SAAT: CalismaSaatleri = { gunler: [hi, hi, hi, hi, hi, null, { bas: '10:00', bit: '12:00' }], not: '' }
let n = 0
const odev = (due: string, o: Partial<HomeworkRecord> = {}): HomeworkRecord =>
  ({ id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, title: 'Ödev', subject: 'Fizik', due_date: due, status: null, note: null, teacher_id: 't', bekliyor: due >= BUGUN, ...o })
const elle = (o: Partial<Gorev> = {}): Gorev => ({ id: 'e', gun: 2, ad: 'Elle', ders: null, miktar: 60, birim: 'dk', soruSatiri: false, konu: '', sayfa: '', yapti: false, soru: null, dogru: null, ...o })
const birlestir = (odevler: HomeworkRecord[], o: Partial<Parameters<typeof odevleriBirlestir>[0]> = {}) =>
  odevleriBirlestir({ gorevler: [], gizli: [], odevler, saatler: SAAT, hafta: HAFTA, bugun: BUGUN, ...o })
const gunu = (r: ReturnType<typeof birlestir>, o: HomeworkRecord) => r.gorevler.find(g => g.odevId === o.id)?.gun

describe('odevleriBirlestir — yerleşim', () => {
  it('yarın teslim → bugün (teslimden 1 gün önce)', () => { const o = odev('2026-10-22'); expect(gunu(birlestir([o]), o)).toBe(2) })
  it('Cumartesi teslim → Cuma', () => { const o = odev('2026-10-24'); expect(gunu(birlestir([o]), o)).toBe(4) })
  it('Pazar teslim, Cumartesi çalışma yok → Cuma', () => { const o = odev('2026-10-25'); expect(gunu(birlestir([o]), o)).toBe(4) })
  it('gelecek Pazartesi teslim → bu Pazar', () => { const o = odev('2026-10-26'); expect(gunu(birlestir([o]), o)).toBe(6) })
  it('bugün teslim → bugün (hedef geçmişse ilk açık gün)', () => { const o = odev('2026-10-21'); expect(gunu(birlestir([o]), o)).toBe(2) })
  it('günün ödev payı dolunca önceki güne kayar', () => {
    const os = [odev('2026-10-24'), odev('2026-10-24'), odev('2026-10-24')] // hedef Cum; pay 75 → 2 ödev (60), 3.sü Per
    const r = birlestir(os)
    expect(os.map(o => gunu(r, o))).toEqual([4, 4, 3])
  })
  it('mentörün görevleri yerleşimde sayılmaz', () => {
    const o = odev('2026-10-24')
    expect(gunu(birlestir([o], { gorevler: [elle({ gun: 4, miktar: 150 })] }), o)).toBe(4)
  })
  it('hiçbir yere sığmazsa hedef güne aşımla girer', () => {
    const os = [odev('2026-10-22'), odev('2026-10-22'), odev('2026-10-22')] // hedef Çar = ilk gün; geriye gün yok
    const r = birlestir(os)
    expect(os.map(o => gunu(r, o))).toEqual([2, 2, 2])
    expect(r.disarida).toEqual([])
  })
  it('gecikmiş: en eski önce bugünden dağılır, sığmayan dışarıda', () => {
    // 2 gecikmiş/gün (pay 75); Çar–Cum 6 + Paz (pay 60) 2 = 8 yer; 9. dışarıda
    const os = Array.from({ length: 9 }, (_, i) => odev(`2026-10-${String(10 + i).padStart(2, '0')}`))
    const r = birlestir(os)
    expect(os.map(o => gunu(r, o))).toEqual([2, 2, 3, 3, 4, 4, 6, 6, undefined])
    expect(r.disarida.map(o => o.id)).toEqual([os[8].id])
  })
  it('teslimi gelecek olanlar gecikmişlerden önce yer alır', () => {
    const gec = [odev('2026-10-15'), odev('2026-10-16')], yarin = odev('2026-10-22')
    const r = birlestir([...gec, yarin])
    expect(gunu(r, yarin)).toBe(2); expect(gec.map(o => gunu(r, o))).toEqual([2, 3])
  })
  it('3 haftadan eski yapılmamış ödev plana girmez, dışarıda', () => {
    const eski = odev('2026-09-29'), sinir = odev('2026-09-30')
    const r = birlestir([eski, sinir])
    expect(gunu(r, eski)).toBeUndefined(); expect(gunu(r, sinir)).toBe(2)
    expect(r.disarida.map(o => o.id)).toEqual([eski.id])
  })
  it('yapıldı / geç / mazeretli aday değil, listede de yok', () => {
    const r = birlestir([odev('2026-10-22', { status: 'yapildi' }), odev('2026-10-15', { status: 'gec' }), odev('2026-10-15', { status: 'mazeretli' })])
    expect(r.gorevler).toEqual([]); expect(r.disarida).toEqual([])
  })
  it('yapılmadı / eksik işaretli gecikmiş gelir', () => {
    const r = birlestir([odev('2026-10-15', { status: 'yapilmadi' }), odev('2026-10-16', { status: 'eksik' })])
    expect(r.gorevler).toHaveLength(2)
  })
  it('teslimi gelecek Pazartesiden sonra → dışarıda (gelecek hafta)', () => {
    const o = odev('2026-10-27'); const r = birlestir([o])
    expect(gunu(r, o)).toBeUndefined(); expect(r.disarida.map(x => x.id)).toEqual([o.id])
  })
  it('gizlenen ödev eklenmez, dışarıda listelenir', () => {
    const o = odev('2026-10-22'); const r = birlestir([o], { gizli: [o.id] })
    expect(r.gorevler).toEqual([]); expect(r.disarida.map(x => x.id)).toEqual([o.id])
  })
  it('saat girilmemiş → her gün 150 dk varsayılan (Cumartesi de açık)', () => {
    const o = odev('2026-10-25'); expect(gunu(birlestir([o], { saatler: null }), o)).toBe(5)
  })
  it('ileri hafta: yalnız o haftanın Pazartesisinden itibaren teslimliler; gecikmiş girmez', () => {
    const gec = odev('2026-10-15'), sali = odev('2026-10-27') // hedef Pzt 26
    const r = birlestir([gec, sali], { hafta: '2026-10-26' })
    expect(gunu(r, sali)).toBe(0); expect(gunu(r, gec)).toBeUndefined(); expect(r.disarida).toEqual([])
  })
})

describe('odevleriBirlestir — plandaki ödev görevleri', () => {
  it('görev biçimi', () => {
    const o = odev('2026-10-22', { subject: 'Matematik', title: 'MEB s.35-36' })
    expect(birlestir([o]).gorevler[0]).toEqual({
      id: `o-${o.id}`, gun: 2, ad: odevGorevAdi('Matematik', 'MEB s.35-36'), ders: 'Matematik', miktar: 30, birim: 'dk', soruSatiri: false,
      konu: '', sayfa: '', yapti: false, soru: null, dogru: null, odevId: o.id, teslim: '2026-10-22',
    })
  })
  it('planda olan tekrar eklenmez; günü sabit; yapti öğretmen işaretinden; teslim tazelenir', () => {
    const o = odev('2026-10-23', { status: 'gec' })
    const mevcut = { ...birlestir([odev('2026-10-22')]).gorevler[0], id: `o-${o.id}`, odevId: o.id, gun: 0, miktar: 45, teslim: '2026-10-22' }
    const r = birlestir([o], { gorevler: [mevcut] })
    expect(r.gorevler).toEqual([{ ...mevcut, yapti: true, teslim: '2026-10-23' }])
  })
  it('mazeretli olan planda kalır, yapti false', () => {
    const o = odev('2026-10-23', { status: 'mazeretli' })
    const mevcut = { ...birlestir([odev('2026-10-22')]).gorevler[0], id: `o-${o.id}`, odevId: o.id, yapti: true }
    expect(birlestir([o], { gorevler: [mevcut] }).gorevler[0].yapti).toBe(false)
  })
  it('ödev kaydı yoksa (silinmiş) görev düşer; elle görevlere dokunulmaz', () => {
    const e = elle(); const r = birlestir([], { gorevler: [e, { ...e, id: 'o-x', odevId: 'yok' }] })
    expect(r.gorevler).toEqual([e])
  })
  it('deterministik', () => {
    const os = [odev('2026-10-24'), odev('2026-10-15'), odev('2026-10-22')]
    expect(birlestir(os)).toEqual(birlestir([...os].reverse()))
  })
})

describe('odevGorevAdi / odevEtiketi', () => {
  it('kısa ders adı + başlık, en çok 120 karakter', () => {
    expect(odevGorevAdi('Kimya', 'Orbital ödevi')).toBe('Kimya — Orbital ödevi')
    expect(odevGorevAdi('Fizik', 'x'.repeat(200)).length).toBe(120)
  })
  it('etiketler', () => {
    expect(odevEtiketi('2026-10-20', BUGUN)).toEqual({ tur: 'gecikmis', metin: 'gecikmiş' })
    expect(odevEtiketi('2026-10-22', BUGUN)).toEqual({ tur: 'yarin', metin: 'yarın teslim' })
    expect(odevEtiketi('2026-10-30', BUGUN)).toEqual({ tur: 'tarih', metin: 'teslim 30.10' })
    expect(odevEtiketi('2026-10-21', BUGUN)).toEqual({ tur: 'tarih', metin: 'teslim 21.10' })
  })
})

describe('planDisi', () => {
  it('dışarıdakiler + gizlenenler, plandakiler hariç, teslime göre, tekrar yok', () => {
    const a = odev('2026-10-27'), b = odev('2026-10-22'), c = odev('2026-10-23')
    const plan = birlestir([c]).gorevler
    expect(planDisi([a, c], [b.id, a.id, 'yok'], [a, b, c], plan).map(o => o.id)).toEqual([b.id, a.id])
  })
})
