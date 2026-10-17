// src/domains/mentor/takip/takipMath.ts
// Mentör haftalık takip: saf hesaplar. Spec: docs/superpowers/specs/2026-10-16-mentor-haftalik-takip-design.md
import { addDaysISO } from '@/src/shared/date'
import type { HomeworkRecord } from '@/src/domains/homework/lib/stats'
import { sinifSablonu, VARSAYILAN_DUZEN } from './sablonlar'
import { gunAy } from '../lib/bultenMath'

export type Seviye = 0 | 1 | 2
export type Birim = 'dk' | 'soru' | 'serbest'
export type Gorev = {
  id: string; gun: number; ad: string; ders: string | null; miktar: number | null; birim: Birim; soruSatiri: boolean
  konu: string; sayfa: string; yapti: boolean; soru: number | null; dogru: number | null
  /** Bağlı kitap (2026-10-17). Ad saklanır: kitap silinse de eski haftada görünür. Eski kayıtlarda alan yok. */
  kitapId?: string | null; kitapAdi?: string; sayfaBas?: number | null; sayfaSon?: number | null
  /** "Hafta içi her gün" görevi: Pzt–Cum beş kopya aynı grup kimliğini taşır; giriş ekranı tek satır gösterir. */
  grup?: string
}
/** kitapAdi saklanır: kitap silinse de eski haftada adı görünür. */
export type MentorOdevi = { id: string; kitapId: string | null; kitapAdi: string; konu: string; sayfalar: string; yapti: boolean }
export type Okuma = { kitap: string; sayfa: number | null; bitti: boolean }
/** Soru sonucu: haftanın planındaki kitap (k:<id>) ya da kitapsız soru görevinin dersi (d:<ders>) başına tek satır.
 *  Ad/ders/sayfa girildiği an saklanır: plan ya da kitap sonradan değişse de sonuç anlamını korur. */
export type Sonuc = {
  anahtar: string; ad: string; ders: string; sayfa: string
  cozulen: number | null; dogru: number | null; yanlis: number | null; bos: number | null
  /** Kitaplı satır: planın son sayfası (plandan türer) ve öğrencinin kaldığı sayfa (null = plan sonu). */
  planSon?: number | null; kaldigi?: number | null
}
/** sonuclar 2026-10-17'de geldi; eski kayıtlarda yok. */
/** surum 2 (2026-10-17): miktar GERÇEK süre/miktar (seviye uygulanmış) + her gün grupları. Yoksa eski biçim → normalizeIcerik. */
export type Icerik = { duzen: string; gorevler: Gorev[]; mentorOdevleri: MentorOdevi[]; okuma: Okuma | null; sonuclar?: Sonuc[]; surum?: 2 }
/** veliMesaji: mentörün düzenlediği veli mesajı; null = haftanın verisinden otomatik. */
export type Gorusme = { not: string; rica: string; veliMesaji: string | null }
export type Ozet = { gorev_toplam: number; gorev_yapilan: number; soru: number; dogru: number; okuma_sayfa: number; islendi: boolean }
export type HaftaVerisi = { seviye: Seviye; soruHedefi: number; icerik: Icerik; gorusme: Gorusme }

/** Haftanın pazartesisi ('YYYY-MM-DD', UTC takvim aritmetiği — saat dilimi kaydırmaz). */
export function haftaBasi(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return addDaysISO(iso, -((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7))
}
export const haftaKaydir = (pazartesi: string, delta: number) => addDaysISO(pazartesi, delta * 7)

/** Takip haftası Pzt–Paz (plan hafta sonunu da kapsar). Veli bülteni/mesajı okul haftasını (Pzt–Cum, haftaEtiketi) kullanır. */
export function takipHaftaEtiketi(pazartesi: string): string {
  const pazar = addDaysISO(pazartesi, 6)
  return pazartesi.slice(5, 7) === pazar.slice(5, 7) ? `${Number(pazartesi.slice(8))}–${gunAy(pazar)}` : `${gunAy(pazartesi)} – ${gunAy(pazar)}`
}

export const BOS_GORUSME: Gorusme = { not: '', rica: '', veliMesaji: null }

/** 2026-10-17'ye kadar 5 alan vardı (iyi/zor/hedef/odak/evde): ilk dördü başlıklı olarak Öğretmen notuna,
 *  "Evde veliden ricam" Veliden ricam'a birleşir. Yeni biçim aynen döner. */
export function gorusmeNormalize(ham: unknown): Gorusme {
  const g = (ham ?? {}) as Record<string, unknown>
  const m = (k: string) => (typeof g[k] === 'string' ? (g[k] as string) : '')
  if ('not' in g || 'rica' in g || 'veliMesaji' in g) return { not: m('not'), rica: m('rica'), veliMesaji: typeof g.veliMesaji === 'string' ? g.veliMesaji : null }
  const not = ([['iyi', 'İyi giden'], ['zor', 'Zorlandığı'], ['hedef', 'Kendi hedefi'], ['odak', 'Odak']] as const)
    .filter(([k]) => m(k).trim()).map(([k, ad]) => `${ad}: ${m(k).trim()}`).join('\n')
  return { not, rica: m('evde').trim(), veliMesaji: null }
}
export const GUNLER = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const
export const SEVIYE_ADI = ['Hafif', 'Normal', 'Yoğun'] as const

/** Miktarlar Normal içindir; Hafif ×0,7, Yoğun ×1,25, 5'e yuvarlanır (en az 5). */
export function seviyeMiktar(miktar: number, seviye: Seviye): number {
  if (seviye === 1) return miktar
  return Math.max(5, Math.round((miktar * (seviye === 0 ? 0.7 : 1.25)) / 5) * 5)
}

export function sureYaz(dk: number): string {
  if (dk < 60) return `${dk} dk`
  const s = Math.floor(dk / 60), d = dk % 60
  if (d === 0) return `${s} saat`
  if (d === 30) return `${s},5 saat`
  return `${s} saat ${d} dk`
}

export function miktarYaz(g: Pick<Gorev, 'miktar' | 'birim'>): string {
  if (g.miktar === null || g.birim === 'serbest') return ''
  return g.birim === 'dk' ? sureYaz(g.miktar) : `${g.miktar} soru`
}

const CARPAN = [0.7, 1, 1.25] as const
const besle = (n: number) => Math.max(5, Math.round(n / 5) * 5)

/** Pzt–Cum beşinde de birebir aynı (ad, ders, miktar, birim, soru, kitap) görev → ortak grup. Grupsuzlar güne özel kalır. */
function gruplandir(gorevler: Gorev[]): Gorev[] {
  const anahtar = (g: Gorev) => JSON.stringify([g.ad, g.ders, g.miktar, g.birim, g.soruSatiri, g.kitapId ?? null])
  const gunleri = new Map<string, Gorev[]>()
  for (const g of gorevler) {
    if (g.grup || g.gun > 4) continue
    gunleri.set(anahtar(g), [...(gunleri.get(anahtar(g)) ?? []), g])
  }
  const grupOf = new Map<string, string>()
  for (const [k, liste] of gunleri) {
    const gunler = liste.map(g => g.gun).sort()
    if (liste.length === 5 && gunler.join() === '0,1,2,3,4') grupOf.set(k, `h-${liste[0].id}`)
  }
  return gorevler.map(g => (!g.grup && g.gun <= 4 && grupOf.has(anahtar(g)) ? { ...g, grup: grupOf.get(anahtar(g)) } : g))
}

/** Eski kaydı yeni biçime çevirir (okunurken; ilk düzenlemede kalıcılaşır): miktar seçili seviyeyle gerçek değere,
 *  her gün görevleri gruplanır. surum 2 ise aynen döner. */
export function normalizeIcerik(icerik: Icerik, seviye: Seviye): Icerik {
  if (icerik.surum === 2) return icerik
  const gercek = icerik.gorevler.map(g => (g.miktar === null || g.birim === 'serbest' ? g : { ...g, miktar: seviyeMiktar(g.miktar, seviye) }))
  return { ...icerik, gorevler: gruplandir(gercek), surum: 2 }
}

/** Seviye düğmesi: tüm süreler/miktarlar bir kez ölçeklenir (Normal 60 → Yoğun 75), soru hedefi sınıf varsayılanına. */
export function seviyeDegistir(h: HaftaVerisi, yeni: Seviye, sinif: number): HaftaVerisi {
  if (yeni === h.seviye) return h
  const oran = CARPAN[yeni] / CARPAN[h.seviye]
  return {
    ...h, seviye: yeni, soruHedefi: varsayilanHedef(sinif, yeni),
    icerik: { ...h.icerik, gorevler: h.icerik.gorevler.map(g => (g.miktar === null || g.birim === 'serbest' ? g : { ...g, miktar: Math.min(600, besle(g.miktar * oran)) })) },
  }
}

/** Haftalık aralığın i. hafta içi günü (0=Pzt…4=Cum) payı: olabildiğince eşit, fazlası ilk günlere.
 *  45–60 (16 sf) → 45–48, 49–51, 52–54, 55–57, 58–60. Payı olmayan gün null. */
export function gunlukAralik(bas: number, son: number, i: number): [number, number] | null {
  const n = son - bas + 1, taban = Math.floor(n / 5), artik = n % 5
  const pay = (j: number) => taban + (j < artik ? 1 : 0)
  if (pay(i) <= 0) return null
  let b = bas
  for (let j = 0; j < i; j++) b += pay(j)
  return [b, b + pay(i) - 1]
}

const aralikYaz = (bas: number | null, son: number | null) =>
  bas === null ? '' : son === null || son === bas ? `s. ${bas}` : `s. ${bas}–${son}`

/** Görev satırının kitap/sayfa metni (kâğıt + Sonuç). Her gün görevi kendi gününün payını gösterir;
 *  güne özel görev aralığı olduğu gibi. Kitapsız görevde eski serbest `sayfa` metni. */
export function kitapSayfaYaz(g: Gorev): string {
  if (!g.kitapId) return g.sayfa
  let bas = g.sayfaBas ?? null, son = g.sayfaSon ?? null
  if (g.grup && g.gun <= 4 && bas !== null) {
    const pay = gunlukAralik(bas, son ?? bas, g.gun)
    if (!pay) return g.kitapAdi ?? ''
    ;[bas, son] = pay
  }
  const s = aralikYaz(bas, son)
  return `${g.kitapAdi ?? ''}${s && ` ${s}`}`
}

/** "planlanan s. 60, kaldığı s. 55" — yalnız öğrenci planın gerisinde kaldıysa. */
export const kaldigiMetni = (s: Pick<Sonuc, 'planSon' | 'kaldigi'>) =>
  s.planSon != null && s.kaldigi != null && s.kaldigi < s.planSon ? `planlanan s. ${s.planSon}, kaldığı s. ${s.kaldigi}` : null

export function varsayilanHedef(sinif: number, seviye: Seviye): number {
  return (sinif >= 11 ? [200, 300, 400] : [120, 200, 300])[seviye]
}

export function ozetHesapla(icerik: Icerik): Ozet {
  // Görev bazlı soru/doğru eski giriş biçimi (2026-10-17 öncesi); yeni giriş sonuclar'da. İkisi toplanır.
  const soruSat = icerik.gorevler.filter(g => g.soruSatiri)
  const sonuclar = icerik.sonuclar ?? []
  const soru = soruSat.reduce((t, g) => t + (g.soru ?? 0), 0) + sonuclar.reduce((t, s) => t + (s.cozulen ?? 0), 0)
  const dogru = soruSat.reduce((t, g) => t + (g.dogru ?? 0), 0) + sonuclar.reduce((t, s) => t + (s.dogru ?? 0), 0)
  const okuma_sayfa = icerik.okuma?.sayfa ?? 0
  const yapilan = icerik.gorevler.filter(g => g.yapti).length + icerik.mentorOdevleri.filter(m => m.yapti).length
  const islendi = yapilan > 0 || soruSat.some(g => g.soru !== null) || sonuclar.some(s => s.cozulen !== null)
    || okuma_sayfa > 0 || !!icerik.okuma?.bitti
  return {
    gorev_toplam: icerik.gorevler.length + icerik.mentorOdevleri.length, gorev_yapilan: yapilan,
    soru, dogru, okuma_sayfa, islendi,
  }
}

/** Haftanın sonuç satırları: plandaki soru görevlerinden (ilk görünüş sırası), girilmiş sayılar anahtarla eşleşir.
 *  Planda artık olmayan ama sonucu girilmiş satır sonda kalır (veri kaybolmasın). */
export function sonucSatirlari(icerik: Icerik, kitaplar: { id: string; ders: string }[]): Sonuc[] {
  const kitapDersi = new Map(kitaplar.map(k => [k.id, k.ders]))
  const satirlar = new Map<string, Sonuc & { bas: number | null; son: number | null }>()
  for (const g of icerik.gorevler.filter(x => x.soruSatiri).sort((a, b) => a.gun - b.gun)) {
    const anahtar = g.kitapId ? `k:${g.kitapId}` : `d:${g.ders ?? g.ad}`
    const s = satirlar.get(anahtar) ?? {
      anahtar, ad: g.kitapId ? g.kitapAdi ?? '' : g.ders ?? g.ad,
      ders: (g.kitapId && kitapDersi.get(g.kitapId)) || g.ders || 'Diğer',
      sayfa: '', cozulen: null, dogru: null, yanlis: null, bos: null, bas: null, son: null,
    }
    if (g.kitapId && g.sayfaBas != null) s.bas = s.bas === null ? g.sayfaBas : Math.min(s.bas, g.sayfaBas)
    const son = g.sayfaSon ?? g.sayfaBas
    if (g.kitapId && son != null) s.son = s.son === null ? son : Math.max(s.son, son)
    satirlar.set(anahtar, s)
  }
  const kayitli = new Map((icerik.sonuclar ?? []).map(s => [s.anahtar, s]))
  const planli = [...satirlar.values()].map(({ bas, son, ...s }) => {
    const k = kayitli.get(s.anahtar)
    return {
      ...s, sayfa: aralikYaz(bas, son), ...(k && { cozulen: k.cozulen, dogru: k.dogru, yanlis: k.yanlis, bos: k.bos }),
      ...(s.anahtar.startsWith('k:') && { planSon: son, kaldigi: k?.kaldigi ?? null }),
    }
  })
  const yetim = (icerik.sonuclar ?? []).filter(s => !satirlar.has(s.anahtar) && [s.cozulen, s.dogru, s.yanlis, s.bos].some(x => x !== null))
  return [...planli, ...yetim]
}

export const sonucNet = (s: Pick<Sonuc, 'dogru' | 'yanlis'>) =>
  s.dogru === null && s.yanlis === null ? null : (s.dogru ?? 0) - (s.yanlis ?? 0) / 4
export const sonucDogruluk = (s: Pick<Sonuc, 'cozulen' | 'dogru'>) =>
  s.cozulen ? Math.round(((s.dogru ?? 0) / s.cozulen) * 100) : null
export function sonucUyarisi(s: Pick<Sonuc, 'cozulen' | 'dogru' | 'yanlis' | 'bos'>): string | null {
  const t = (s.dogru ?? 0) + (s.yanlis ?? 0) + (s.bos ?? 0)
  return s.cozulen !== null && t > s.cozulen ? `Doğru+Yanlış+Boş = ${t}, çözülen ${s.cozulen}` : null
}

/** Ders bazında doğruluk (çözülen girilmiş satırlar; ilk görünüş sırası). */
export function dersDogruluk(sonuclar: Sonuc[]) {
  const m = new Map<string, { ders: string; cozulen: number; dogru: number }>()
  for (const s of sonuclar) {
    if (!s.cozulen) continue
    const x = m.get(s.ders) ?? { ders: s.ders, cozulen: 0, dogru: 0 }
    x.cozulen += s.cozulen; x.dogru += s.dogru ?? 0
    m.set(s.ders, x)
  }
  return [...m.values()].map(x => ({ ...x, yuzde: Math.round((x.dogru / x.cozulen) * 100) }))
}

export const programYuzde = (o: Pick<Ozet, 'gorev_toplam' | 'gorev_yapilan'>) =>
  o.gorev_toplam ? Math.round((o.gorev_yapilan / o.gorev_toplam) * 100) : null
export const dogrulukYuzde = (o: Pick<Ozet, 'soru' | 'dogru'>) =>
  o.soru ? Math.round((o.dogru / o.soru) * 100) : null

/** Doğruluk puan farkı; iki hafta da işlenmiş ve ikisinde de soru varsa. */
export function fark(bu: Ozet, onceki: Ozet | null): number | null {
  if (!onceki || !bu.islendi || !onceki.islendi) return null
  const a = dogrulukYuzde(bu), b = dogrulukYuzde(onceki)
  return a === null || b === null ? null : a - b
}

const sonucsuz = (g: Gorev): Gorev => ({ ...g, konu: '', sayfa: '', yapti: false, soru: null, dogru: null })

/** Kitap başına sayfa kaydırma: haftadaki aralığın tamamı (min başlangıç–max bitiş) kadar ileri.
 *  45–60 → 61–76; aynı kitap iki görevde 45–50 + 51–56 → 57–62 + 63–68. */
function sayfaKaydir(gorevler: Gorev[], kaldigi: Map<string, number> = new Map()): Gorev[] {
  const aralik = new Map<string, { bas: number; son: number }>()
  for (const g of gorevler) {
    if (!g.kitapId || g.sayfaBas == null) continue
    const son = g.sayfaSon ?? g.sayfaBas
    const a = aralik.get(g.kitapId)
    aralik.set(g.kitapId, a ? { bas: Math.min(a.bas, g.sayfaBas), son: Math.max(a.son, son) } : { bas: g.sayfaBas, son })
  }
  return gorevler.map(g => {
    const a = g.kitapId ? aralik.get(g.kitapId) : undefined
    if (!a || g.sayfaBas == null) return g
    // Öğrencinin kaldığı sayfa girildiyse oradan (+1), yoksa planın sonundan devam; uzunluk aynı
    const ofset = (kaldigi.get(g.kitapId!) ?? a.son) + 1 - a.bas
    return { ...g, sayfaBas: g.sayfaBas + ofset, sayfaSon: g.sayfaSon == null ? g.sayfaSon : g.sayfaSon + ofset }
  })
}

/** Önceki haftanın planı bu haftaya: görevler (bağlı kitap, sayfa kaldığı yerden), seviye, hedef, düzen, bitmemiş okuma.
 *  Sonuç, görüşme ve mentör ödevi taşınmaz. "Geçen haftayı kopyala" ve yeni haftanın taslağı bunu kullanır. */
export function planKopyala(onceki: HaftaVerisi): HaftaVerisi {
  const ok = onceki.icerik.okuma
  const ic = normalizeIcerik(onceki.icerik, onceki.seviye)
  return {
    seviye: onceki.seviye, soruHedefi: onceki.soruHedefi, gorusme: BOS_GORUSME,
    icerik: {
      surum: 2, duzen: ic.duzen, mentorOdevleri: [],
      gorevler: sayfaKaydir(ic.gorevler, new Map((ic.sonuclar ?? []).flatMap(s => (s.anahtar.startsWith('k:') && s.kaldigi != null ? [[s.anahtar.slice(2), s.kaldigi] as const] : [])))).map(sonucsuz),
      okuma: ok && !ok.bitti ? { kitap: ok.kitap, sayfa: null, bitti: false } : null,
    },
  }
}

/** Yeni hafta: önceki haftanın planı (sonuçsuz), seviye, hedef, düzen; bitmemiş kitap. Yoksa sınıf şablonu + Hafif. */
export function yeniHafta(onceki: HaftaVerisi | null, sinif: number): HaftaVerisi {
  if (!onceki) return {
    seviye: 0, soruHedefi: varsayilanHedef(sinif, 0), gorusme: BOS_GORUSME,
    icerik: normalizeIcerik({ duzen: VARSAYILAN_DUZEN, gorevler: sinifSablonu(sinif), mentorOdevleri: [], okuma: null }, 0),
  }
  return planKopyala(onceki)
}

export type OkulOdevi = { id: string; subject: string; title: string; due_date: string; status: string | null; bekliyor: boolean }

/** Haftanın (Pzt–Paz) son teslimli okul ödevleri; durum dersin öğretmeninin işareti. */
export function okulOdevleri(kayitlar: HomeworkRecord[], pazartesi: string, sonGun = addDaysISO(pazartesi, 6)): OkulOdevi[] {
  const son = sonGun
  return kayitlar
    .filter((k): k is HomeworkRecord & { due_date: string } => k.due_date !== null && k.due_date >= pazartesi && k.due_date <= son)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.subject.localeCompare(b.subject, 'tr'))
    .map(k => ({ id: k.id, subject: k.subject, title: k.title, due_date: k.due_date, status: k.status, bekliyor: k.bekliyor }))
}

export type OkulOdevBolumleri = { tamamlanmamis: OkulOdevi[]; buHafta: OkulOdevi[]; gelecek: OkulOdevi[] }

/** Plan/kâğıt üç bölümü (2026-10-17). Tamamlanmamış: öğretmen "yapılmadı" işaretlemiş ve teslimi bu haftadan önce —
 *  öğretmen işareti değiştirene kadar her hafta görünür. Gelecek hafta: teslimi P+7…P+13 (DB'de olan = verilmiş). */
export function okulOdevBolumleri(kayitlar: HomeworkRecord[], pazartesi: string): OkulOdevBolumleri {
  return {
    tamamlanmamis: okulOdevleri(kayitlar.filter(k => k.status === 'yapilmadi'), '0000-01-01', addDaysISO(pazartesi, -1)),
    buHafta: okulOdevleri(kayitlar, pazartesi),
    gelecek: okulOdevleri(kayitlar, addDaysISO(pazartesi, 7)),
  }
}

const OKUL_DURUM: Record<string, string> = { yapildi: 'Yapıldı', gec: 'Yapıldı (geç)', yapilmadi: 'Yapılmadı', eksik: 'Eksik', mazeretli: 'Mazeretli' }
/** Teslim durumu yalnız dersin öğretmeninin işaretinden (elle giriş yok). */
export const okulDurumYaz = (o: Pick<OkulOdevi, 'status'>) => (o.status ? OKUL_DURUM[o.status] ?? o.status : 'Henüz işaretlenmedi')

/** Mentörlük tablosu "Geçen hafta": yalnız işlenmiş haftada program % ve doğruluk %. */
export function gecenHaftaOzeti(s: (Pick<Ozet, 'islendi' | 'gorev_toplam' | 'gorev_yapilan' | 'soru' | 'dogru'>) | null) {
  return s?.islendi ? { program: programYuzde(s), dogruluk: dogrulukYuzde(s) } : null
}

export type HaftaDurumu = 'yok' | 'kagitta' | 'islendi'
export const haftaDurumu = (s: { islendi: boolean } | null): HaftaDurumu => (!s ? 'yok' : s.islendi ? 'islendi' : 'kagitta')

export function okumaGecmisi(haftalar: { hafta: string; okuma: Okuma | null }[]) {
  const out: { kitap: string; bas: string; son: string; sayfa: number; bitti: boolean }[] = []
  for (const { hafta, okuma } of haftalar) {
    if (!okuma) continue
    const son = out.at(-1)
    if (son && son.kitap === okuma.kitap && !son.bitti) { son.son = hafta; son.sayfa += okuma.sayfa ?? 0; son.bitti = okuma.bitti }
    else out.push({ kitap: okuma.kitap, bas: hafta, son: hafta, sayfa: okuma.sayfa ?? 0, bitti: okuma.bitti })
  }
  return out
}

/** Kaynak (kitap) dersi seçenekleri: okulun ödevlerinde kullanılan ders adları. Büyük/küçük harf farkı birleşir
 *  (en sık yazım kalır); yalnız bir kez geçen yazım ("Matematik 1.Aşama") listeye girmez. */
export function dersListesi(odevDersleri: string[]): string[] {
  const gruplar = new Map<string, Map<string, number>>()
  for (const ham of odevDersleri) {
    const d = ham.trim()
    if (!d) continue
    const k = d.toLocaleLowerCase('tr')
    const g = gruplar.get(k) ?? new Map<string, number>()
    g.set(d, (g.get(d) ?? 0) + 1)
    gruplar.set(k, g)
  }
  const liste = [...gruplar.values()]
    .filter(g => [...g.values()].reduce((a, b) => a + b, 0) >= 2)
    .map(g => [...g].sort((a, b) => b[1] - a[1])[0][0])
    .sort((a, b) => a.localeCompare(b, 'tr'))
  return liste.length ? liste : STANDART_DERSLER // henüz ödev girilmemiş okulda da kaynak eklenebilsin
}

const STANDART_DERSLER = ['Biyoloji', 'Coğrafya', 'Felsefe', 'Fizik', 'Geometri', 'İngilizce', 'Kimya', 'Matematik', 'Tarih', 'Türk Dili ve Edebiyatı']
