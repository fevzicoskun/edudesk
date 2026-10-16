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
}
/** kitapAdi saklanır: kitap silinse de eski haftada adı görünür. */
export type MentorOdevi = { id: string; kitapId: string | null; kitapAdi: string; konu: string; sayfalar: string; yapti: boolean }
export type Okuma = { kitap: string; sayfa: number | null; bitti: boolean }
export type Icerik = { duzen: string; gorevler: Gorev[]; mentorOdevleri: MentorOdevi[]; okuma: Okuma | null }
export type Gorusme = { iyi: string; zor: string; hedef: string; odak: string; evde: string }
export type Ozet = { gorev_toplam: number; gorev_yapilan: number; soru: number; dogru: number; okuma_sayfa: number; islendi: boolean }
export type HaftaVerisi = { seviye: Seviye; soruHedefi: number; icerik: Icerik; gorusme: Gorusme }

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

export function varsayilanHedef(sinif: number, seviye: Seviye): number {
  return (sinif >= 11 ? [200, 300, 400] : [120, 200, 300])[seviye]
}

export function ozetHesapla(icerik: Icerik): Ozet {
  const soruSat = icerik.gorevler.filter(g => g.soruSatiri)
  const soru = soruSat.reduce((t, g) => t + (g.soru ?? 0), 0)
  const dogru = soruSat.reduce((t, g) => t + (g.dogru ?? 0), 0)
  const okuma_sayfa = icerik.okuma?.sayfa ?? 0
  const yapilan = icerik.gorevler.filter(g => g.yapti).length + icerik.mentorOdevleri.filter(m => m.yapti).length
  const islendi = yapilan > 0 || soruSat.some(g => g.soru !== null) || okuma_sayfa > 0 || !!icerik.okuma?.bitti
  return {
    gorev_toplam: icerik.gorevler.length + icerik.mentorOdevleri.length, gorev_yapilan: yapilan,
    soru, dogru, okuma_sayfa, islendi,
  }
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
