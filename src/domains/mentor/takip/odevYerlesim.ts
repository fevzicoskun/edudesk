// src/domains/mentor/takip/odevYerlesim.ts
// Okul ödevleri haftalık plana otomatik girer. Spec: docs/superpowers/specs/2026-10-21-mentor-takip-saatler-odevler-kagit-design.md
import { addDaysISO } from '@/src/shared/date'
import type { HomeworkRecord } from '@/src/domains/homework/lib/stats'
import { dersKisa } from '../lib/bultenMath'
import { netSure, saatlerVarMi, type CalismaSaatleri } from './calismaSaatleri'
import { gunSirasi, type Gorev } from './takipMath'

/** Teslimi bundan eski yapılmamış ödev plana girmez, yalnız listede (2026-10-21 kullanıcı). */
export const ESKI_SINIR_GUN = 21
/** Saat girilmemiş öğrencide yerleşim için günlük müsait süre (dk); ekranda gösterilmez. */
export const VARSAYILAN_MUSAIT = 150
const ODEV_DK = 30
const YAPILMIS = new Set(['yapildi', 'gec'])

export function odevGorevAdi(subject: string, title: string): string {
  const ad = `${dersKisa(subject)} — ${title}`
  return ad.length > 120 ? `${ad.slice(0, 119)}…` : ad
}

export function odevEtiketi(teslim: string, bugun: string): { tur: 'gecikmis' | 'yarin' | 'tarih'; metin: string } {
  if (teslim < bugun) return { tur: 'gecikmis', metin: 'gecikmiş' }
  if (teslim === addDaysISO(bugun, 1)) return { tur: 'yarin', metin: 'yarın teslim' }
  return { tur: 'tarih', metin: `teslim ${teslim.slice(8, 10)}.${teslim.slice(5, 7)}` }
}

/** Ödevden görev: 30 dk, soru satırı yok; kimlik ödevden türer (aynı ödev iki kez eklenmez). */
export const odevGorevi = (o: HomeworkRecord, gun: number): Gorev => ({
  // ders görev şemasında ≤ 60 (ödev formunda 100): aşarsa otomatik kayıt kalıcı reddedilirdi
  id: `o-${o.id}`, gun, ad: odevGorevAdi(o.subject, o.title), ders: o.subject.slice(0, 60), miktar: ODEV_DK, birim: 'dk', soruSatiri: false,
  konu: '', sayfa: '', yapti: false, soru: null, dogru: null, odevId: o.id, teslim: o.due_date ?? undefined,
})

/** Hafta başından gün farkı: bugünden önceki günler geçmiş sayılır (ileri hafta 0, en çok 7 = hafta geçti). */
const ilkOfset = (hafta: string, bugun: string) => Math.min(7, Math.max(0, gunFarki(hafta, bugun)))
/** Planın bugünkü (ileri haftada ilk) günü — `gun` değeri (Pzt=0); hafta geçtiyse son gün. */
export const ilkAcikGun = (hafta: string, bugun: string) => gunSirasi(hafta)[Math.min(6, ilkOfset(hafta, bugun))]

const gunFarki = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
const sira = (a: HomeworkRecord, b: HomeworkRecord) =>
  a.due_date!.localeCompare(b.due_date!) || a.subject.localeCompare(b.subject, 'tr') || a.id.localeCompare(b.id)

/**
 * Plandaki ödev görevlerini öğretmen işaretiyle eşitler (silinen ödevin görevi düşer) ve yeni adayları yerleştirir.
 * Yerleşim yalnız ödev görevlerine bakar: günün ödev payı = müsait sürenin yarısı (mentör görevleri sayılmaz).
 * Teslimi gelecek: teslimden 1 gün önce → doluysa geriye doğru → hiç yoksa hedefe (aşım). Gecikmiş: en eski önce,
 * ilk açık günden ileri; sığmazsa `disarida`. İleri haftada yalnız o haftanın Pazartesisinden sonra teslimliler.
 */
export function odevleriBirlestir(a: {
  gorevler: Gorev[]; gizli: string[]; odevler: HomeworkRecord[]; saatler: CalismaSaatleri | null; hafta: string; bugun: string
}): { gorevler: Gorev[]; disarida: HomeworkRecord[] } {
  const kayit = new Map(a.odevler.map(o => [o.id, o]))
  const gorevler = a.gorevler.flatMap(g => {
    if (!g.odevId) return [g]
    const o = kayit.get(g.odevId)
    return o ? [{ ...g, yapti: YAPILMIS.has(o.status ?? ''), teslim: o.due_date ?? g.teslim }] : []
  })
  const planda = new Set(gorevler.flatMap(g => (g.odevId ? [g.odevId] : [])))
  const gizli = new Set(a.gizli)
  // Hesap hafta başından gün farkıyla (ofset); görev günü = planGun[ofset] (Cuma haftasında ofset 0 = Cuma)
  const planGun = gunSirasi(a.hafta)
  const ilk = ilkOfset(a.hafta, a.bugun)
  const ileriHafta = a.hafta > a.bugun
  const alt = ileriHafta ? a.hafta : addDaysISO(a.bugun, -ESKI_SINIR_GUN)
  const ust = addDaysISO(a.hafta, 7)

  const adaylar = a.odevler
    .filter(o => o.due_date && !planda.has(o.id) && !YAPILMIS.has(o.status ?? '') && o.status !== 'mazeretli')
    // Pazartesi teslimli önceki haftanın Pazarına yerleşir; ileri haftada tekrar görünmesin
    .filter(o => !ileriHafta || o.due_date! > a.hafta)
    .sort(sira)
  const disarida = adaylar.filter(o => gizli.has(o.id) || o.due_date! < alt || o.due_date! > ust || ilk > 6)
  const yerlesecek = adaylar.filter(o => !disarida.includes(o))

  const varsayilan = !saatlerVarMi(a.saatler)
  const pay = Array.from({ length: 7 }, (_, i) => {
    const g = a.saatler?.gunler[i] ?? null
    return varsayilan ? Math.floor(VARSAYILAN_MUSAIT / 2) : g ? Math.floor(netSure(g) / 2) : null // null = o gün çalışma yok
  })
  const dolu = Array.from({ length: 7 }, (_, i) =>
    gorevler.filter(g => g.odevId && g.gun === i).reduce((t, g) => t + (g.miktar ?? 0), 0))
  const sigar = (i: number) => pay[i] !== null && dolu[i] + ODEV_DK <= pay[i]!
  const koy = (o: HomeworkRecord, gun: number) => {
    dolu[gun] += ODEV_DK
    gorevler.push(odevGorevi(o, gun))
  }

  for (const o of yerlesecek.filter(x => x.due_date! >= a.bugun)) {
    const hedef = Math.min(6, Math.max(ilk, gunFarki(a.hafta, o.due_date!) - 1))
    const geri = Array.from({ length: hedef - ilk + 1 }, (_, k) => planGun[hedef - k])
    koy(o, geri.find(sigar) ?? geri.find(i => pay[i] !== null) ?? planGun[hedef])
  }
  for (const o of yerlesecek.filter(x => x.due_date! < a.bugun)) {
    const gun = Array.from({ length: 7 - ilk }, (_, k) => planGun[ilk + k]).find(sigar)
    if (gun === undefined) disarida.push(o)
    else koy(o, gun)
  }
  return { gorevler, disarida: disarida.sort(sira) }
}

/** Plan sekmesi ve kâğıdın "Plana girmeyen ödevler" listesi: sunucunun dışarıda bıraktıkları + bu hafta gizlenenler,
 *  plana (sonradan) girenler hariç, teslime göre. */
export function planDisi(disarida: HomeworkRecord[], gizli: string[], kayitlar: HomeworkRecord[], gorevler: Gorev[]): HomeworkRecord[] {
  const kayit = new Map(kayitlar.map(o => [o.id, o]))
  const plandaki = new Set(gorevler.flatMap(g => (g.odevId ? [g.odevId] : [])))
  const tum = new Map([...disarida, ...gizli.flatMap(id => kayit.get(id) ?? [])].map(o => [o.id, o]))
  return [...tum.values()].filter(o => !plandaki.has(o.id)).sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
}
