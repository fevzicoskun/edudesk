// src/domains/mentor/takip/takipMath.ts
// Mentör haftalık takip: saf hesaplar. Spec: docs/superpowers/specs/2026-10-16-mentor-haftalik-takip-design.md
import { addDaysISO } from '@/src/shared/date'
import type { HomeworkRecord } from '@/src/domains/homework/lib/stats'
import { sinifSablonu, VARSAYILAN_DUZEN } from './sablonlar'

export type Seviye = 0 | 1 | 2
export type Birim = 'dk' | 'soru' | 'serbest'
export type Gorev = {
  id: string; gun: number; ad: string; ders: string | null; miktar: number | null; birim: Birim; soruSatiri: boolean
  konu: string; sayfa: string; yapti: boolean; soru: number | null; dogru: number | null
  /** Bağlı kitap (2026-10-17). Ad saklanır: kitap silinse de eski haftada görünür. Eski kayıtlarda alan yok. */
  kitapId?: string | null; kitapAdi?: string; sayfaBas?: number | null; sayfaSon?: number | null
}
/** kitapAdi saklanır: kitap silinse de eski haftada adı görünür. */
export type MentorOdevi = { id: string; kitapId: string | null; kitapAdi: string; konu: string; sayfalar: string; yapti: boolean }
export type Okuma = { kitap: string; sayfa: number | null; bitti: boolean }
/** Soru sonucu: haftanın planındaki kitap (k:<id>) ya da kitapsız soru görevinin dersi (d:<ders>) başına tek satır.
 *  Ad/ders/sayfa girildiği an saklanır: plan ya da kitap sonradan değişse de sonuç anlamını korur. */
export type Sonuc = {
  anahtar: string; ad: string; ders: string; sayfa: string
  cozulen: number | null; dogru: number | null; yanlis: number | null; bos: number | null
}
/** sonuclar 2026-10-17'de geldi; eski kayıtlarda yok. */
export type Icerik = { duzen: string; gorevler: Gorev[]; mentorOdevleri: MentorOdevi[]; okuma: Okuma | null; sonuclar?: Sonuc[] }
export type Gorusme = { iyi: string; zor: string; hedef: string; odak: string; evde: string }
export type Ozet = { gorev_toplam: number; gorev_yapilan: number; soru: number; dogru: number; okuma_sayfa: number; islendi: boolean }
export type HaftaVerisi = { seviye: Seviye; soruHedefi: number; icerik: Icerik; gorusme: Gorusme }

/** Haftanın pazartesisi ('YYYY-MM-DD', UTC takvim aritmetiği — saat dilimi kaydırmaz). */
export function haftaBasi(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return addDaysISO(iso, -((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7))
}
export const haftaKaydir = (pazartesi: string, delta: number) => addDaysISO(pazartesi, delta * 7)

export const BOS_GORUSME: Gorusme = { iyi: '', zor: '', hedef: '', odak: '', evde: '' }
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

export function miktarYaz(g: Pick<Gorev, 'miktar' | 'birim'>, seviye: Seviye): string {
  if (g.miktar === null || g.birim === 'serbest') return ''
  const m = seviyeMiktar(g.miktar, seviye)
  return g.birim === 'dk' ? sureYaz(m) : `${m} soru`
}

/** Görev satırının kitap/sayfa metni (plan + kâğıt). Kitapsız görevde eski serbest `sayfa` metni. */
export function kitapSayfaYaz(g: Gorev): string {
  if (!g.kitapId) return g.sayfa
  const bas = g.sayfaBas ?? null, son = g.sayfaSon ?? null
  const s = bas === null ? '' : son === null || son === bas ? ` s. ${bas}` : ` s. ${bas}–${son}`
  return `${g.kitapAdi ?? ''}${s}`
}

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
    const sayfa = bas === null ? '' : son === null || son === bas ? `s. ${bas}` : `s. ${bas}–${son}`
    const k = kayitli.get(s.anahtar)
    return { ...s, sayfa, ...(k && { cozulen: k.cozulen, dogru: k.dogru, yanlis: k.yanlis, bos: k.bos }) }
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

/** Yeni hafta: önceki haftanın planı (sonuçsuz), seviye, hedef, düzen; bitmemiş kitap. Yoksa sınıf şablonu + Hafif. */
export function yeniHafta(onceki: HaftaVerisi | null, sinif: number): HaftaVerisi {
  if (!onceki) return {
    seviye: 0, soruHedefi: varsayilanHedef(sinif, 0), gorusme: BOS_GORUSME,
    icerik: { duzen: VARSAYILAN_DUZEN, gorevler: sinifSablonu(sinif), mentorOdevleri: [], okuma: null },
  }
  const ok = onceki.icerik.okuma
  return {
    seviye: onceki.seviye, soruHedefi: onceki.soruHedefi, gorusme: BOS_GORUSME,
    icerik: {
      duzen: onceki.icerik.duzen, gorevler: onceki.icerik.gorevler.map(sonucsuz), mentorOdevleri: [],
      okuma: ok && !ok.bitti ? { kitap: ok.kitap, sayfa: null, bitti: false } : null,
    },
  }
}

export type OkulOdevi = { id: string; subject: string; title: string; due_date: string; status: string | null; bekliyor: boolean }

/** Haftanın (Pzt–Paz) son teslimli okul ödevleri; durum dersin öğretmeninin işareti. */
export function okulOdevleri(kayitlar: HomeworkRecord[], pazartesi: string): OkulOdevi[] {
  const son = addDaysISO(pazartesi, 6)
  return kayitlar
    .filter((k): k is HomeworkRecord & { due_date: string } => k.due_date !== null && k.due_date >= pazartesi && k.due_date <= son)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.subject.localeCompare(b.subject, 'tr'))
    .map(k => ({ id: k.id, subject: k.subject, title: k.title, due_date: k.due_date, status: k.status, bekliyor: k.bekliyor }))
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
