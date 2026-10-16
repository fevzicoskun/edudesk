# Mentör Haftalık Takip — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mentör öğrenciyle haftalık plan yapar → kâğıt basılır → öğrenci işaretler → mentör kâğıttan işler → veliye otomatik mesaj; idare yalnız özet rakam görür.

**Architecture:** Öğrenci×hafta tek satır (`mentor_haftalari`: `icerik` JSONB + `gorusme` JSONB + sunucuda hesaplanan özet sütunları). Saf hesaplar `src/domains/mentor/takip/`'te; repository → service → server action katmanı mevcut mentor domain'i izler. Erişim: `mentor_takip_kullanicilari` tablosunda satırı olan + `mentorships`'te öğrencinin mentörü olan öğretmen (RLS helper). Okul ödevleri saklanmaz, mevcut ödev profilinden okunur.

**Tech Stack:** Next.js App Router (proxy.ts, webpack — Turbopack YASAK), React 19, Tailwind v4, Supabase (RLS, MCP `apply_migration`), Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-16-mentor-haftalik-takip-design.md`

## Global Constraints

- Tüm UI metinleri Türkçe, Türkçe karakter eksiksiz. Soluk metin: `text-gray-500 dark:text-slate-400` (gray-400 YASAK, WCAG AA).
- Her sorguda `school_id` filtresi; soft-delete tablolarında `.is('deleted_at', null)`.
- Server action: Zod ile doğrula → service → `revalidatePath`. Service'te `requireAbility()`.
- Yeni tablo migration'ından sonra `database.types.ts` regen (MCP `generate_typescript_types`) — yoksa tsc kırılır.
- RLS helper SECURITY DEFINER fn'lerden `authenticated` EXECUTE ÇEKİLMEZ (yalnız anon/public revoke).
- Çıktılar ortak dashboard şablonuyla basılır (`Filigran` + `@page { margin: 0 }` zaten global); sayfaya özel `@page` yalnız `size` verir, `margin` VERMEZ.
- Seviye çarpanı: Hafif ×0,7 / Normal ×1 / Yoğun ×1,25, 5'e yuvarlanır. Soru hedefi: 9–10 → 120/200/300; 11–12 → 200/300/400.
- Matematik satırı baskısı: kalın + `bg-gray-100` (turuncu YOK).
- Ödev "baş harf büyük" kuralı bu modüle UYGULANMAZ (görev/kitap adları olduğu gibi).
- Commit mesajı sonu: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; her task sonunda commit + push (kullanıcı kalıcı talimatı).

**Spec'ten bilinçli sapmalar (plan ayrıntısı):**
1. Açma bayrağı `profiles` sütunu değil, ayrı tablo `mentor_takip_kullanicilari` — `profiles_self_update` policy'si kullanıcının kendi satırını güncellemesine izin veriyor; sütun olsaydı her öğretmen modülü kendine açabilirdi. Tabloya yazma policy'si yok (yalnız SQL/service role).
2. `islendi_at timestamptz` yerine `islendi boolean` — zaman hiçbir ekranda gösterilmiyor (YAGNI).

## Review Focus

1. **İki sekme / eski sekme ezmesi** — aynı hafta iki sekmede açıkken eski sekmenin kaydı reddedilmeli ("Başka bir ekranda değişti"), sessizce üzerine yazmamalı. → Task 3 service testi + Task 6 e2e.
2. **Doğru > soru / negatif / ondalık giriş** — istemci engellemese bile sunucu reddetmeli; özet sütunları istemciden değil `icerik`'ten hesaplanmalı. → Task 1 Zod testi + Task 3 service testi (istemci `ozet` gönderemez).
3. **Hiç kaydı olmayan hafta yalnız görüntülenince satır oluşmamalı**; ilk düzenlemede oluşmalı (Mentörlüğüm'de "Plan yok" doğru kalmalı). → Task 3 service testi + Task 7 e2e.
4. **Mentörlükten çıkarılan / başka mentöre geçen öğrenci** — eski mentör takip sayfasını açamamalı (404), yeni mentör geçmişi görmeli. → Task 2 SQL doğrulaması + Task 12 e2e.
5. **Silinen kitap** — eski haftalardaki mentör ödevinde kitap adı korunmalı (kâğıtta ve ekranda). → Task 1 (`kitapAdi` saklanır) + Task 4 testi.

---

## Dosya Haritası

| Dosya | Sorumluluk |
|---|---|
| `src/domains/mentor/takip/takipMath.ts` | Tipler + saf hesaplar (seviye, süre, özet, yüzde, yeni hafta, okul ödevleri, hafta durumu) |
| `src/domains/mentor/takip/sablonlar.ts` | Sınıf şablonları, varsayılan düzen metni, matematik konu listeleri |
| `src/domains/mentor/takip/veliMesaji.ts` | Veli mesajı metni (saf) |
| `src/domains/mentor/validators/takip.ts` | Zod şemaları (`icerik`, `gorusme`, kaydet girdisi) |
| `supabase/migrations/20261016120000_mentor_haftalik_takip.sql` | Tablolar, RLS, helper, özet RPC |
| `src/domains/mentor/repositories/TakipRepository.ts` | Ham Supabase çağrıları |
| `src/domains/mentor/services/TakipService.ts` | Erişim, sayfa verisi, kaydet (eşzamanlılık), kitap/konu |
| `app/actions/mentor-takip.ts` | Server action'lar |
| `app/(dashboard)/mentorluk/[studentId]/takip/page.tsx` | Sunucu: kapı + veri |
| `app/(dashboard)/mentorluk/[studentId]/takip/TakipIstemci.tsx` | Sekmeler, hafta seçici, kayıt durumu |
| `app/(dashboard)/mentorluk/[studentId]/takip/useOtoKayit.ts` | Gecikmeli otomatik kayıt + çıkış uyarısı |
| `app/(dashboard)/mentorluk/[studentId]/takip/PlanSekmesi.tsx` | Plan sekmesi |
| `app/(dashboard)/mentorluk/[studentId]/takip/SonucSekmesi.tsx` | Sonuç sekmesi |
| `app/(dashboard)/mentorluk/[studentId]/takip/VeliSekmesi.tsx` | Veli mesajı sekmesi |
| `app/(dashboard)/mentorluk/[studentId]/takip/DosyaSekmesi.tsx` | Öğrenci dosyası sekmesi |
| `app/(dashboard)/mentorluk/[studentId]/takip/OgrenciKagidi.tsx` | Kâğıt bileşeni (tekli + toplu) |
| `app/(dashboard)/mentorluk/[studentId]/takip/kagit/page.tsx` | Kâğıt çıktısı |
| `app/(dashboard)/mentorluk/[studentId]/takip/veli-raporu/page.tsx` | Veli raporu çıktısı |
| `app/(dashboard)/mentorluk/takip-kagitlari/page.tsx` | Toplu kâğıt |
| Değişen: `app/(dashboard)/mentorluk/[studentId]/page.tsx`, `app/(dashboard)/mentorluk/page.tsx`, `app/(dashboard)/mentorluk/MentorTablosu.tsx`, `app/(dashboard)/yonetim/mentorluk/page.tsx` | Giriş bağlantısı, hafta durumu, idare sütunları |
| `tests/vitest/unit/mentor/takipMath.test.ts`, `takipValidators.test.ts`, `veliMesaji.test.ts`, `takip-service.test.ts` | Birim testleri |
| `tests/playwright/e2e/mentor-takip.spec.ts` | E2E |

---

## AŞAMA 1 — Plan + kâğıt

### Task 1: Saf hesaplar, şablonlar ve doğrulama

**Files:**
- Create: `src/domains/mentor/takip/takipMath.ts`, `src/domains/mentor/takip/sablonlar.ts`, `src/domains/mentor/validators/takip.ts`
- Test: `tests/vitest/unit/mentor/takipMath.test.ts`, `tests/vitest/unit/mentor/takipValidators.test.ts`

**Interfaces:**
- Produces (takipMath.ts):
  - `type Seviye = 0 | 1 | 2`, `type Birim = 'dk' | 'soru' | 'serbest'`
  - `type Gorev = { id: string; gun: number; ad: string; ders: string | null; miktar: number | null; birim: Birim; soruSatiri: boolean; konu: string; sayfa: string; yapti: boolean; soru: number | null; dogru: number | null }`
  - `type MentorOdevi = { id: string; kitapId: string | null; kitapAdi: string; konu: string; sayfalar: string; yapti: boolean }`
  - `type Okuma = { kitap: string; sayfa: number | null; bitti: boolean }`
  - `type Icerik = { duzen: string; gorevler: Gorev[]; mentorOdevleri: MentorOdevi[]; okuma: Okuma | null }`
  - `type Gorusme = { iyi: string; zor: string; hedef: string; odak: string; evde: string }`, `BOS_GORUSME: Gorusme`
  - `type Ozet = { gorev_toplam: number; gorev_yapilan: number; soru: number; dogru: number; okuma_sayfa: number; islendi: boolean }`
  - `type HaftaVerisi = { seviye: Seviye; soruHedefi: number; icerik: Icerik; gorusme: Gorusme }`
  - `seviyeMiktar(miktar: number, seviye: Seviye): number`, `sureYaz(dk: number): string`, `miktarYaz(g: Pick<Gorev,'miktar'|'birim'>, seviye: Seviye): string`
  - `varsayilanHedef(sinif: number, seviye: Seviye): number`
  - `ozetHesapla(icerik: Icerik): Ozet`, `programYuzde(o: Pick<Ozet,'gorev_toplam'|'gorev_yapilan'>): number | null`, `dogrulukYuzde(o: Pick<Ozet,'soru'|'dogru'>): number | null`
  - `fark(bu: Ozet, onceki: Ozet | null): number | null`
  - `yeniHafta(onceki: HaftaVerisi | null, sinif: number): HaftaVerisi`
  - `type OkulOdevi = { id: string; subject: string; title: string; due_date: string; status: string | null; bekliyor: boolean }`, `okulOdevleri(kayitlar: HomeworkRecord[], pazartesi: string): OkulOdevi[]`
  - `type HaftaDurumu = 'yok' | 'kagitta' | 'islendi'`, `haftaDurumu(satir: { islendi: boolean } | null): HaftaDurumu`
  - `GUNLER = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz']`, `SEVIYE_ADI = ['Hafif','Normal','Yoğun']`
- Produces (sablonlar.ts): `sinifSablonu(sinif: number): Gorev[]`, `VARSAYILAN_DUZEN: string`, `MATEMATIK_KONULARI: Record<9|10|11|12, { grup: string; ad: string }[]>`
- Produces (validators/takip.ts): `icerikSchema`, `gorusmeSchema`, `kaydetSchema` (`{ studentId, hafta, seviye, soruHedefi, icerik, gorusme, sonBilinen: string | null }`)

- [ ] **Step 1: Failing test — takipMath**

`tests/vitest/unit/mentor/takipMath.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  seviyeMiktar, sureYaz, miktarYaz, varsayilanHedef, ozetHesapla, programYuzde, dogrulukYuzde, fark,
  yeniHafta, okulOdevleri, haftaDurumu, BOS_GORUSME, type Icerik, type Gorev,
} from '@/src/domains/mentor/takip/takipMath'
import { sinifSablonu, VARSAYILAN_DUZEN, MATEMATIK_KONULARI } from '@/src/domains/mentor/takip/sablonlar'
import type { HomeworkRecord } from '@/src/domains/homework/lib/stats'

const g = (o: Partial<Gorev> = {}): Gorev => ({
  id: 'x', gun: 0, ad: 'G', ders: null, miktar: 60, birim: 'dk', soruSatiri: false,
  konu: '', sayfa: '', yapti: false, soru: null, dogru: null, ...o,
})
const icerik = (o: Partial<Icerik> = {}): Icerik => ({ duzen: '', gorevler: [], mentorOdevleri: [], okuma: null, ...o })

describe('seviyeMiktar', () => {
  it('Normal değişmez', () => expect(seviyeMiktar(45, 1)).toBe(45))
  it('Hafif ×0,7 → 5e yuvarlanır', () => { expect(seviyeMiktar(60, 0)).toBe(40); expect(seviyeMiktar(15, 0)).toBe(10) })
  it('Yoğun ×1,25 → 5e yuvarlanır', () => { expect(seviyeMiktar(60, 2)).toBe(75); expect(seviyeMiktar(45, 2)).toBe(55) })
  it('en az 5', () => expect(seviyeMiktar(5, 0)).toBe(5))
})

describe('sureYaz / miktarYaz', () => {
  it('dakika ve saat biçimleri', () => {
    expect(sureYaz(45)).toBe('45 dk'); expect(sureYaz(60)).toBe('1 saat'); expect(sureYaz(90)).toBe('1,5 saat')
    expect(sureYaz(135)).toBe('2 saat 15 dk'); expect(sureYaz(165)).toBe('2 saat 45 dk')
  })
  it('birim', () => {
    expect(miktarYaz({ miktar: 60, birim: 'dk' }, 2)).toBe('1 saat 15 dk')
    expect(miktarYaz({ miktar: 20, birim: 'soru' }, 1)).toBe('20 soru')
    expect(miktarYaz({ miktar: null, birim: 'serbest' }, 1)).toBe('')
  })
})

describe('varsayilanHedef', () => {
  it('9–10 ve 11–12', () => {
    expect([0, 1, 2].map(s => varsayilanHedef(9, s as 0))).toEqual([120, 200, 300])
    expect([0, 1, 2].map(s => varsayilanHedef(12, s as 0))).toEqual([200, 300, 400])
  })
})

describe('ozet / yüzdeler', () => {
  it('görev + mentör ödevi sayılır, soru yalnız soru satırlarından', () => {
    const o = ozetHesapla(icerik({
      gorevler: [g({ yapti: true, soruSatiri: true, soru: 40, dogru: 30 }), g({ soru: 99, dogru: 99 }), g()],
      mentorOdevleri: [{ id: 'm', kitapId: null, kitapAdi: 'K', konu: '', sayfalar: '', yapti: true }],
      okuma: { kitap: 'R', sayfa: 120, bitti: false },
    }))
    expect(o).toEqual({ gorev_toplam: 4, gorev_yapilan: 2, soru: 40, dogru: 30, okuma_sayfa: 120, islendi: true })
    expect(programYuzde(o)).toBe(50); expect(dogrulukYuzde(o)).toBe(75)
  })
  it('payda 0 → null', () => {
    const o = ozetHesapla(icerik())
    expect(programYuzde(o)).toBeNull(); expect(dogrulukYuzde(o)).toBeNull(); expect(o.islendi).toBe(false)
  })
  it('fark yalnız iki hafta da işlendiyse', () => {
    const bu = { gorev_toplam: 1, gorev_yapilan: 1, soru: 100, dogru: 80, okuma_sayfa: 0, islendi: true }
    expect(fark(bu, { ...bu, dogru: 70 })).toBe(10)
    expect(fark(bu, { ...bu, islendi: false })).toBeNull()
    expect(fark(bu, null)).toBeNull()
  })
})

describe('yeniHafta', () => {
  it('önceki yoksa sınıf şablonu + Hafif + varsayılan hedef', () => {
    const h = yeniHafta(null, 10)
    expect(h.seviye).toBe(0); expect(h.soruHedefi).toBe(120)
    expect(h.icerik.gorevler).toEqual(sinifSablonu(10)); expect(h.icerik.duzen).toBe(VARSAYILAN_DUZEN)
    expect(h.gorusme).toEqual(BOS_GORUSME)
  })
  it('öncekinden görevler sonuçsuz kopyalanır; mentör ödevi, görüşme, bitmiş kitap taşınmaz', () => {
    const onceki = {
      seviye: 2 as const, soruHedefi: 350,
      icerik: icerik({ duzen: 'D', gorevler: [g({ yapti: true, konu: 'Türev', sayfa: '4', soru: 5, dogru: 4 })],
        mentorOdevleri: [{ id: 'm', kitapId: null, kitapAdi: 'K', konu: '', sayfalar: '', yapti: true }],
        okuma: { kitap: 'R', sayfa: 50, bitti: true } }),
      gorusme: { ...BOS_GORUSME, hedef: 'H' },
    }
    const h = yeniHafta(onceki, 11)
    expect(h.seviye).toBe(2); expect(h.soruHedefi).toBe(350); expect(h.icerik.duzen).toBe('D')
    expect(h.icerik.gorevler[0]).toEqual(g({}))
    expect(h.icerik.mentorOdevleri).toEqual([]); expect(h.icerik.okuma).toBeNull(); expect(h.gorusme).toEqual(BOS_GORUSME)
  })
  it('bitmemiş kitap sayfası boş olarak taşınır', () => {
    const h = yeniHafta({ seviye: 1, soruHedefi: 200, icerik: icerik({ okuma: { kitap: 'R', sayfa: 50, bitti: false } }), gorusme: BOS_GORUSME }, 9)
    expect(h.icerik.okuma).toEqual({ kitap: 'R', sayfa: null, bitti: false })
  })
})

describe('okulOdevleri / haftaDurumu', () => {
  const k = (id: string, due: string | null): HomeworkRecord =>
    ({ id, title: id, subject: 'Fizik', due_date: due, status: null, note: null, teacher_id: 't', bekliyor: true } as HomeworkRecord)
  it('Pzt–Paz arası, tarihe göre', () => {
    expect(okulOdevleri([k('b', '2026-10-25'), k('a', '2026-10-19'), k('d', '2026-10-26'), k('n', null)], '2026-10-19').map(o => o.id))
      .toEqual(['a', 'b'])
  })
  it('durum', () => {
    expect(haftaDurumu(null)).toBe('yok'); expect(haftaDurumu({ islendi: false })).toBe('kagitta'); expect(haftaDurumu({ islendi: true })).toBe('islendi')
  })
})

describe('şablonlar', () => {
  it('her sınıfta benzersiz id, gün 0–6', () => {
    for (const s of [9, 10, 11, 12]) {
      const t = sinifSablonu(s)
      expect(new Set(t.map(x => x.id)).size).toBe(t.length)
      expect(t.every(x => x.gun >= 0 && x.gun <= 6)).toBe(true)
    }
  })
  it('matematik satırları ders=Matematik; paragraf soru satırı', () => {
    const t = sinifSablonu(9)
    expect(t.filter(x => x.ad === 'Paragraf').every(x => x.soruSatiri && x.birim === 'soru')).toBe(true)
    expect(t.find(x => x.ad === 'Matematik: yanlışların çözümü')).toMatchObject({ ders: 'Matematik', soruSatiri: false })
  })
  it('konu listeleri dolu', () => { for (const s of [9, 10, 11, 12] as const) expect(MATEMATIK_KONULARI[s].length).toBeGreaterThan(5) })
})
```

- [ ] **Step 2: Run — FAIL** `npx vitest run tests/vitest/unit/mentor/takipMath.test.ts` → "Cannot find module".

- [ ] **Step 3: Implement `takipMath.ts`**

```ts
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
```

- [ ] **Step 4: Implement `sablonlar.ts`**

```ts
// src/domains/mentor/takip/sablonlar.ts
// Sınıf şablonları (Normal seviye) + matematik konu listeleri. Okul yıllık planıyla karşılaştırılıp düzeltilebilir.
import type { Gorev, Birim } from './takipMath'

export const VARSAYILAN_DUZEN = '16.30–18.00 dinlenme · 18.00 ana çalışma · yemek · günün dersi · 21.00\'den sonra serbest'

type Tanim = [ad: string, miktar: number | null, birim: Birim, ders: string | null, soruSatiri: boolean]
const M = 'Matematik'

const SABLON_9_10 = {
  gunluk: [['Okul tekrarı', 15, 'dk', null, false], ['Matematik soru bankası', 60, 'dk', M, true], ['Paragraf', 15, 'soru', 'Türkçe', true]] as Tanim[],
  ek: [
    [['Matematik: yanlışların çözümü', 45, 'dk', M, false]],
    [['Fizik', 45, 'dk', 'Fizik', false]],
    [['Matematik: konu testi', 45, 'dk', M, true]],
    [['Kimya / Biyoloji', 45, 'dk', null, false]],
    [['İngilizce', 45, 'dk', 'İngilizce', false]],
    [['Matematik tarama testi', 90, 'dk', M, true], ['Edebiyat + Tarih/Coğrafya', 90, 'dk', null, false]],
    [['Matematik tekrarı', 60, 'dk', M, false], ['Haftalık genel tekrar', null, 'serbest', null, false]],
  ] as Tanim[][],
}
const SABLON_11_12 = {
  gunluk: [['Okul tekrarı', 15, 'dk', null, false], ['TYT Matematik', 45, 'dk', M, true], ['Paragraf', 20, 'soru', 'Türkçe', true]] as Tanim[],
  ek: [
    [['AYT Matematik', 60, 'dk', M, true]],
    [['Fizik / Edebiyat', 45, 'dk', null, false]],
    [['AYT Matematik', 60, 'dk', M, true]],
    [['Kimya / Biyoloji / Tarih-Coğrafya', 45, 'dk', null, false]],
    [['Matematik: yanlışların çözümü', 45, 'dk', M, false]],
    [['TYT denemesi', 165, 'dk', null, true], ['Deneme analizi', 45, 'dk', null, false]],
    [['AYT Matematik tekrarı', 90, 'dk', M, false], ['Haftalık genel tekrar', null, 'serbest', null, false]],
  ] as Tanim[][],
}

export function sinifSablonu(sinif: number): Gorev[] {
  const s = sinif >= 11 ? SABLON_11_12 : SABLON_9_10
  return Array.from({ length: 7 }, (_, gun) => [...(gun < 5 ? s.gunluk : []), ...s.ek[gun]])
    .flatMap((tanimlar, gun) => tanimlar.map(([ad, miktar, birim, ders, soruSatiri], i) => ({
      id: `s${gun}-${i}`, gun, ad, ders, miktar, birim, soruSatiri, konu: '', sayfa: '', yapti: false, soru: null, dogru: null,
    })))
}

const k = (grup: string, adlar: string) => adlar.split(' · ').map(ad => ({ grup, ad }))
export const MATEMATIK_KONULARI: Record<9 | 10 | 11 | 12, { grup: string; ad: string }[]> = {
  9: [
    ...k('Sayılar', 'Üslü ifadeler · Köklü ifadeler · Sayı kümeleri ve aralıklar'),
    ...k('Nicelikler ve Değişimler', 'Doğrusal fonksiyonlar · Mutlak değer · Denklem ve eşitsizlikler'),
    ...k('Geometrik Şekiller', 'Üçgende açılar · Üçgende kenar bağıntıları'),
    ...k('Eşlik ve Benzerlik', 'Dönüşümler · Eşlik ve benzerlik · Tales, Öklid, Pisagor'),
    ...k('Algoritma ve Bilişim', 'Algoritmik problem çözme · Mantık bağlaçları'),
    ...k('İstatistiksel Araştırma Süreci', 'Veri toplama · Grafik ve yorum'),
    ...k('Veriden Olasılığa', 'Deneysel ve teorik olasılık'),
  ],
  10: [
    ...k('Sayılar', 'Asal sayılar · EBOB ve EKOK · Bölünebilme'),
    ...k('Nicelikler ve Değişimler', 'İkinci dereceden fonksiyonlar · Karekök fonksiyonu · Rasyonel fonksiyonlar'),
    ...k('Geometrik Şekiller', 'Dik üçgende trigonometri · Üçgende yardımcı elemanlar · Sinüs ve kosinüs teoremleri'),
    ...k('Sayma, Algoritma ve Bilişim', 'Sayma · Algoritmalar'),
    ...k('Analitik İnceleme', 'Koordinat düzleminde inceleme'),
    ...k('İstatistiksel Araştırma Süreci', 'Veri, grafik ve yorum'),
    ...k('Veriden Olasılığa', 'Deneysel ve teorik olasılık'),
  ],
  11: [
    ...k('Geometrik Şekiller', 'Dörtgenler · Özel dörtgenler · Çokgenler'),
    ...k('Nicelikler ve Değişimler', 'Trigonometri · Üstel ve logaritmik fonksiyonlar · Bileşke fonksiyon ve fonksiyon işlemleri'),
    ...k('İstatistiksel Araştırma Süreci', 'Veri, tablo, grafik ve yorum'),
  ],
  12: [
    ...k('TYT Temel', 'Temel kavramlar ve sayılar · Problemler'),
    ...k('Cebir', 'Polinomlar · İkinci dereceden denklemler · Parabol · Karmaşık sayılar · Logaritma · Diziler'),
    ...k('Trigonometri', 'Trigonometri'),
    ...k('Analiz', 'Limit ve süreklilik · Türev · İntegral'),
    ...k('Sayma ve Olasılık', 'Permütasyon ve kombinasyon · Olasılık'),
    ...k('Geometri', 'Çember ve daire · Analitik geometri · Dönüşüm geometrisi · Katı cisimler'),
  ],
}
```

- [ ] **Step 5: Run — PASS** `npx vitest run tests/vitest/unit/mentor/takipMath.test.ts`

- [ ] **Step 6: Failing test — validators**

`tests/vitest/unit/mentor/takipValidators.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { kaydetSchema } from '@/src/domains/mentor/validators/takip'
import { yeniHafta } from '@/src/domains/mentor/takip/takipMath'

const gecerli = () => {
  const h = yeniHafta(null, 9)
  return { studentId: '11111111-1111-4111-8111-111111111111', hafta: '2026-10-19', seviye: h.seviye, soruHedefi: h.soruHedefi, icerik: h.icerik, gorusme: h.gorusme, sonBilinen: null }
}

describe('kaydetSchema', () => {
  it('şablon haftası geçerli', () => expect(kaydetSchema.safeParse(gecerli()).success).toBe(true))
  it('doğru > soru reddedilir', () => {
    const v = gecerli(); v.icerik.gorevler[1] = { ...v.icerik.gorevler[1], soru: 10, dogru: 11 }
    expect(kaydetSchema.safeParse(v).success).toBe(false)
  })
  it('negatif / ondalık soru reddedilir', () => {
    for (const soru of [-1, 2.5]) {
      const v = gecerli(); v.icerik.gorevler[1] = { ...v.icerik.gorevler[1], soru, dogru: 0 }
      expect(kaydetSchema.safeParse(v).success).toBe(false)
    }
  })
  it('pazartesi olmayan hafta reddedilir', () => expect(kaydetSchema.safeParse({ ...gecerli(), hafta: '2026-10-20' }).success).toBe(false))
  it('fazladan özet alanı atılır (istemci özet gönderemez)', () => {
    const r = kaydetSchema.safeParse({ ...gecerli(), ozet: { soru: 9999 } })
    expect(r.success && 'ozet' in r.data).toBe(false)
  })
})
```

- [ ] **Step 7: Run — FAIL**, sonra implement `src/domains/mentor/validators/takip.ts`:

```ts
import { z } from 'zod'
import { UUID } from '@/src/shared/validation'
import { pazartesiMi } from '../lib/bultenMath'

const metin = (n: number) => z.string().trim().max(n)
const sayi = z.number().int().min(0).max(100_000)

const gorevSchema = z.object({
  id: z.string().min(1).max(64), gun: z.number().int().min(0).max(6), ad: metin(120).min(1, 'Görev adı boş olamaz'),
  ders: metin(60).nullable(), miktar: z.number().int().min(1).max(600).nullable(), birim: z.enum(['dk', 'soru', 'serbest']),
  soruSatiri: z.boolean(), konu: metin(120), sayfa: metin(60), yapti: z.boolean(), soru: sayi.nullable(), dogru: sayi.nullable(),
}).refine(g => g.dogru === null || (g.soru !== null && g.dogru <= g.soru), { message: 'Doğru sayısı soru sayısından büyük olamaz', path: ['dogru'] })

export const icerikSchema = z.object({
  duzen: metin(300),
  gorevler: z.array(gorevSchema).max(120),
  mentorOdevleri: z.array(z.object({
    id: z.string().min(1).max(64), kitapId: UUID.nullable(), kitapAdi: metin(120).min(1), konu: metin(120), sayfalar: metin(60), yapti: z.boolean(),
  })).max(40),
  okuma: z.object({ kitap: metin(150).min(1), sayfa: sayi.nullable(), bitti: z.boolean() }).nullable(),
})

export const gorusmeSchema = z.object({ iyi: metin(1000), zor: metin(1000), hedef: metin(300), odak: metin(1000), evde: metin(1000) })

export const kaydetSchema = z.object({
  studentId: UUID,
  hafta: z.string().refine(pazartesiMi, 'Hafta pazartesi olmalı'),
  seviye: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  soruHedefi: z.number().int().min(0).max(10_000),
  icerik: icerikSchema,
  gorusme: gorusmeSchema,
  sonBilinen: z.string().datetime({ offset: true }).nullable(),
})
export type KaydetGirdisi = z.infer<typeof kaydetSchema>
```

- [ ] **Step 8: Run — PASS** `npx vitest run tests/vitest/unit/mentor/takipValidators.test.ts tests/vitest/unit/mentor/takipMath.test.ts`; `npm run typecheck` temiz.

- [ ] **Step 9: Commit + push**

```bash
git add src/domains/mentor/takip src/domains/mentor/validators/takip.ts tests/vitest/unit/mentor/takipMath.test.ts tests/vitest/unit/mentor/takipValidators.test.ts
git commit -m "feat(mentor-takip): saf hesaplar, sınıf şablonları, Zod şemaları

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 2: Migration — tablolar, RLS, helper, özet RPC

**Files:**
- Create: `supabase/migrations/20261016120000_mentor_haftalik_takip.sql`
- Modify: `src/infrastructure/supabase/database.types.ts` (regen)

**Interfaces:**
- Produces (DB): `mentor_takip_kullanicilari(user_id, school_id)`, `mentor_kitaplari`, `mentor_haftalari`, `konu_listesi`, `ogrenci_konu_durumu`; fn `mentor_takip_acik() → boolean`, `mentor_takip_erisimi(p_student uuid) → boolean`, RPC `mentor_takip_ozet() → table(student_id uuid, hafta_basi date, gorev_toplam int, gorev_yapilan int, soru int, dogru int)`.

- [ ] **Step 1: Migration dosyası**

```sql
-- Mentör haftalık takip (spec 2026-10-16). Öğrenci×hafta tek satır; idare yalnız özet RPC'den görür.

-- Açma listesi: yazma policy'si YOK → yalnız SQL/service role açar (profiles_self_update kendine açmayı engellemek için ayrı tablo).
create table if not exists mentor_takip_kullanicilari (
  user_id   uuid primary key references profiles(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table mentor_takip_kullanicilari enable row level security;
create policy mentor_takip_kullanicilari_select on mentor_takip_kullanicilari for select using (user_id = (select auth.uid()));

create or replace function public.mentor_takip_acik() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from mentor_takip_kullanicilari k where k.user_id = auth.uid() and k.school_id = current_school_id())
$$;
create or replace function public.mentor_takip_erisimi(p_student uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select mentor_takip_acik() and exists (
    select 1 from mentorships m where m.student_id = p_student and m.mentor_id = auth.uid() and m.school_id = current_school_id())
$$;
revoke execute on function public.mentor_takip_acik() from anon, public;
revoke execute on function public.mentor_takip_erisimi(uuid) from anon, public;
grant execute on function public.mentor_takip_acik() to authenticated;
grant execute on function public.mentor_takip_erisimi(uuid) to authenticated;

create table if not exists mentor_kitaplari (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  ad text not null check (length(ad) between 1 and 120),
  ders text not null default '' check (length(ders) <= 60),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists mentor_kitaplari_student_idx on mentor_kitaplari (student_id) where deleted_at is null;

create table if not exists mentor_haftalari (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  hafta_basi date not null check (extract(isodow from hafta_basi) = 1),
  seviye smallint not null check (seviye between 0 and 2),
  soru_hedefi int not null check (soru_hedefi >= 0),
  icerik jsonb not null,
  gorusme jsonb not null default '{}'::jsonb,
  gorev_toplam int not null default 0, gorev_yapilan int not null default 0,
  soru int not null default 0, dogru int not null default 0 check (dogru <= soru),
  okuma_sayfa int not null default 0,
  islendi boolean not null default false,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (student_id, hafta_basi)
);
create index if not exists mentor_haftalari_school_idx on mentor_haftalari (school_id, hafta_basi);

create table if not exists konu_listesi (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  ders text not null, sinif smallint not null check (sinif between 9 and 12),
  ad text not null check (length(ad) between 1 and 120), grup text, sira int not null default 0,
  created_by uuid references profiles(id) on delete set null,
  unique (school_id, ders, sinif, ad)
);

create table if not exists ogrenci_konu_durumu (
  student_id uuid not null references students(id) on delete cascade,
  konu_id uuid not null references konu_listesi(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  durum smallint not null check (durum between 0 and 2),
  updated_at timestamptz not null default now(),
  primary key (student_id, konu_id)
);

alter table mentor_kitaplari enable row level security;
alter table mentor_haftalari enable row level security;
alter table konu_listesi enable row level security;
alter table ogrenci_konu_durumu enable row level security;

-- Mentör erişimi: bayrak açık + öğrencinin güncel mentörü + aynı okul. İdareye select YOK (özet RPC'den).
create policy mentor_kitaplari_all on mentor_kitaplari for all
  using (school_id = current_school_id() and mentor_takip_erisimi(student_id))
  with check (school_id = current_school_id() and mentor_takip_erisimi(student_id));
create policy mentor_haftalari_all on mentor_haftalari for all
  using (school_id = current_school_id() and mentor_takip_erisimi(student_id))
  with check (school_id = current_school_id() and mentor_takip_erisimi(student_id));
create policy ogrenci_konu_durumu_all on ogrenci_konu_durumu for all
  using (school_id = current_school_id() and mentor_takip_erisimi(student_id))
  with check (school_id = current_school_id() and mentor_takip_erisimi(student_id));

create policy konu_listesi_select on konu_listesi for select using (school_id = current_school_id());
create policy konu_listesi_insert on konu_listesi for insert
  with check (school_id = current_school_id() and mentor_takip_acik() and created_by = (select auth.uid()));

-- İdare özeti: yalnız rakamlar, öğrenci başına son işlenen hafta. icerik/gorusme asla dönmez.
create or replace function public.mentor_takip_ozet()
returns table (student_id uuid, hafta_basi date, gorev_toplam int, gorev_yapilan int, soru int, dogru int)
language sql stable security definer set search_path to 'public' as $$
  select distinct on (h.student_id) h.student_id, h.hafta_basi, h.gorev_toplam, h.gorev_yapilan, h.soru, h.dogru
  from mentor_haftalari h
  where h.school_id = current_school_id() and h.islendi and is_mudur_or_my()
  order by h.student_id, h.hafta_basi desc
$$;
revoke execute on function public.mentor_takip_ozet() from anon, public;
grant execute on function public.mentor_takip_ozet() to authenticated;
```

- [ ] **Step 2: Uygula** — MCP `apply_migration` (project `agijvfrcudpzsofgfogu`, name `mentor_haftalik_takip`, yukarıdaki SQL).

- [ ] **Step 3: SQL doğrulama** — MCP `execute_sql`:

```sql
select tablename, rowsecurity from pg_tables where tablename in
 ('mentor_takip_kullanicilari','mentor_kitaplari','mentor_haftalari','konu_listesi','ogrenci_konu_durumu');
select policyname, tablename, cmd from pg_policies where tablename like 'mentor_%' or tablename in ('konu_listesi','ogrenci_konu_durumu');
```
Expected: 5 tablo `rowsecurity=true`; `mentor_takip_kullanicilari`'da yalnız SELECT policy; diğerleri yukarıdaki gibi. Ardından `get_advisors` (security) — yeni ERROR yok (0028/0029 helper uyarıları bilinçli kabul).

- [ ] **Step 4: Tip regen** — MCP `generate_typescript_types` → çıktıyı `src/infrastructure/supabase/database.types.ts`'e yaz; `npm run typecheck` temiz.

- [ ] **Step 5: Kullanıcıyı aç** — MCP `execute_sql`:

```sql
insert into mentor_takip_kullanicilari (user_id, school_id)
select id, school_id from profiles where full_name ilike 'Fevzi%' and school_id is not null
on conflict do nothing returning user_id;
```
Expected: 1 satır. (Birden fazla dönerse geri al ve kullanıcıya sor.)

- [ ] **Step 6: Commit + push**

```bash
git add supabase/migrations/20261016120000_mentor_haftalik_takip.sql src/infrastructure/supabase/database.types.ts
git commit -m "feat(mentor-takip): tablolar, RLS (yalnız mentör), idare özet RPC

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 3: Repository + Service + Actions

**Files:**
- Create: `src/domains/mentor/repositories/TakipRepository.ts`, `src/domains/mentor/services/TakipService.ts`, `app/actions/mentor-takip.ts`
- Test: `tests/vitest/unit/mentor/takip-service.test.ts`

**Interfaces:**
- Consumes: Task 1 tipleri/fonksiyonları, `kaydetSchema`; Task 2 tabloları.
- Produces:
  - `TakipService.acikMi(): Promise<boolean>`
  - `TakipService.sayfaVerisi(studentId: string, hafta: string): Promise<SayfaVerisi | null>` (null → sayfa `notFound()`)
  - `type SayfaVerisi = { ogrenci: { id: string; ad: string; sinifAdi: string; sinif: number; classId: string }; hafta: string; kayit: { veri: HaftaVerisi; updatedAt: string } | null; taslak: HaftaVerisi; onceki: { ozet: Ozet; hedef: string } | null; kitaplar: { id: string; ad: string; ders: string }[]; okulOdevleri: OkulOdevi[]; konular: { id: string; ders: string; ad: string; grup: string | null }[]; mentorAdi: string; okulAdi: string }`
  - `TakipService.kaydet(g: KaydetGirdisi): Promise<{ error?: string; cakisma?: boolean; updatedAt?: string }>`
  - `TakipService.kitapEkle(studentId: string, ad: string, ders: string): Promise<{ error?: string; kitap?: { id: string; ad: string; ders: string } }>`
  - `TakipService.kitapSil(studentId: string, kitapId: string): Promise<{ error?: string }>`
  - `TakipService.durumlar(studentIds: string[], hafta: string): Promise<Map<string, { islendi: boolean; gorev_toplam: number; gorev_yapilan: number }>>`
  - Actions (`app/actions/mentor-takip.ts`): `haftaKaydet(girdi: unknown)`, `kitapEkle(studentId, ad, ders)`, `kitapSil(studentId, kitapId)` → `ActionResult<...>`

- [ ] **Step 1: Failing test**

`tests/vitest/unit/mentor/takip-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { yeniHafta } from '@/src/domains/mentor/takip/takipMath'

vi.mock('@/src/shared/authorization/server', () => ({ requireAbility: vi.fn().mockResolvedValue({ userId: 'u1', schoolId: 's1' }) }))
vi.mock('@/src/infrastructure/observability/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/src/domains/mentor/repositories/TakipRepository', () => ({
  TakipRepository: { acikMi: vi.fn(), mentoruMu: vi.fn(), haftaEkle: vi.fn(), haftaGuncelle: vi.fn() },
}))
const { TakipRepository: R } = await import('@/src/domains/mentor/repositories/TakipRepository')
const { TakipService } = await import('@/src/domains/mentor/services/TakipService')

const SID = '11111111-1111-4111-8111-111111111111'
const girdi = (sonBilinen: string | null = null) => {
  const h = yeniHafta(null, 9)
  h.icerik.gorevler[1] = { ...h.icerik.gorevler[1], yapti: true, soru: 40, dogru: 30 }
  return { studentId: SID, hafta: '2026-10-19', seviye: h.seviye, soruHedefi: h.soruHedefi, icerik: h.icerik, gorusme: h.gorusme, sonBilinen }
}

beforeEach(() => {
  vi.mocked(R.acikMi).mockResolvedValue(true)
  vi.mocked(R.mentoruMu).mockResolvedValue(true)
  vi.mocked(R.haftaEkle).mockResolvedValue({ updatedAt: 't1' })
  vi.mocked(R.haftaGuncelle).mockResolvedValue({ updatedAt: 't2' })
})

describe('TakipService.kaydet', () => {
  it('bayrak kapalı → reddedilir, yazılmaz', async () => {
    vi.mocked(R.acikMi).mockResolvedValue(false)
    expect((await TakipService.kaydet(girdi())).error).toBeTruthy()
    expect(R.haftaEkle).not.toHaveBeenCalled()
  })
  it('mentörü değil → reddedilir', async () => {
    vi.mocked(R.mentoruMu).mockResolvedValue(false)
    expect((await TakipService.kaydet(girdi())).error).toBeTruthy()
  })
  it('ilk kayıt: özet sunucuda hesaplanır', async () => {
    const r = await TakipService.kaydet(girdi())
    expect(r).toEqual({ updatedAt: 't1' })
    expect(vi.mocked(R.haftaEkle).mock.calls[0][0]).toMatchObject({ soru: 40, dogru: 30, gorev_yapilan: 1, islendi: true, school_id: 's1', updated_by: 'u1' })
  })
  it('ilk kayıtta satır zaten varsa (başka sekme) → çakışma', async () => {
    vi.mocked(R.haftaEkle).mockResolvedValue({ cakisma: true })
    expect(await TakipService.kaydet(girdi())).toEqual({ cakisma: true })
  })
  it('güncelleme updated_at uyuşmazsa → çakışma', async () => {
    vi.mocked(R.haftaGuncelle).mockResolvedValue({ cakisma: true })
    expect(await TakipService.kaydet(girdi('2026-10-16T10:00:00.000Z'))).toEqual({ cakisma: true })
    expect(vi.mocked(R.haftaGuncelle).mock.calls[0][1]).toBe('2026-10-16T10:00:00.000Z')
  })
  it('geçersiz girdi (doğru>soru) → hata, yazılmaz', async () => {
    const g = girdi(); g.icerik.gorevler[1].dogru = 99
    expect((await TakipService.kaydet(g)).error).toMatch(/Doğru/)
    expect(R.haftaEkle).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run — FAIL** `npx vitest run tests/vitest/unit/mentor/takip-service.test.ts`

- [ ] **Step 3: Repository**

```ts
// src/domains/mentor/repositories/TakipRepository.ts
import { createClient } from '@/src/infrastructure/supabase/server'
import type { Json } from '@/src/infrastructure/supabase/database.types'
import type { Ozet } from '../takip/takipMath'

type HaftaSatiri = { school_id: string; student_id: string; hafta_basi: string; seviye: number; soru_hedefi: number; icerik: Json; gorusme: Json; updated_by: string } & Ozet

export const TakipRepository = {
  async acikMi(): Promise<boolean> {
    const db = await createClient()
    const { data, error } = await db.rpc('mentor_takip_acik')
    if (error) throw new Error(error.message)
    return data === true
  },

  async mentoruMu(userId: string, schoolId: string, studentId: string): Promise<boolean> {
    const db = await createClient()
    const { data, error } = await db.from('mentorships').select('student_id')
      .eq('school_id', schoolId).eq('mentor_id', userId).eq('student_id', studentId).maybeSingle()
    if (error) throw new Error(error.message)
    return !!data
  },

  async ogrenci(schoolId: string, studentId: string) {
    const db = await createClient()
    const { data, error } = await db.from('students').select('id, full_name, class_id, classes(name, grade)')
      .eq('id', studentId).eq('school_id', schoolId).is('deleted_at', null).maybeSingle()
    if (error) throw new Error(error.message)
    return data
  },

  async hafta(schoolId: string, studentId: string, hafta: string) {
    const db = await createClient()
    const { data, error } = await db.from('mentor_haftalari').select('*')
      .eq('school_id', schoolId).eq('student_id', studentId).eq('hafta_basi', hafta).maybeSingle()
    if (error) throw new Error(error.message)
    return data
  },

  async oncekiHafta(schoolId: string, studentId: string, hafta: string) {
    const db = await createClient()
    const { data, error } = await db.from('mentor_haftalari').select('*')
      .eq('school_id', schoolId).eq('student_id', studentId).lt('hafta_basi', hafta)
      .order('hafta_basi', { ascending: false }).limit(1).maybeSingle()
    if (error) throw new Error(error.message)
    return data
  },

  /** Satır varsa (başka sekme önce yazdı) çakışma döner — unique (student_id, hafta_basi). */
  async haftaEkle(s: HaftaSatiri): Promise<{ updatedAt?: string; cakisma?: boolean }> {
    const db = await createClient()
    const { data, error } = await db.from('mentor_haftalari').insert(s).select('updated_at').single()
    if (error?.code === '23505') return { cakisma: true }
    if (error) throw new Error(error.message)
    return { updatedAt: data.updated_at }
  },

  /** İyimser kilit: yalnız son bilinen updated_at eşleşirse yazar; 0 satır = çakışma. */
  async haftaGuncelle(s: HaftaSatiri, sonBilinen: string): Promise<{ updatedAt?: string; cakisma?: boolean }> {
    const db = await createClient()
    const { data, error } = await db.from('mentor_haftalari')
      .update({ ...s, updated_at: new Date().toISOString() })
      .eq('school_id', s.school_id).eq('student_id', s.student_id).eq('hafta_basi', s.hafta_basi).eq('updated_at', sonBilinen)
      .select('updated_at')
    if (error) throw new Error(error.message)
    return data.length ? { updatedAt: data[0].updated_at } : { cakisma: true }
  },

  async kitaplar(schoolId: string, studentId: string) {
    const db = await createClient()
    const { data, error } = await db.from('mentor_kitaplari').select('id, ad, ders')
      .eq('school_id', schoolId).eq('student_id', studentId).is('deleted_at', null).order('created_at')
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async kitapEkle(schoolId: string, studentId: string, ad: string, ders: string) {
    const db = await createClient()
    return db.from('mentor_kitaplari').insert({ school_id: schoolId, student_id: studentId, ad, ders }).select('id, ad, ders').single()
  },

  async kitapSil(schoolId: string, studentId: string, kitapId: string) {
    const db = await createClient()
    return db.from('mentor_kitaplari').update({ deleted_at: new Date().toISOString() })
      .eq('id', kitapId).eq('school_id', schoolId).eq('student_id', studentId)
  },

  async konular(schoolId: string, sinif: number) {
    const db = await createClient()
    const { data, error } = await db.from('konu_listesi').select('id, ders, ad, grup')
      .eq('school_id', schoolId).eq('sinif', sinif).order('ders').order('sira').order('ad')
    if (error) throw new Error(error.message)
    return data ?? []
  },

  /** Matematik listesini okula tohumlar (idempotent: unique + ignoreDuplicates). */
  async konuTohumla(schoolId: string, userId: string, sinif: number, konular: { grup: string; ad: string }[]) {
    const db = await createClient()
    const { error } = await db.from('konu_listesi').upsert(
      konular.map((k, i) => ({ school_id: schoolId, ders: 'Matematik', sinif, ad: k.ad, grup: k.grup, sira: i, created_by: userId })),
      { onConflict: 'school_id,ders,sinif,ad', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  },

  async durumlar(schoolId: string, studentIds: string[], hafta: string) {
    const db = await createClient()
    const { data, error } = await db.from('mentor_haftalari').select('student_id, islendi, gorev_toplam, gorev_yapilan')
      .eq('school_id', schoolId).eq('hafta_basi', hafta).in('student_id', studentIds)
    if (error) throw new Error(error.message)
    return data ?? []
  },
}
```

- [ ] **Step 4: Service**

```ts
// src/domains/mentor/services/TakipService.ts
import { requireAbility } from '@/src/shared/authorization/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import { TakipRepository as R } from '../repositories/TakipRepository'
import { kaydetSchema } from '../validators/takip'
import { MATEMATIK_KONULARI } from '../takip/sablonlar'
import {
  yeniHafta, ozetHesapla, okulOdevleri, BOS_GORUSME,
  type HaftaVerisi, type Icerik, type Gorusme, type Ozet, type Seviye, type OkulOdevi,
} from '../takip/takipMath'

export type SayfaVerisi = {
  ogrenci: { id: string; ad: string; sinifAdi: string; sinif: number; classId: string }
  hafta: string
  kayit: { veri: HaftaVerisi; updatedAt: string } | null
  taslak: HaftaVerisi
  onceki: { ozet: Ozet; hedef: string } | null
  kitaplar: { id: string; ad: string; ders: string }[]
  okulOdevleri: OkulOdevi[]
  konular: { id: string; ders: string; ad: string; grup: string | null }[]
  mentorAdi: string
  okulAdi: string
}

type Satir = NonNullable<Awaited<ReturnType<typeof R.hafta>>>
const veriOf = (s: Satir): HaftaVerisi => ({
  seviye: s.seviye as Seviye, soruHedefi: s.soru_hedefi,
  icerik: s.icerik as unknown as Icerik, gorusme: { ...BOS_GORUSME, ...(s.gorusme as unknown as Partial<Gorusme>) },
})
const ozetOf = (s: Satir): Ozet => ({
  gorev_toplam: s.gorev_toplam, gorev_yapilan: s.gorev_yapilan, soru: s.soru, dogru: s.dogru, okuma_sayfa: s.okuma_sayfa, islendi: s.islendi,
})

/** Bayrak + güncel mentörlük; ikisi de sunucuda (RLS de aynısını ister). */
async function yetki(studentId: string) {
  const ab = await requireAbility()
  if (!(await R.acikMi()) || !(await R.mentoruMu(ab.userId, ab.schoolId, studentId))) return null
  return ab
}

export const TakipService = {
  acikMi: () => R.acikMi(),

  async sayfaVerisi(studentId: string, hafta: string): Promise<SayfaVerisi | null> {
    const ab = await yetki(studentId)
    if (!ab) return null
    const o = await R.ogrenci(ab.schoolId, studentId)
    if (!o) return null
    const sinifBilgi = o.classes as { name: string; grade: number } | null
    const sinif = sinifBilgi?.grade ?? 9
    const [kayit, onceki, kitaplar, profil, profile] = await Promise.all([
      R.hafta(ab.schoolId, studentId, hafta),
      R.oncekiHafta(ab.schoolId, studentId, hafta),
      R.kitaplar(ab.schoolId, studentId),
      HomeworkService.getStudentHomeworkProfile(studentId, o.class_id, { tumOdevler: true }),
      getCurrentProfile(),
    ])
    if ('error' in profil) throw new Error(profil.error)
    if (sinif in MATEMATIK_KONULARI) await R.konuTohumla(ab.schoolId, ab.userId, sinif, MATEMATIK_KONULARI[sinif as 9])
    const konular = await R.konular(ab.schoolId, sinif)
    return {
      ogrenci: { id: o.id, ad: o.full_name, sinifAdi: sinifBilgi?.name ?? '—', sinif, classId: o.class_id },
      hafta,
      kayit: kayit ? { veri: veriOf(kayit), updatedAt: kayit.updated_at } : null,
      // Kayıt yoksa taslak gösterilir; satır ilk düzenlemede oluşur (yalnız bakmak "Plan yok"u bozmaz)
      taslak: kayit ? veriOf(kayit) : yeniHafta(onceki ? veriOf(onceki) : null, sinif),
      onceki: onceki ? { ozet: ozetOf(onceki), hedef: veriOf(onceki).gorusme.hedef } : null,
      kitaplar,
      okulOdevleri: okulOdevleri(profil.homeworks, hafta),
      konular,
      mentorAdi: profile?.full_name ?? '',
      okulAdi: profile?.schools?.name ?? '',
    }
  },

  async kaydet(girdi: unknown): Promise<{ error?: string; cakisma?: boolean; updatedAt?: string }> {
    const p = kaydetSchema.safeParse(girdi)
    if (!p.success) return { error: p.error.issues[0]?.message ?? 'Geçersiz veri' }
    const g = p.data
    const ab = await yetki(g.studentId)
    if (!ab) return { error: 'Bu öğrencinin takibine erişiminiz yok.' }
    const satir = {
      school_id: ab.schoolId, student_id: g.studentId, hafta_basi: g.hafta, seviye: g.seviye, soru_hedefi: g.soruHedefi,
      icerik: g.icerik, gorusme: g.gorusme, updated_by: ab.userId, ...ozetHesapla(g.icerik),
    }
    return g.sonBilinen === null ? R.haftaEkle(satir) : R.haftaGuncelle(satir, g.sonBilinen)
  },

  async kitapEkle(studentId: string, ad: string, ders: string) {
    const ab = await yetki(studentId)
    if (!ab) return { error: 'Bu öğrencinin takibine erişiminiz yok.' }
    const { data, error } = await R.kitapEkle(ab.schoolId, studentId, ad, ders)
    return error ? { error: 'Kitap eklenemedi.' } : { kitap: data }
  },

  async kitapSil(studentId: string, kitapId: string) {
    const ab = await yetki(studentId)
    if (!ab) return { error: 'Bu öğrencinin takibine erişiminiz yok.' }
    const { error } = await R.kitapSil(ab.schoolId, studentId, kitapId)
    return error ? { error: 'Kitap silinemedi.' } : {}
  },

  async durumlar(studentIds: string[], hafta: string) {
    const ab = await requireAbility()
    if (!studentIds.length || !(await R.acikMi())) return new Map()
    const rows = await R.durumlar(ab.schoolId, studentIds, hafta)
    return new Map(rows.map(r => [r.student_id, r]))
  },
}
```

> Not: `HaftaSatiri.icerik` tipi `Json`; `g.icerik` Zod çıktısı — TS uyuşmazlığı çıkarsa `icerik: g.icerik as unknown as Json` kullan (tek nokta).

- [ ] **Step 5: Actions**

```ts
// app/actions/mentor-takip.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { UUID } from '@/src/shared/validation'
import { TakipService } from '@/src/domains/mentor/services/TakipService'
import type { ActionResult } from '@/src/shared/types/index'

/** Otomatik kayıt: revalidate YOK (her tuşta sayfa yeniden çizilmesin); liste durumu bir sonraki gezinmede tazelenir. */
export async function haftaKaydet(girdi: unknown): Promise<ActionResult<{ cakisma?: boolean; updatedAt?: string }>> {
  return TakipService.kaydet(girdi)
}

const kitapSchema = z.object({ studentId: UUID, ad: z.string().trim().min(1, 'Kitap adı boş olamaz').max(120), ders: z.string().trim().max(60) })

export async function kitapEkle(studentId: string, ad: string, ders: string): Promise<ActionResult<{ kitap?: { id: string; ad: string; ders: string } }>> {
  const p = kitapSchema.safeParse({ studentId, ad, ders })
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Geçersiz veri' }
  const r = await TakipService.kitapEkle(p.data.studentId, p.data.ad, p.data.ders)
  if (!r.error) revalidatePath(`/mentorluk/${studentId}/takip`)
  return r
}

export async function kitapSil(studentId: string, kitapId: string): Promise<ActionResult> {
  if (!UUID.safeParse(studentId).success || !UUID.safeParse(kitapId).success) return { error: 'Geçersiz ID' }
  const r = await TakipService.kitapSil(studentId, kitapId)
  if (!r.error) revalidatePath(`/mentorluk/${studentId}/takip`)
  return r
}
```

- [ ] **Step 6: Run — PASS** `npx vitest run tests/vitest/unit/mentor/takip-service.test.ts`; `npm run typecheck` temiz; `npm run test:unit` tamamı geçer.

- [ ] **Step 7: Commit + push** (`feat(mentor-takip): repository, servis (iyimser kilit), action'lar`)

---

### Task 4: Takip sayfası + Plan sekmesi + otomatik kayıt

**Files:**
- Create: `app/(dashboard)/mentorluk/[studentId]/takip/page.tsx`, `TakipIstemci.tsx`, `useOtoKayit.ts`, `PlanSekmesi.tsx`
- Modify: `app/(dashboard)/mentorluk/[studentId]/page.tsx` (bayrak açıksa "Haftalık takip" bağlantısı)

**Interfaces:**
- Consumes: `TakipService.sayfaVerisi`, `haftaKaydet`, `kitapEkle`, `kitapSil`; Task 1 fonksiyonları; `weekStartOf`, `shiftWeek` (`src/domains/studyPlan/planMath.ts`), `haftaEtiketi` (bultenMath).
- Produces: `useOtoKayit(veri: HaftaVerisi, kaydet: (v: HaftaVerisi, sonBilinen: string | null) => Promise<{ error?: string; cakisma?: boolean; updatedAt?: string }>, ilkUpdatedAt: string | null) → { durum: KayitDurumu; anlik: () => void; bosalt: () => void }` — `anlik()` bir SONRAKİ değişikliği gecikmesiz yazdırır (kutu/seçim); `bosalt()` bekleyeni hemen yazar (sekme/hafta değişimi, Tekrar dene), `type KayitDurumu = { tur: 'bos' } | { tur: 'kaydediliyor' } | { tur: 'kaydedildi'; saat: string } | { tur: 'hata'; mesaj: string } | { tur: 'cakisma' }`; `TakipIstemci` props `{ v: SayfaVerisi; sekme: 'plan' | 'sonuc' | 'veli' | 'dosya' }`; sekme bileşenlerinin ortak props'u `SekmeProps = { v: SayfaVerisi; veri: HaftaVerisi; degistir: (f: (h: HaftaVerisi) => HaftaVerisi, hemen?: boolean) => void }`.

- [ ] **Step 1: Sunucu sayfası**

```tsx
// app/(dashboard)/mentorluk/[studentId]/takip/page.tsx
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { todayLocalISO } from '@/src/shared/date'
import { weekStartOf } from '@/src/domains/studyPlan/planMath'
import { pazartesiMi } from '@/src/domains/mentor/lib/bultenMath'
import { TakipService } from '@/src/domains/mentor/services/TakipService'
import TakipIstemci from './TakipIstemci'

export const metadata = { title: 'Haftalık Takip' }
const SEKMELER = ['plan', 'sonuc', 'veli', 'dosya'] as const

export default async function TakipPage({ params, searchParams }: {
  params: Promise<{ studentId: string }>; searchParams: Promise<{ hafta?: string; sekme?: string }>
}) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isTeachingRole(profile.role)) redirect('/anasayfa')
  const { studentId } = await params
  const sp = await searchParams
  const hafta = sp.hafta && pazartesiMi(sp.hafta) ? sp.hafta : weekStartOf(todayLocalISO())
  const v = await TakipService.sayfaVerisi(studentId, hafta)
  if (!v) notFound() // bayrak kapalı / mentörü değil / öğrenci yok — hepsi aynı 404 (varlık sızdırma yok)
  const sekme = SEKMELER.find(s => s === sp.sekme) ?? 'plan'
  return <TakipIstemci key={`${studentId}-${hafta}`} v={v} sekme={sekme} />
}
```

- [ ] **Step 2: `useOtoKayit.ts`**

```ts
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { HaftaVerisi } from '@/src/domains/mentor/takip/takipMath'

export type KayitDurumu = { tur: 'bos' } | { tur: 'kaydediliyor' } | { tur: 'kaydedildi'; saat: string } | { tur: 'hata'; mesaj: string } | { tur: 'cakisma' }
type Kaydet = (v: HaftaVerisi, sonBilinen: string | null) => Promise<{ error?: string; cakisma?: boolean; updatedAt?: string }>

const GECIKME = 800

/** Gecikmeli kayıt; tek seferde tek istek (sıradaki son hali yazar). Kaydedilmemiş değişiklikte çıkış uyarısı. */
export function useOtoKayit(veri: HaftaVerisi, kaydet: Kaydet, ilkUpdatedAt: string | null) {
  const [durum, setDurum] = useState<KayitDurumu>({ tur: 'bos' })
  const sonBilinen = useRef(ilkUpdatedAt)
  const bekleyen = useRef<HaftaVerisi | null>(null)
  const calisiyor = useRef(false)
  const zaman = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ilk = useRef(true)
  const anlikRef = useRef(false)

  const yaz = useCallback(async () => {
    if (calisiyor.current || !bekleyen.current) return
    calisiyor.current = true
    const v = bekleyen.current
    bekleyen.current = null
    setDurum({ tur: 'kaydediliyor' })
    try {
      const r = await kaydet(v, sonBilinen.current)
      if (r.cakisma) { setDurum({ tur: 'cakisma' }); return }
      if (r.error || !r.updatedAt) { bekleyen.current ??= v; setDurum({ tur: 'hata', mesaj: r.error ?? 'Kaydedilemedi' }); return }
      sonBilinen.current = r.updatedAt
      setDurum({ tur: 'kaydedildi', saat: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) })
    } catch {
      bekleyen.current ??= v
      setDurum({ tur: 'hata', mesaj: 'Bağlantı hatası' })
    } finally {
      calisiyor.current = false
    }
    if (bekleyen.current && !zaman.current) void yaz()
  }, [kaydet])

  useEffect(() => {
    if (ilk.current) { ilk.current = false; return } // açılış = değişiklik değil (satır yaratma)
    bekleyen.current = veri
    if (zaman.current) clearTimeout(zaman.current)
    // anlik setVeri'den ÖNCE işaretlenir; effect yeni veri commit edildikten sonra çalıştığından doğru hali yazar
    const gecikme = anlikRef.current ? 0 : GECIKME
    anlikRef.current = false
    zaman.current = setTimeout(() => { zaman.current = null; void yaz() }, gecikme)
  }, [veri, yaz])

  useEffect(() => {
    const uyar = (e: BeforeUnloadEvent) => { if (bekleyen.current || calisiyor.current) e.preventDefault() }
    window.addEventListener('beforeunload', uyar)
    return () => window.removeEventListener('beforeunload', uyar)
  }, [])

  const bosalt = useCallback(() => {
    if (zaman.current) { clearTimeout(zaman.current); zaman.current = null }
    void yaz()
  }, [yaz])
  const anlik = useCallback(() => { anlikRef.current = true }, [])

  return { durum, anlik, bosalt }
}
```

- [ ] **Step 3: `TakipIstemci.tsx`** (sekmeler, hafta seçici, kayıt durumu). Aşama 1'de yalnız Plan sekmesi var; Task 6/8/9 `SEKME_ADI`'ye satır + import + render satırı ekler.

```tsx
'use client'
import Link from 'next/link'
import { useCallback, useState } from 'react'
import { haftaKaydet } from '@/app/actions/mentor-takip'
import { shiftWeek, weekStartOf } from '@/src/domains/studyPlan/planMath'
import { haftaEtiketi } from '@/src/domains/mentor/lib/bultenMath'
import { todayLocalISO } from '@/src/shared/date'
import type { HaftaVerisi } from '@/src/domains/mentor/takip/takipMath'
import type { SayfaVerisi } from '@/src/domains/mentor/services/TakipService'
import { useOtoKayit, type KayitDurumu } from './useOtoKayit'
import PlanSekmesi from './PlanSekmesi'

export type Sekme = 'plan' | 'sonuc' | 'veli' | 'dosya'
export type SekmeProps = { v: SayfaVerisi; veri: HaftaVerisi; degistir: (f: (h: HaftaVerisi) => HaftaVerisi, hemen?: boolean) => void }
// Task 6: sonuc: 'Sonuç' · Task 8: veli: 'Veli mesajı' · Task 9: dosya: 'Öğrenci dosyası'
const SEKME_ADI: Partial<Record<Sekme, string>> = { plan: 'Plan' }

function Durum({ d, tekrar }: { d: KayitDurumu; tekrar: () => void }) {
  if (d.tur === 'kaydediliyor') return <span role="status" className="text-sm text-gray-500 dark:text-slate-400">Kaydediliyor…</span>
  if (d.tur === 'kaydedildi') return <span role="status" className="text-sm text-green-700 dark:text-green-400">Kaydedildi · {d.saat}</span>
  if (d.tur === 'cakisma') return <span role="alert" className="text-sm text-red-700 dark:text-red-400">Başka bir ekranda değişti — <button className="underline" onClick={() => location.reload()}>yenileyin</button></span>
  if (d.tur === 'hata') return <span role="alert" className="text-sm text-red-700 dark:text-red-400">Kaydedilemedi · <button className="underline" onClick={tekrar}>Tekrar dene</button></span>
  return null
}

/** key = öğrenci+hafta: sekme değişince bileşen kalır, yerel `veri` korunur; hafta değişince sıfırdan açılır. */
export default function TakipIstemci({ v, sekme: istenen }: { v: SayfaVerisi; sekme: Sekme }) {
  const sekme: Sekme = istenen in SEKME_ADI ? istenen : 'plan'
  const [veri, setVeri] = useState<HaftaVerisi>(v.taslak)
  const kaydet = useCallback((h: HaftaVerisi, sonBilinen: string | null) =>
    haftaKaydet({ studentId: v.ogrenci.id, hafta: v.hafta, ...h, sonBilinen }), [v.ogrenci.id, v.hafta])
  const { durum, anlik, bosalt } = useOtoKayit(veri, kaydet, v.kayit?.updatedAt ?? null)
  const degistir: SekmeProps['degistir'] = (f, hemen) => { if (hemen) anlik(); setVeri(f) }
  const url = (hafta: string, s: Sekme = sekme) => `/mentorluk/${v.ogrenci.id}/takip?hafta=${hafta}&sekme=${s}`
  const props: SekmeProps = { v, veri, degistir }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <Link href={`/mentorluk/${v.ogrenci.id}`} onClick={bosalt} className="text-sm text-gray-500 dark:text-slate-400 hover:text-blue-600">← {v.ogrenci.ad}</Link>
      <div className="mt-2 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Haftalık Takip</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">{v.ogrenci.ad} · {v.ogrenci.sinifAdi}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link aria-label="Önceki hafta" onClick={bosalt} href={url(shiftWeek(v.hafta, -1))} className="px-2 py-1 rounded border border-gray-300 dark:border-slate-600">‹</Link>
          <span className="text-sm font-medium tabular-nums">{haftaEtiketi(v.hafta)}</span>
          <Link aria-label="Sonraki hafta" onClick={bosalt} href={url(shiftWeek(v.hafta, 1))} className="px-2 py-1 rounded border border-gray-300 dark:border-slate-600">›</Link>
          <Link onClick={bosalt} href={url(weekStartOf(todayLocalISO()))} className="text-sm text-blue-600 hover:underline">Bu hafta</Link>
        </div>
        <Durum d={durum} tekrar={bosalt} />
      </div>
      {Object.keys(SEKME_ADI).length > 1 && (
        <nav aria-label="Takip sekmeleri" className="flex gap-1 border-b border-gray-200 dark:border-slate-700 mb-5 overflow-x-auto">
          {(Object.keys(SEKME_ADI) as Sekme[]).map(s => (
            <Link key={s} href={url(v.hafta, s)} onClick={bosalt} aria-current={s === sekme ? 'page' : undefined}
              className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 ${s === sekme ? 'border-blue-600 text-blue-700 dark:text-blue-400 font-semibold' : 'border-transparent text-gray-600 dark:text-slate-400'}`}>
              {SEKME_ADI[s]}
            </Link>
          ))}
        </nav>
      )}
      {sekme === 'plan' && <PlanSekmesi {...props} />}
    </div>
  )
}
```

Sunucu `page.tsx`: `SEKMELER` sabiti kalır; `import type { Sekme } from './TakipIstemci'` (yalnız tip, sunucuda güvenli) ve `const sekme: Sekme = SEKMELER.find(s => s === sp.sekme) ?? 'plan'`.

- [ ] **Step 4: `PlanSekmesi.tsx`**

```tsx
'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { kitapEkle, kitapSil } from '@/app/actions/mentor-takip'
import { GUNLER, SEVIYE_ADI, miktarYaz, varsayilanHedef, type Gorev, type Seviye } from '@/src/domains/mentor/takip/takipMath'
import { sinifSablonu } from '@/src/domains/mentor/takip/sablonlar'
import { dersKisa } from '@/src/domains/mentor/lib/bultenMath'
import type { SekmeProps } from './TakipIstemci'

const kutu = 'w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-base md:text-sm'
const yeniId = () => crypto.randomUUID()

export default function PlanSekmesi({ v, veri, degistir }: SekmeProps) {
  const [kitaplar, setKitaplar] = useState(v.kitaplar)
  const [kitapAdi, setKitapAdi] = useState(''); const [kitapDers, setKitapDers] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [, basla] = useTransition()
  const gorev = (id: string, p: Partial<Gorev>, hemen = false) =>
    degistir(h => ({ ...h, icerik: { ...h.icerik, gorevler: h.icerik.gorevler.map(g => g.id === id ? { ...g, ...p } : g) } }), hemen)
  const konuListesi = (ders: string | null) => v.konular.filter(k => k.ders === (ders ?? ''))

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end gap-4">
        <fieldset>
          <legend className="text-sm font-medium mb-1">Seviye</legend>
          <div className="flex gap-1">
            {SEVIYE_ADI.map((ad, i) => (
              <button key={ad} type="button" aria-pressed={veri.seviye === i}
                onClick={() => degistir(h => ({ ...h, seviye: i as Seviye, soruHedefi: varsayilanHedef(v.ogrenci.sinif, i as Seviye) }), true)}
                className={`px-3 py-1.5 rounded border text-sm ${veri.seviye === i ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-slate-600'}`}>{ad}</button>
            ))}
          </div>
        </fieldset>
        <label className="text-sm">Soru hedefi
          <input type="number" min={0} inputMode="numeric" className={`${kutu} w-24 block`} value={veri.soruHedefi}
            onChange={e => degistir(h => ({ ...h, soruHedefi: Math.max(0, Math.trunc(Number(e.target.value) || 0)) }))} />
        </label>
        <button type="button" className="text-sm text-gray-600 dark:text-slate-400 underline"
          onClick={() => { if (confirm('Program sınıf şablonuna dönsün mü? Bu haftaki görevler silinir.')) degistir(h => ({ ...h, icerik: { ...h.icerik, gorevler: sinifSablonu(v.ogrenci.sinif) } }), true) }}>
          Sınıf şablonuna dön
        </button>
        <Link href={`/mentorluk/${v.ogrenci.id}/takip/kagit?hafta=${v.hafta}`} className="ml-auto px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium">Kâğıdı yazdır</Link>
      </section>

      <section aria-label="Program">
        {GUNLER.map((gunAdi, gun) => {
          const satirlar = veri.icerik.gorevler.filter(g => g.gun === gun)
          return (
            <div key={gunAdi} className="mb-3">
              <h3 className="text-sm font-semibold mb-1">{gunAdi}</h3>
              {satirlar.map(g => (
                <div key={g.id} className={`grid grid-cols-12 gap-2 items-center py-1 ${g.ders === 'Matematik' ? 'font-semibold' : ''}`}>
                  <input aria-label="Görev" className={`${kutu} col-span-12 md:col-span-4`} value={g.ad} onChange={e => gorev(g.id, { ad: e.target.value })} />
                  <span className="col-span-3 md:col-span-1 text-sm tabular-nums">{miktarYaz(g, veri.seviye)}</span>
                  <input aria-label="Miktar" type="number" min={1} className={`${kutu} col-span-3 md:col-span-1`} value={g.miktar ?? ''}
                    onChange={e => gorev(g.id, { miktar: e.target.value ? Math.max(1, Math.trunc(Number(e.target.value))) : null })} />
                  <select aria-label="Birim" className={`${kutu} col-span-3 md:col-span-1`} value={g.birim} onChange={e => gorev(g.id, { birim: e.target.value as Gorev['birim'] }, true)}>
                    <option value="dk">dk</option><option value="soru">soru</option><option value="serbest">serbest</option>
                  </select>
                  <input aria-label="Konu" list={`konu-${g.id}`} className={`${kutu} col-span-6 md:col-span-2`} value={g.konu} placeholder="Konu" onChange={e => gorev(g.id, { konu: e.target.value })} />
                  <datalist id={`konu-${g.id}`}>{konuListesi(g.ders).map(k => <option key={k.id} value={k.ad} />)}</datalist>
                  <input aria-label="Sayfa" className={`${kutu} col-span-3 md:col-span-1`} value={g.sayfa} placeholder="Sayfa" onChange={e => gorev(g.id, { sayfa: e.target.value })} />
                  <label className="col-span-2 md:col-span-1 text-xs flex items-center gap-1">
                    <input type="checkbox" checked={g.soruSatiri} onChange={e => gorev(g.id, { soruSatiri: e.target.checked }, true)} /> Soru
                  </label>
                  <button type="button" aria-label={`${g.ad} görevini sil`} className="col-span-1 text-red-700 dark:text-red-400 text-sm"
                    onClick={() => { if (confirm(`"${g.ad}" silinsin mi?`)) degistir(h => ({ ...h, icerik: { ...h.icerik, gorevler: h.icerik.gorevler.filter(x => x.id !== g.id) } }), true) }}>Sil</button>
                </div>
              ))}
              <button type="button" className="text-sm text-blue-600 hover:underline"
                onClick={() => degistir(h => ({ ...h, icerik: { ...h.icerik, gorevler: [...h.icerik.gorevler, { id: yeniId(), gun, ad: 'Yeni görev', ders: null, miktar: 30, birim: 'dk', soruSatiri: false, konu: '', sayfa: '', yapti: false, soru: null, dogru: null }] } }), true)}>
                + {gunAdi} görevi ekle
              </button>
            </div>
          )
        })}
      </section>

      <section aria-label="Okul ödevleri">
        <h2 className="text-base font-semibold mb-2">Bu haftanın okul ödevleri</h2>
        {v.okulOdevleri.length === 0
          ? <p className="text-sm text-gray-500 dark:text-slate-400">Bu hafta son teslimli okul ödevi yok.</p>
          : <ul className="text-sm space-y-1">{v.okulOdevleri.map(o => <li key={o.id}>{dersKisa(o.subject)} — {o.title} <span className="text-gray-500 dark:text-slate-400">({o.due_date.slice(8, 10)}.{o.due_date.slice(5, 7)})</span></li>)}</ul>}
      </section>

      <section aria-label="Mentör ödevleri">
        <h2 className="text-base font-semibold mb-2">Mentör ödevleri</h2>
        {veri.icerik.mentorOdevleri.map(m => (
          <div key={m.id} className="grid grid-cols-12 gap-2 items-center py-1">
            <select aria-label="Kitap" className={`${kutu} col-span-12 md:col-span-4`} value={m.kitapId ?? ''}
              onChange={e => { const k = kitaplar.find(x => x.id === e.target.value); if (k) degistir(h => ({ ...h, icerik: { ...h.icerik, mentorOdevleri: h.icerik.mentorOdevleri.map(x => x.id === m.id ? { ...x, kitapId: k.id, kitapAdi: k.ad } : x) } }), true) }}>
              {!kitaplar.some(k => k.id === m.kitapId) && <option value={m.kitapId ?? ''}>{m.kitapAdi}</option>}
              {kitaplar.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
            </select>
            <input aria-label="Konu" className={`${kutu} col-span-6 md:col-span-4`} value={m.konu} placeholder="Konu"
              onChange={e => degistir(h => ({ ...h, icerik: { ...h.icerik, mentorOdevleri: h.icerik.mentorOdevleri.map(x => x.id === m.id ? { ...x, konu: e.target.value } : x) } }))} />
            <input aria-label="Sayfalar" className={`${kutu} col-span-4 md:col-span-3`} value={m.sayfalar} placeholder="s. 45–52"
              onChange={e => degistir(h => ({ ...h, icerik: { ...h.icerik, mentorOdevleri: h.icerik.mentorOdevleri.map(x => x.id === m.id ? { ...x, sayfalar: e.target.value } : x) } }))} />
            <button type="button" aria-label="Mentör ödevini sil" className="col-span-2 md:col-span-1 text-red-700 dark:text-red-400 text-sm"
              onClick={() => { if (confirm('Bu ödev silinsin mi?')) degistir(h => ({ ...h, icerik: { ...h.icerik, mentorOdevleri: h.icerik.mentorOdevleri.filter(x => x.id !== m.id) } }), true) }}>Sil</button>
          </div>
        ))}
        {kitaplar.length > 0 && (
          <button type="button" className="text-sm text-blue-600 hover:underline"
            onClick={() => degistir(h => ({ ...h, icerik: { ...h.icerik, mentorOdevleri: [...h.icerik.mentorOdevleri, { id: yeniId(), kitapId: kitaplar[0].id, kitapAdi: kitaplar[0].ad, konu: '', sayfalar: '', yapti: false }] } }), true)}>
            + Mentör ödevi ekle
          </button>
        )}
        <form className="mt-3 flex flex-wrap gap-2 items-end" onSubmit={e => {
          e.preventDefault()
          basla(async () => {
            const r = await kitapEkle(v.ogrenci.id, kitapAdi, kitapDers)
            if (r.error || !r.kitap) { setHata(r.error ?? 'Kitap eklenemedi.'); return }
            setKitaplar(k => [...k, r.kitap!]); setKitapAdi(''); setKitapDers(''); setHata(null)
          })
        }}>
          <label className="text-sm">Kitap adı<input className={`${kutu} block w-56`} value={kitapAdi} onChange={e => setKitapAdi(e.target.value)} required /></label>
          <label className="text-sm">Ders<input className={`${kutu} block w-32`} value={kitapDers} onChange={e => setKitapDers(e.target.value)} /></label>
          <button className="px-3 py-1.5 rounded border border-gray-300 dark:border-slate-600 text-sm">Kitap ekle</button>
          {hata && <span role="alert" className="text-sm text-red-700 dark:text-red-400">{hata}</span>}
        </form>
        {kitaplar.length > 0 && (
          <ul className="mt-2 text-sm flex flex-wrap gap-2">
            {kitaplar.map(k => (
              <li key={k.id} className="px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800">{k.ad}{k.ders && ` · ${k.ders}`}
                <button type="button" aria-label={`${k.ad} kitabını sil`} className="ml-1 text-red-700 dark:text-red-400"
                  onClick={() => { if (confirm(`"${k.ad}" silinsin mi? Eski haftalarda adı görünmeye devam eder.`)) basla(async () => { const r = await kitapSil(v.ogrenci.id, k.id); if (!r.error) setKitaplar(x => x.filter(y => y.id !== k.id)); else setHata(r.error) }) }}>×</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Okuma">
        <h2 className="text-base font-semibold mb-2">Okuma</h2>
        <label className="text-sm">Okuduğu kitap
          <input className={`${kutu} block max-w-md`} value={veri.icerik.okuma?.kitap ?? ''} placeholder="Kitap adı"
            onChange={e => degistir(h => ({ ...h, icerik: { ...h.icerik, okuma: e.target.value.trim() ? { kitap: e.target.value, sayfa: h.icerik.okuma?.sayfa ?? null, bitti: h.icerik.okuma?.bitti ?? false } : null } }))} />
        </label>
      </section>

      <section aria-label="Hafta içi düzen">
        <label className="text-sm">Hafta içi düzen (kâğıda basılır)
          <input className={`${kutu} block`} value={veri.icerik.duzen} onChange={e => degistir(h => ({ ...h, icerik: { ...h.icerik, duzen: e.target.value } }))} />
        </label>
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Giriş bağlantısı** — `app/(dashboard)/mentorluk/[studentId]/page.tsx`: `TakipService` import et; `const takipAcik = !salt && await TakipService.acikMi()`; başlık düğmelerinin içine (`Yazdır` Link'inden önce):

```tsx
{takipAcik && (
  <Link href={`/mentorluk/${studentId}/takip`} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700">Haftalık takip</Link>
)}
```

- [ ] **Step 6: Elle doğrula** — `npm run typecheck` temiz; `npm run dev`; mentör öğrencisinin sayfasında "Haftalık takip" → Plan; seviye değişince süreler değişir; bir görev adını değiştir → "Kaydedildi · ss:dd"; yenile → değişiklik yerinde. SQL: `select hafta_basi, seviye, gorev_toplam from mentor_haftalari order by updated_at desc limit 1;` → 1 satır.

- [ ] **Step 7: Commit + push** (`feat(mentor-takip): takip sayfası, Plan sekmesi, otomatik kayıt`)

---

### Task 5: Öğrenci kâğıdı çıktısı + aşama 1 e2e

**Files:**
- Create: `app/(dashboard)/mentorluk/[studentId]/takip/OgrenciKagidi.tsx`, `app/(dashboard)/mentorluk/[studentId]/takip/kagit/page.tsx`
- Test: `tests/playwright/e2e/mentor-takip.spec.ts`

**Interfaces:**
- Consumes: `TakipService.sayfaVerisi`, Task 1 fonksiyonları.
- Produces: `OgrenciKagidi({ v, veri }: { v: SayfaVerisi; veri: HaftaVerisi })` (Task 11 toplu yazdırma da kullanır).

- [ ] **Step 1: Failing e2e** — `tests/playwright/e2e/mentor-takip.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const AUTH = (r: string) => path.join(process.cwd(), 'tests/playwright/.auth', `${r}.json`)
const kullanici = async (email: string) => {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 })
  const id = data.users.find(u => u.email === email)!.id
  const { data: p } = await db.from('profiles').select('id, school_id').eq('id', id).single()
  return p!
}
const OGRETMEN = process.env.TEST_EMAIL_OGRETMEN ?? 'test_ogretmen@test.example'

let ogrId = '', mentor = { id: '', school_id: '' }

test.describe.configure({ mode: 'serial' })
test.use({ storageState: AUTH('ogretmen') })

test.beforeAll(async () => {
  mentor = await kullanici(OGRETMEN)
  // Mentörü olmayan bir öğrenci seç, mentörlüğe ekle, bayrağı aç
  const { data: alinan } = await db.from('mentorships').select('student_id').eq('school_id', mentor.school_id)
  const dolu = new Set((alinan ?? []).map(r => r.student_id))
  const { data: ogr } = await db.from('students').select('id').eq('school_id', mentor.school_id).is('deleted_at', null).limit(200)
  ogrId = ogr!.find(o => !dolu.has(o.id))!.id
  await db.from('mentorships').insert({ school_id: mentor.school_id, mentor_id: mentor.id, student_id: ogrId, assigned_by: mentor.id })
  await db.from('mentor_takip_kullanicilari').upsert({ user_id: mentor.id, school_id: mentor.school_id })
})

test.afterAll(async () => {
  await db.from('mentor_haftalari').delete().eq('student_id', ogrId)
  await db.from('mentor_kitaplari').delete().eq('student_id', ogrId)
  await db.from('ogrenci_konu_durumu').delete().eq('student_id', ogrId)
  await db.from('mentorships').delete().eq('student_id', ogrId).eq('mentor_id', mentor.id)
  await db.from('mentor_takip_kullanicilari').delete().eq('user_id', mentor.id)
})

const kaydedildi = (page: Page) => expect(page.getByRole('status').filter({ hasText: 'Kaydedildi' })).toBeVisible({ timeout: 15_000 })

test('yalnız bakmak satır yaratmaz; düzenleme kaydedilir ve yenilemede kalır', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19`)
  await expect(page.getByRole('heading', { name: 'Haftalık Takip' })).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(1500)
  expect((await db.from('mentor_haftalari').select('id').eq('student_id', ogrId)).data).toHaveLength(0)

  await page.getByRole('button', { name: 'Normal' }).click()
  await kaydedildi(page)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true')
  const { data } = await db.from('mentor_haftalari').select('seviye, soru_hedefi').eq('student_id', ogrId).single()
  expect(data).toEqual({ seviye: 1, soru_hedefi: expect.any(Number) })
})

test('kâğıt: öğrenci adı, program, filigran; @page kenarı 0', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip/kagit?hafta=2026-10-19`)
  await expect(page.getByRole('heading', { name: 'Haftalık Çalışma Planı' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('table', { name: 'Program' })).toBeVisible()
  await expect(page.locator('.filigran img')).toHaveCount(1)
  const kenar = await page.evaluate(() => [...document.styleSheets].flatMap(s => { try { return [...s.cssRules] } catch { return [] } })
    .filter((r): r is CSSPageRule => r instanceof CSSPageRule && !!r.style.margin).map(r => r.style.margin))
  expect(kenar).toEqual(['0px'])
})

test('silinen kitap eski haftada adıyla görünür', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19`)
  await page.getByLabel('Kitap adı').fill('E2E Soru Bankası')
  await page.getByRole('button', { name: 'Kitap ekle' }).click()
  await page.getByRole('button', { name: '+ Mentör ödevi ekle' }).click()
  await kaydedildi(page)
  page.on('dialog', d => d.accept())
  await page.getByRole('button', { name: 'E2E Soru Bankası kitabını sil' }).click()
  await page.reload()
  await expect(page.getByLabel('Kitap').first()).toHaveValue(/.+/)
  await expect(page.getByLabel('Kitap').first().locator('option:checked')).toHaveText('E2E Soru Bankası')
})
```

> `confirm()` diyaloğu: proje kuralı alert/confirm'den kaçınır ama bu, uygulamanın kendi silme onayı; testte `page.on('dialog', d => d.accept())` ile kabul edilir.

- [ ] **Step 2: Run — FAIL** `npx playwright test mentor-takip` (kâğıt sayfası yok).

- [ ] **Step 3: `OgrenciKagidi.tsx`**

```tsx
import { GUNLER, SEVIYE_ADI, miktarYaz, type HaftaVerisi } from '@/src/domains/mentor/takip/takipMath'
import { haftaEtiketi, dersKisa } from '@/src/domains/mentor/lib/bultenMath'
import type { SayfaVerisi } from '@/src/domains/mentor/services/TakipService'

const th = 'border border-gray-400 px-1.5 py-1 text-left font-semibold'
const td = 'border border-gray-400 px-1.5 py-1 align-top'

/** A4 dikey öğrenci kâğıdı. Matematik satırı kalın + gri zemin (siyah-beyaz baskıda okunur). */
export default function OgrenciKagidi({ v, veri }: { v: SayfaVerisi; veri: HaftaVerisi }) {
  return (
    <article className="text-[11px] leading-snug text-black bg-white">
      <header className="flex justify-between items-start mb-2">
        <div>
          <p className="text-xs">{v.okulAdi}</p>
          <h1 className="text-base font-bold">Haftalık Çalışma Planı</h1>
          <p>{v.ogrenci.ad} · {v.ogrenci.sinifAdi}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{haftaEtiketi(v.hafta)}</p>
          <p>Seviye: {SEVIYE_ADI[veri.seviye]} · Soru hedefi: {veri.soruHedefi}</p>
        </div>
      </header>
      {v.onceki?.hedef && <p className="border-2 border-black p-1.5 mb-2"><b>Bu haftaki hedefim:</b> {v.onceki.hedef}</p>}
      {veri.icerik.duzen && <p className="mb-2"><b>Hafta içi düzen:</b> {veri.icerik.duzen}</p>}

      <table aria-label="Program" className="w-full border-collapse mb-2">
        <thead><tr>{['Gün', 'Görev', 'Süre', 'Konu', 'Sayfa', 'Soru', 'Doğru', '✓'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>
          {veri.icerik.gorevler.slice().sort((a, b) => a.gun - b.gun).map(g => (
            <tr key={g.id} className={`break-inside-avoid ${g.ders === 'Matematik' ? 'font-bold bg-gray-100' : ''}`}>
              <td className={td}>{GUNLER[g.gun]}</td>
              <td className={td}>{g.ad}</td>
              <td className={`${td} whitespace-nowrap`}>{miktarYaz(g, veri.seviye)}</td>
              <td className={td}>{g.konu}</td>
              <td className={td}>{g.sayfa}</td>
              <td className={`${td} w-10 ${g.soruSatiri ? '' : 'bg-gray-300'}`} />
              <td className={`${td} w-10 ${g.soruSatiri ? '' : 'bg-gray-300'}`} />
              <td className={`${td} w-6`} />
            </tr>
          ))}
        </tbody>
      </table>

      {v.okulOdevleri.length > 0 && (
        <table aria-label="Okul ödevleri" className="w-full border-collapse mb-2">
          <thead><tr>{['Ders', 'Okul ödevi', 'Son teslim', '✓'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{v.okulOdevleri.map(o => (
            <tr key={o.id} className="break-inside-avoid"><td className={td}>{dersKisa(o.subject)}</td><td className={td}>{o.title}</td>
              <td className={td}>{o.due_date.slice(8, 10)}.{o.due_date.slice(5, 7)}</td><td className={`${td} w-6`} /></tr>
          ))}</tbody>
        </table>
      )}

      {veri.icerik.mentorOdevleri.length > 0 && (
        <table aria-label="Mentör ödevleri" className="w-full border-collapse mb-2">
          <thead><tr>{['Kitap', 'Konu', 'Sayfalar', '✓'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{veri.icerik.mentorOdevleri.map(m => (
            <tr key={m.id} className="break-inside-avoid"><td className={td}>{m.kitapAdi}</td><td className={td}>{m.konu}</td><td className={td}>{m.sayfalar}</td><td className={`${td} w-6`} /></tr>
          ))}</tbody>
        </table>
      )}

      {veri.icerik.okuma && (
        <table aria-label="Okuma" className="w-full border-collapse mb-2">
          <thead><tr><th className={th}>Okuma: {veri.icerik.okuma.kitap}</th>{GUNLER.map(g => <th key={g} className={`${th} w-12 text-center`}>{g}</th>)}</tr></thead>
          <tbody><tr><td className={td}>Okuduğum sayfa</td>{GUNLER.map(g => <td key={g} className={`${td} h-6`} />)}</tr></tbody>
        </table>
      )}

      <footer className="grid grid-cols-2 gap-4 mt-3 break-inside-avoid">
        <div className="border border-gray-400 h-14 p-1"><b>Öğretmen notu</b></div>
        <div className="border border-gray-400 h-14 p-1"><b>Veli imzası</b></div>
      </footer>
    </article>
  )
}
```

- [ ] **Step 4: `kagit/page.tsx`**

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { todayLocalISO } from '@/src/shared/date'
import { weekStartOf } from '@/src/domains/studyPlan/planMath'
import { pazartesiMi } from '@/src/domains/mentor/lib/bultenMath'
import { TakipService } from '@/src/domains/mentor/services/TakipService'
import PrintButton from '@/components/PrintButton'
import OgrenciKagidi from '../OgrenciKagidi'

export const metadata = { title: 'Haftalık Çalışma Planı' }

export default async function KagitPage({ params, searchParams }: { params: Promise<{ studentId: string }>; searchParams: Promise<{ hafta?: string }> }) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isTeachingRole(profile.role)) redirect('/anasayfa')
  const { studentId } = await params
  const h = (await searchParams).hafta
  const v = await TakipService.sayfaVerisi(studentId, h && pazartesiMi(h) ? h : weekStartOf(todayLocalISO()))
  if (!v) notFound()
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto print:p-0 print:max-w-none">
      <div className="flex justify-between items-center mb-4 print:hidden">
        <Link href={`/mentorluk/${studentId}/takip?hafta=${v.hafta}`} className="text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600">← Plana dön</Link>
        <PrintButton />
      </div>
      <OgrenciKagidi v={v} veri={v.taslak} />
    </div>
  )
}
```

- [ ] **Step 5: Run — PASS** `npx playwright test mentor-takip`; ayrıca `npx playwright test baski-kenar mentorluk` (regresyon yok).
- [ ] **Step 6: Görsel kontrol** — kâğıdı Playwright `page.pdf({ format: 'A4', preferCSSPageSize: true })` ile scratchpad'e bas, `Read` ile bak: tek sayfa, matematik satırları gri zeminli, filigran soluk.
- [ ] **Step 7: Commit + push** (`feat(mentor-takip): öğrenci kâğıdı çıktısı + e2e`). **Aşama 1 canlıda** — kullanıcıya kısa rapor.

---

## AŞAMA 2 — Sonuç işleme

### Task 6: Sonuç sekmesi + özet kartları + görüşme alanları

**Files:**
- Create: `app/(dashboard)/mentorluk/[studentId]/takip/SonucSekmesi.tsx`
- Modify: `TakipIstemci.tsx` (`SEKME_ADI`'ye `sonuc`, import)
- Test: `tests/playwright/e2e/mentor-takip.spec.ts` (ekle)

**Interfaces:**
- Consumes: `SekmeProps`, `ozetHesapla`, `programYuzde`, `dogrulukYuzde`, `fark`.
- Produces: yok (UI).

- [ ] **Step 1: Failing e2e (ekle)**

```ts
test('sonuç: kâğıttan işleme → yenile → yerinde; doğru>soru girilemez', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=sonuc`)
  const satir = page.getByRole('row', { name: /Matematik soru bankası/ }).first()
  await satir.getByRole('checkbox', { name: 'Yaptı' }).check()
  await satir.getByLabel('Soru').fill('40')
  await satir.getByLabel('Doğru').fill('50')
  await expect(satir.getByLabel('Doğru')).toHaveValue('40') // sorudan büyük girilemez
  await satir.getByLabel('Doğru').fill('30')
  await kaydedildi(page)
  await page.reload()
  await expect(page.getByRole('row', { name: /Matematik soru bankası/ }).first().getByLabel('Soru')).toHaveValue('40')
  await expect(page.getByText('Doğruluk').locator('..')).toContainText('%75')
  const { data } = await db.from('mentor_haftalari').select('soru, dogru, islendi').eq('student_id', ogrId).single()
  expect(data).toEqual({ soru: 40, dogru: 30, islendi: true })
})

test('iki sekme: eski sekme üzerine yazamaz', async ({ page, context }) => {
  const url = `/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=sonuc`
  const ikinci = await context.newPage()
  await Promise.all([page.goto(url), ikinci.goto(url)])
  await page.getByLabel('İyi giden').fill('Birinci sekme')
  await kaydedildi(page)
  await ikinci.getByLabel('İyi giden').fill('İkinci sekme')
  await expect(ikinci.getByRole('alert')).toContainText('Başka bir ekranda değişti', { timeout: 15_000 })
  const { data } = await db.from('mentor_haftalari').select('gorusme').eq('student_id', ogrId).single()
  expect((data!.gorusme as { iyi: string }).iyi).toBe('Birinci sekme')
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: `SonucSekmesi.tsx`**

```tsx
'use client'
import { GUNLER, miktarYaz, ozetHesapla, programYuzde, dogrulukYuzde, fark, type Gorev, type Gorusme } from '@/src/domains/mentor/takip/takipMath'
import { dersKisa } from '@/src/domains/mentor/lib/bultenMath'
import type { SekmeProps } from './TakipIstemci'

const kutu = 'rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-base md:text-sm'
const DURUM: Record<string, string> = { yapildi: 'Yaptı', gec: 'Geç yaptı', eksik: 'Eksik', yapilmadi: 'Yapmadı', mazeretli: 'Mazeretli' }
const sayi = (s: string) => (s === '' ? null : Math.max(0, Math.trunc(Number(s)) || 0))
const GORUSME: [keyof Gorusme, string][] = [['iyi', 'İyi giden'], ['zor', 'Zorlandığı'], ['hedef', 'Gelecek hafta kendi hedefi'], ['odak', 'Gelecek haftanın odağı'], ['evde', 'Evde veliden ricam']]

function Kart({ baslik, deger, alt }: { baslik: string; deger: string; alt?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 p-3">
      <p className="text-xs text-gray-500 dark:text-slate-400">{baslik}</p>
      <p className="text-lg font-bold tabular-nums">{deger}</p>
      {alt && <p className="text-xs text-gray-500 dark:text-slate-400">{alt}</p>}
    </div>
  )
}

export default function SonucSekmesi({ v, veri, degistir }: SekmeProps) {
  const o = ozetHesapla(veri.icerik)
  const p = programYuzde(o), d = dogrulukYuzde(o), f = fark(o, v.onceki?.ozet ?? null)
  const mo = veri.icerik.mentorOdevleri
  const gorev = (id: string, x: Partial<Gorev>, hemen = false) =>
    degistir(h => ({ ...h, icerik: { ...h.icerik, gorevler: h.icerik.gorevler.map(g => g.id === id ? { ...g, ...x } : g) } }), hemen)

  return (
    <div className="space-y-6">
      <section aria-label="Özet" className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kart baslik="Program" deger={p === null ? '—' : `%${p}`} alt={`${o.gorev_yapilan}/${o.gorev_toplam}`} />
        <Kart baslik="Soru" deger={`${o.soru}`} alt={`hedef ${veri.soruHedefi}`} />
        <Kart baslik="Doğruluk" deger={d === null ? '—' : `%${d}`} alt={f === null ? undefined : `${f >= 0 ? '↑' : '↓'} ${Math.abs(f)} puan`} />
        <Kart baslik="Mentör ödevi" deger={`${mo.filter(m => m.yapti).length}/${mo.length}`} />
        <Kart baslik="Okuma" deger={`${o.okuma_sayfa} sf`} />
      </section>

      <table className="w-full text-sm border-collapse">
        <thead><tr className="text-left text-xs text-gray-500 dark:text-slate-400 border-b border-gray-300 dark:border-slate-600">
          <th className="py-1">Gün</th><th>Görev</th><th>Süre</th><th>Yaptı</th><th>Soru</th><th>Doğru</th></tr></thead>
        <tbody>
          {veri.icerik.gorevler.slice().sort((a, b) => a.gun - b.gun).map(g => (
            <tr key={g.id} aria-label={`${GUNLER[g.gun]} ${g.ad}`} className={`border-b border-gray-100 dark:border-slate-700 ${g.ders === 'Matematik' ? 'font-semibold' : ''}`}>
              <td className="py-1 pr-2">{GUNLER[g.gun]}</td>
              <td className="pr-2">{g.ad}{g.konu && <span className="text-gray-500 dark:text-slate-400"> · {g.konu}</span>}</td>
              <td className="pr-2 whitespace-nowrap">{miktarYaz(g, veri.seviye)}</td>
              <td><input type="checkbox" aria-label="Yaptı" className="w-5 h-5" checked={g.yapti} onChange={e => gorev(g.id, { yapti: e.target.checked }, true)} /></td>
              <td>{g.soruSatiri && <input aria-label="Soru" type="number" min={0} inputMode="numeric" className={`${kutu} w-20`} value={g.soru ?? ''}
                onChange={e => { const s = sayi(e.target.value); gorev(g.id, { soru: s, dogru: g.dogru === null || s === null ? (s === null ? null : g.dogru) : Math.min(g.dogru, s) }) }} />}</td>
              <td>{g.soruSatiri && <input aria-label="Doğru" type="number" min={0} max={g.soru ?? 0} inputMode="numeric" className={`${kutu} w-20`} value={g.dogru ?? ''} disabled={g.soru === null}
                onChange={e => { const x = sayi(e.target.value); gorev(g.id, { dogru: x === null ? null : Math.min(x, g.soru ?? 0) }) }} />}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section aria-label="Okul ödevleri">
        <h2 className="text-base font-semibold mb-2">Okul ödevleri <span className="text-xs font-normal text-gray-500 dark:text-slate-400">(dersin öğretmeninin işareti)</span></h2>
        {v.okulOdevleri.length === 0 ? <p className="text-sm text-gray-500 dark:text-slate-400">Bu hafta okul ödevi yok.</p>
          : <ul className="text-sm space-y-1">{v.okulOdevleri.map(x => (
              <li key={x.id}>{dersKisa(x.subject)} — {x.title}: <b>{x.status ? DURUM[x.status] ?? x.status : x.bekliyor ? 'Henüz kontrol edilmedi' : 'İşaretlenmedi'}</b></li>))}</ul>}
      </section>

      {mo.length > 0 && (
        <section aria-label="Mentör ödevleri">
          <h2 className="text-base font-semibold mb-2">Mentör ödevleri</h2>
          {mo.map(m => (
            <label key={m.id} className="flex items-center gap-2 text-sm py-1">
              <input type="checkbox" className="w-5 h-5" checked={m.yapti}
                onChange={e => degistir(h => ({ ...h, icerik: { ...h.icerik, mentorOdevleri: h.icerik.mentorOdevleri.map(x => x.id === m.id ? { ...x, yapti: e.target.checked } : x) } }), true)} />
              {m.kitapAdi} — {m.konu} {m.sayfalar}
            </label>
          ))}
        </section>
      )}

      {veri.icerik.okuma && (
        <section aria-label="Okuma" className="flex flex-wrap items-end gap-4 text-sm">
          <span className="font-semibold">Okuma: {veri.icerik.okuma.kitap}</span>
          <label>Bu hafta okuduğu sayfa
            <input type="number" min={0} inputMode="numeric" className={`${kutu} w-24 block`} value={veri.icerik.okuma.sayfa ?? ''}
              onChange={e => degistir(h => ({ ...h, icerik: { ...h.icerik, okuma: h.icerik.okuma && { ...h.icerik.okuma, sayfa: sayi(e.target.value) } } }))} />
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5" checked={veri.icerik.okuma.bitti}
            onChange={e => degistir(h => ({ ...h, icerik: { ...h.icerik, okuma: h.icerik.okuma && { ...h.icerik.okuma, bitti: e.target.checked } } }), true)} /> Kitabı bitirdi</label>
        </section>
      )}

      <section aria-label="Görüşme" className="grid md:grid-cols-2 gap-3">
        {GORUSME.map(([k, ad]) => (
          <label key={k} className="text-sm">{ad}
            <textarea rows={2} className={`${kutu} w-full block`} value={veri.gorusme[k]}
              onChange={e => degistir(h => ({ ...h, gorusme: { ...h.gorusme, [k]: e.target.value } }))} />
          </label>
        ))}
      </section>
    </div>
  )
}
```

- [ ] **Step 4: `TakipIstemci.tsx`** — `SEKME_ADI`'ye `sonuc: 'Sonuç'`, `import SonucSekmesi from './SonucSekmesi'`, render: `{sekme === 'sonuc' && <SonucSekmesi {...props} />}`.
- [ ] **Step 5: Run — PASS** `npx playwright test mentor-takip`; `npm run typecheck`.
- [ ] **Step 6: Commit + push** (`feat(mentor-takip): sonuç işleme, özet kartları, görüşme alanları`)

### Task 7: Mentörlüğüm listesinde hafta durumu

**Files:**
- Modify: `app/(dashboard)/mentorluk/page.tsx`, `app/(dashboard)/mentorluk/MentorTablosu.tsx`
- Test: `tests/playwright/e2e/mentor-takip.spec.ts` (ekle)

**Interfaces:**
- Consumes: `TakipService.durumlar`, `TakipService.acikMi`, `haftaDurumu`, `programYuzde`.
- Produces: `MentorTablosu` yeni opsiyonel prop `takip?: Record<string, string>` (öğrenci id → "Plan yok" / "Kâğıtta" / "İşlendi · %80").

- [ ] **Step 1: Failing e2e (ekle)**

```ts
test('Mentörlüğüm listesinde bu haftanın durumu', async ({ page }) => {
  const bu = (() => { const d = new Date(); const g = (d.getDay() + 6) % 7; d.setDate(d.getDate() - g); return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }) })()
  await page.goto('/mentorluk')
  const { data: o } = await db.from('students').select('full_name').eq('id', ogrId).single()
  const satir = page.locator('table').getByRole('row', { name: new RegExp(o!.full_name) })
  const { data: h } = await db.from('mentor_haftalari').select('id').eq('student_id', ogrId).eq('hafta_basi', bu)
  await expect(satir).toContainText(h?.length ? /Kâğıtta|İşlendi/ : /Plan yok/)
})
```

- [ ] **Step 2: Run — FAIL**
- [ ] **Step 3: `page.tsx`** — import `TakipService`, `weekStartOf`, `haftaDurumu`, `programYuzde`; `Promise.all` sonrası:

```ts
const buHafta = weekStartOf(bugun)
const takipAcik = await TakipService.acikMi()
const durum = takipAcik ? await TakipService.durumlar(rows.map(r => r.student_id), buHafta) : null
const takip = durum ? Object.fromEntries(rows.map(r => {
  const s = durum.get(r.student_id) ?? null
  const d = haftaDurumu(s)
  return [r.student_id, d === 'yok' ? 'Plan yok' : d === 'kagitta' ? 'Kâğıtta' : `İşlendi · %${programYuzde(s!) ?? 0}`]
})) : undefined
```
`<MentorTablosu ... takip={takip} />` (iki çağrı yeri varsa ikisine de).

- [ ] **Step 4: `MentorTablosu.tsx`** — props'a `takip?: Record<string, string>`; masaüstü thead'de "Son görüşme"den önce `{takip && <th className="py-2 px-2 font-semibold">Bu hafta</th>}`; satırda `{takip && <td className="py-2 px-2 whitespace-nowrap">{takip[s.id]}</td>}`; mobil kartta ad satırının altına `{takip && <p className="text-xs mt-0.5">{takip[s.id]}</p>}`.
- [ ] **Step 5: Run — PASS** `npx playwright test mentor-takip mentorluk mentorluguma-ekle`
- [ ] **Step 6: Commit + push** (`feat(mentor-takip): Mentörlüğüm'de bu haftanın durumu`). **Aşama 2 canlıda.**

---

## AŞAMA 3 — Veli

### Task 8: Veli mesajı + veli raporu çıktısı

**Files:**
- Create: `src/domains/mentor/takip/veliMesaji.ts`, `app/(dashboard)/mentorluk/[studentId]/takip/VeliSekmesi.tsx`, `app/(dashboard)/mentorluk/[studentId]/takip/veli-raporu/page.tsx`
- Modify: `TakipIstemci.tsx` — `SEKME_ADI`'ye `veli: 'Veli mesajı'`, `import VeliSekmesi from './VeliSekmesi'`, render: `{sekme === 'veli' && <VeliSekmesi {...props} />}`
- Test: `tests/vitest/unit/mentor/veliMesaji.test.ts`, e2e (ekle)

**Interfaces:**
- Consumes: `ozetHesapla`, `programYuzde`, `dogrulukYuzde`, `fark`, `haftaEtiketi`, `whatsappLink`.
- Produces: `takipVeliMesaji(g: { ogrenciAdi: string; pazartesi: string; veri: HaftaVerisi; onceki: Ozet | null; konular: { oturan: string[]; calisilan: string[] }; mentorAdi: string }): string`

- [ ] **Step 1: Failing unit test**

```ts
import { describe, it, expect } from 'vitest'
import { takipVeliMesaji } from '@/src/domains/mentor/takip/veliMesaji'
import { yeniHafta, BOS_GORUSME } from '@/src/domains/mentor/takip/takipMath'

const temel = () => {
  const veri = yeniHafta(null, 9)
  veri.icerik.gorevler = veri.icerik.gorevler.slice(0, 4).map((g, i) => ({ ...g, yapti: i < 3, soruSatiri: i === 1, soru: i === 1 ? 100 : null, dogru: i === 1 ? 80 : null }))
  return { ogrenciAdi: 'Ali Yılmaz', pazartesi: '2026-10-19', veri, onceki: null, konular: { oturan: [], calisilan: [] }, mentorAdi: 'Fevzi Coşkun' }
}

describe('takipVeliMesaji', () => {
  it('temel satırlar ve imza', () => {
    const m = takipVeliMesaji(temel())
    expect(m).toContain('Sayın Veli, Ali Yılmaz için 19–23 Ekim haftasının özeti:')
    expect(m).toContain('• Program: 4 görevin 3 tanesini tamamladı (%75).')
    expect(m).toContain('• Soru: 100 soru çözdü (hedef 120), doğruluk %80.')
    expect(m.trim().endsWith('Fevzi Coşkun')).toBe(true)
  })
  it('boş alanlar atlanır', () => {
    const m = takipVeliMesaji(temel())
    for (const s of ['Ekstra', 'Oturan', 'İyi giden', 'Zorlandığı', 'Evde sizden ricam', 'Okuma']) expect(m).not.toContain(s)
  })
  it('fark, okuma, görüşme, konular', () => {
    const g = temel()
    g.veri.icerik.okuma = { kitap: 'Kürk Mantolu Madonna', sayfa: 120, bitti: true }
    g.veri.gorusme = { ...BOS_GORUSME, iyi: 'Düzenli', evde: 'Telefonu akşam alın' }
    g.konular = { oturan: ['Türev'], calisilan: ['İntegral'] }
    const m = takipVeliMesaji({ ...g, onceki: { gorev_toplam: 1, gorev_yapilan: 1, soru: 100, dogru: 70, okuma_sayfa: 0, islendi: true } })
    expect(m).toContain('doğruluk %80, geçen haftaya göre 10 puan arttı.')
    expect(m).toContain('• Okuma: Kürk Mantolu Madonna kitabını bitirdi (bu hafta 120 sayfa).')
    expect(m).toContain('• Oturan konular: Türev')
    expect(m).toContain('• İyi giden: Düzenli')
    expect(m).toContain('Evde sizden ricam: Telefonu akşam alın')
  })
  it('hiç işlenmemiş hafta → program satırı yok', () => {
    const g = temel(); g.veri.icerik.gorevler = []
    expect(takipVeliMesaji(g)).not.toContain('• Program')
  })
})
```

- [ ] **Step 2: Run — FAIL**
- [ ] **Step 3: `veliMesaji.ts`**

```ts
import { haftaEtiketi } from '../lib/bultenMath'
import { ozetHesapla, dogrulukYuzde, fark, type HaftaVerisi, type Ozet } from './takipMath'

/** Konu haritasından veli mesajı listeleri (client + server ortak). */
export function konuAdlari(konular: { id: string; ad: string }[], durum: Record<string, number>) {
  const ad = (d: number) => konular.filter(k => durum[k.id] === d).map(k => k.ad)
  return { oturan: ad(2), calisilan: ad(1) }
}

/** Spec §5 şablonu; boş satırlar atlanır. */
export function takipVeliMesaji(g: {
  ogrenciAdi: string; pazartesi: string; veri: HaftaVerisi; onceki: Ozet | null
  konular: { oturan: string[]; calisilan: string[] }; mentorAdi: string
}): string {
  const o = ozetHesapla(g.veri.icerik), d = dogrulukYuzde(o), f = fark(o, g.onceki)
  const gk = g.veri.gorusme, ok = g.veri.icerik.okuma, mo = g.veri.icerik.mentorOdevleri
  const gorevSay = g.veri.icerik.gorevler.length, gorevYap = g.veri.icerik.gorevler.filter(x => x.yapti).length
  const farkMetni = f === null || f === 0 ? '' : `, geçen haftaya göre ${Math.abs(f)} puan ${f > 0 ? 'arttı' : 'düştü'}`
  const satir = (kosul: unknown, metin: string) => (kosul ? [metin] : [])
  return [
    `Sayın Veli, ${g.ogrenciAdi} için ${haftaEtiketi(g.pazartesi)} haftasının özeti:`,
    '',
    ...satir(gorevSay, `• Program: ${gorevSay} görevin ${gorevYap} tanesini tamamladı (%${Math.round((gorevYap / gorevSay) * 100)}).`),
    ...satir(o.soru, `• Soru: ${o.soru} soru çözdü (hedef ${g.veri.soruHedefi}), doğruluk %${d}${farkMetni}.`),
    ...satir(mo.length, `• Ekstra ödevler: ${mo.length} ödevin ${mo.filter(m => m.yapti).length} tanesi yapıldı.`),
    ...satir(ok && (ok.sayfa || ok.bitti), ok?.bitti ? `• Okuma: ${ok.kitap} kitabını bitirdi${ok.sayfa ? ` (bu hafta ${ok.sayfa} sayfa)` : ''}.` : `• Okuma: ${ok?.kitap} kitabından ${ok?.sayfa} sayfa okudu.`),
    ...satir(g.konular.oturan.length, `• Oturan konular: ${g.konular.oturan.join(', ')}`),
    ...satir(g.konular.calisilan.length, `• Üzerinde çalıştığımız konular: ${g.konular.calisilan.join(', ')}`),
    ...satir(gk.iyi.trim(), `• İyi giden: ${gk.iyi.trim()}`),
    ...satir(gk.zor.trim(), `• Zorlandığı yer: ${gk.zor.trim()}`),
    ...satir(gk.hedef.trim(), `• Gelecek hafta için kendi koyduğu hedef: “${gk.hedef.trim()}”`),
    ...satir(gk.odak.trim(), `• Gelecek haftanın odağı: ${gk.odak.trim()}`),
    ...satir(gk.evde.trim(), `\nEvde sizden ricam: ${gk.evde.trim()}`),
    '',
    'İlginiz için teşekkür ederim.',
    g.mentorAdi,
  ].join('\n')
}
```

> Program yüzdesi mesajda yalnız görevlerden (mentör ödevi ayrı satırda) — spec şablonuyla aynı.

- [ ] **Step 4: Run unit — PASS**
- [ ] **Step 5: Sayfa verisine konu durumları** — `TakipRepository.konuDurumlari(schoolId, studentId)`:

```ts
async konuDurumlari(schoolId: string, studentId: string) {
  const db = await createClient()
  const { data, error } = await db.from('ogrenci_konu_durumu').select('konu_id, durum').eq('school_id', schoolId).eq('student_id', studentId)
  if (error) throw new Error(error.message)
  return data ?? []
},
```
`SayfaVerisi`'ye `konuDurumu: Record<string, 0 | 1 | 2>` ekle; `sayfaVerisi` içinde `Promise.all`'a `R.konuDurumlari(ab.schoolId, studentId)` ekle ve `konuDurumu: Object.fromEntries(rows.map(r => [r.konu_id, r.durum]))`. Ayrıca veli için `veliTelefon`: `R.ogrenci` select'ine `veli_telefon` ekle → `ogrenci.veliTelefon: string | null`.

- [ ] **Step 6: `VeliSekmesi.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { takipVeliMesaji, konuAdlari } from '@/src/domains/mentor/takip/veliMesaji'
import { whatsappLink } from '@/src/domains/mentor/lib/bultenMath'
import type { SekmeProps } from './TakipIstemci'

export default function VeliSekmesi({ v, veri }: SekmeProps) {
  const otomatik = takipVeliMesaji({ ogrenciAdi: v.ogrenci.ad, pazartesi: v.hafta, veri, onceki: v.onceki?.ozet ?? null, konular: konuAdlari(v.konular, v.konuDurumu), mentorAdi: v.mentorAdi })
  const [metin, setMetin] = useState(otomatik)
  const [kopyalandi, setKopyalandi] = useState(false)
  useEffect(() => setMetin(otomatik), [otomatik])
  return (
    <div className="space-y-3 max-w-2xl">
      <label className="text-sm block">Veliye gidecek mesaj (düzenleyebilirsiniz)
        <textarea rows={16} className="mt-1 w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-base md:text-sm" value={metin} onChange={e => setMetin(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-sm"
          onClick={async () => { await navigator.clipboard.writeText(metin); setKopyalandi(true); setTimeout(() => setKopyalandi(false), 2000) }}>
          {kopyalandi ? 'Kopyalandı ✓' : 'Mesajı kopyala'}
        </button>
        <a href={whatsappLink(metin, v.ogrenci.veliTelefon)} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm">WhatsApp&apos;ta gönder</a>
        <Link href={`/mentorluk/${v.ogrenci.id}/takip/veli-raporu?hafta=${v.hafta}`} className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-sm">Veli raporunu yazdır</Link>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400">Düzenlemeniz kaydedilmez; mesaj her açılışta güncel verilerden yeniden oluşur.</p>
    </div>
  )
}
```

> Düzenlenmiş metnin kaydedilmemesi bilinçli (YAGNI): mesaj işlenen veriden türetilir; veli raporu çıktısı da otomatik metni basar.

- [ ] **Step 7: `veli-raporu/page.tsx`** — `kagit/page.tsx` ile aynı kapı ve yükleme; gövde:

```tsx
const o = ozetHesapla(v.taslak.icerik), p = programYuzde(o), d = dogrulukYuzde(o)
const mo = v.taslak.icerik.mentorOdevleri
const metin = takipVeliMesaji({ ogrenciAdi: v.ogrenci.ad, pazartesi: v.hafta, veri: v.taslak, onceki: v.onceki?.ozet ?? null, konular: konuAdlari(v.konular, v.konuDurumu), mentorAdi: v.mentorAdi })
// ...
<article className="text-sm text-black bg-white">
  <p className="text-xs">{v.okulAdi}</p>
  <h1 className="text-lg font-bold">Haftalık Mentörlük Raporu</h1>
  <p className="mb-3">{v.ogrenci.ad} · {v.ogrenci.sinifAdi} · {haftaEtiketi(v.hafta)}</p>
  <div className="grid grid-cols-4 gap-2 mb-4">
    {[['Program', p === null ? '—' : `%${p}`], ['Soru / doğruluk', `${o.soru} · ${d === null ? '—' : `%${d}`}`],
      ['Mentör ödevi', `${mo.filter(m => m.yapti).length}/${mo.length}`], ['Okuma', `${o.okuma_sayfa} sayfa`]].map(([b, x]) => (
      <div key={b} className="border border-gray-400 p-2"><p className="text-xs">{b}</p><p className="text-base font-bold">{x}</p></div>
    ))}
  </div>
  <pre className="whitespace-pre-wrap font-sans">{metin}</pre>
</article>
```
Import'lar: `ozetHesapla, programYuzde, dogrulukYuzde` (takipMath), `takipVeliMesaji, konuAdlari` (veliMesaji), `haftaEtiketi` (bultenMath).

- [ ] **Step 8: Failing→passing e2e (ekle)**

```ts
test('veli mesajı ve veli raporu', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=veli`)
  await expect(page.getByLabel(/Veliye gidecek mesaj/)).toHaveValue(/Sayın Veli, .+ için 19–23 Ekim haftasının özeti/)
  await expect(page.getByRole('link', { name: "WhatsApp'ta gönder" })).toHaveAttribute('href', /wa\.me/)
  await page.goto(`/mentorluk/${ogrId}/takip/veli-raporu?hafta=2026-10-19`)
  await expect(page.getByRole('heading', { name: 'Haftalık Mentörlük Raporu' })).toBeVisible()
  await expect(page.locator('.filigran img')).toHaveCount(1)
})
```

- [ ] **Step 9: Run — PASS** unit + `npx playwright test mentor-takip`; typecheck.
- [ ] **Step 10: Commit + push** (`feat(mentor-takip): veli mesajı (kopyala/WhatsApp) + veli raporu çıktısı`). **Aşama 3 canlıda.**

---

## AŞAMA 4 — Öğrenci dosyası, idare, toplu yazdırma

### Task 9: Öğrenci dosyası (konu haritası, kitaplar, okuma geçmişi, geçmiş haftalar)

**Files:**
- Create: `app/(dashboard)/mentorluk/[studentId]/takip/DosyaSekmesi.tsx`
- Modify: `TakipRepository.ts`, `TakipService.ts`, `app/actions/mentor-takip.ts`, `TakipIstemci.tsx`
- Test: `tests/vitest/unit/mentor/takipMath.test.ts` (okumaGecmisi), e2e (ekle)

**Interfaces:**
- Produces:
  - takipMath: `okumaGecmisi(haftalar: { hafta: string; okuma: Okuma | null }[]): { kitap: string; bas: string; son: string; sayfa: number; bitti: boolean }[]` (haftalar artan sırada; aynı kitap ardışık haftalarda birleşir)
  - Repository: `gecmis(schoolId, studentId): Promise<{ hafta_basi: string; seviye: number; icerik: Json } & Ozet[]>`, `konuEkle(schoolId, userId, ders, sinif, ad)`, `konuDurumuYaz(schoolId, studentId, konuId, durum)`
  - Service: `gecmis(studentId)`, `konuEkle(studentId, ders, ad)`, `konuDurumuYaz(studentId, konuId, durum)`
  - Actions: `konuEkle(studentId: string, ders: string, ad: string)`, `konuDurumu(studentId: string, konuId: string, durum: 0 | 1 | 2)`
  - `SayfaVerisi.gecmis: { hafta: string; seviye: Seviye; ozet: Ozet; okuma: Okuma | null }[]` (yalnız `sekme === 'dosya'` iken doldurulur; `sayfaVerisi(studentId, hafta, { gecmis: boolean })`)

- [ ] **Step 1: Failing unit (ekle `takipMath.test.ts`)**

```ts
import { okumaGecmisi } from '@/src/domains/mentor/takip/takipMath'
describe('okumaGecmisi', () => {
  it('aynı kitap birleşir, sayfalar toplanır, bitti işaretlenir', () => {
    expect(okumaGecmisi([
      { hafta: '2026-10-05', okuma: { kitap: 'A', sayfa: 50, bitti: false } },
      { hafta: '2026-10-12', okuma: { kitap: 'A', sayfa: 70, bitti: true } },
      { hafta: '2026-10-19', okuma: { kitap: 'B', sayfa: null, bitti: false } },
      { hafta: '2026-10-26', okuma: null },
    ])).toEqual([
      { kitap: 'A', bas: '2026-10-05', son: '2026-10-12', sayfa: 120, bitti: true },
      { kitap: 'B', bas: '2026-10-19', son: '2026-10-19', sayfa: 0, bitti: false },
    ])
  })
})
```

- [ ] **Step 2: Implement (takipMath.ts'e ekle)**

```ts
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
```
Run — PASS.

- [ ] **Step 3: Repository ekleri**

```ts
async gecmis(schoolId: string, studentId: string) {
  const db = await createClient()
  const { data, error } = await db.from('mentor_haftalari')
    .select('hafta_basi, seviye, icerik, gorev_toplam, gorev_yapilan, soru, dogru, okuma_sayfa, islendi')
    .eq('school_id', schoolId).eq('student_id', studentId).order('hafta_basi').limit(200)
  if (error) throw new Error(error.message)
  return data ?? []
},
async konuEkle(schoolId: string, userId: string, ders: string, sinif: number, ad: string) {
  const db = await createClient()
  return db.from('konu_listesi').upsert({ school_id: schoolId, ders, sinif, ad, created_by: userId, sira: 1000 },
    { onConflict: 'school_id,ders,sinif,ad', ignoreDuplicates: true }).select('id, ders, ad, grup')
},
async konuDurumuYaz(schoolId: string, studentId: string, konuId: string, durum: number) {
  const db = await createClient()
  return db.from('ogrenci_konu_durumu').upsert({ school_id: schoolId, student_id: studentId, konu_id: konuId, durum, updated_at: new Date().toISOString() })
},
```
> `limit(200)`: öğrenci başına yılda ~40 hafta; 1000 sınırı riski yok.

- [ ] **Step 4: Service + actions**

```ts
// TakipService
async konuEkle(studentId: string, ders: string, ad: string) {
  const ab = await yetki(studentId)
  if (!ab) return { error: 'Bu öğrencinin takibine erişiminiz yok.' }
  const o = await R.ogrenci(ab.schoolId, studentId)
  const sinif = (o?.classes as { grade: number } | null)?.grade ?? 9
  const { error } = await R.konuEkle(ab.schoolId, ab.userId, ders, sinif, ad)
  return error ? { error: 'Konu eklenemedi.' } : {}
},
async konuDurumuYaz(studentId: string, konuId: string, durum: 0 | 1 | 2) {
  const ab = await yetki(studentId)
  if (!ab) return { error: 'Bu öğrencinin takibine erişiminiz yok.' }
  const { error } = await R.konuDurumuYaz(ab.schoolId, studentId, konuId, durum)
  return error ? { error: 'Kaydedilemedi.' } : {}
},
```
`sayfaVerisi(studentId, hafta, { gecmis = false } = {})`: `gecmis` true ise `R.gecmis` → `gecmis: rows.map(r => ({ hafta: r.hafta_basi, seviye: r.seviye as Seviye, ozet: { gorev_toplam: r.gorev_toplam, gorev_yapilan: r.gorev_yapilan, soru: r.soru, dogru: r.dogru, okuma_sayfa: r.okuma_sayfa, islendi: r.islendi }, okuma: (r.icerik as unknown as Icerik).okuma }))`, değilse `[]`. Takip `page.tsx`: `TakipService.sayfaVerisi(studentId, hafta, { gecmis: sekme === 'dosya' })` (sekmeyi önce hesapla).

```ts
// app/actions/mentor-takip.ts
const konuSchema = z.object({ studentId: UUID, ders: z.string().trim().min(1).max(60), ad: z.string().trim().min(1, 'Konu adı boş olamaz').max(120) })
export async function konuEkle(studentId: string, ders: string, ad: string): Promise<ActionResult> {
  const p = konuSchema.safeParse({ studentId, ders, ad })
  if (!p.success) return { error: p.error.issues[0]?.message ?? 'Geçersiz veri' }
  const r = await TakipService.konuEkle(p.data.studentId, p.data.ders, p.data.ad)
  if (!r.error) revalidatePath(`/mentorluk/${studentId}/takip`)
  return r
}
export async function konuDurumu(studentId: string, konuId: string, durum: number): Promise<ActionResult> {
  if (!UUID.safeParse(studentId).success || !UUID.safeParse(konuId).success || ![0, 1, 2].includes(durum)) return { error: 'Geçersiz veri' }
  return TakipService.konuDurumuYaz(studentId, konuId, durum as 0 | 1 | 2)
}
```

- [ ] **Step 5: `DosyaSekmesi.tsx`**

```tsx
'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { konuEkle, konuDurumu } from '@/app/actions/mentor-takip'
import { SEVIYE_ADI, programYuzde, dogrulukYuzde, okumaGecmisi } from '@/src/domains/mentor/takip/takipMath'
import { haftaEtiketi } from '@/src/domains/mentor/lib/bultenMath'
import type { SekmeProps } from './TakipIstemci'

const DURUM_AD = ['Başlanmadı', 'Çalışılıyor', 'Oturdu'] as const
const DURUM_RENK = ['border-gray-300 dark:border-slate-600', 'border-amber-500 bg-amber-50 dark:bg-amber-950', 'border-green-600 bg-green-50 dark:bg-green-950']

export default function DosyaSekmesi({ v }: SekmeProps) {
  const router = useRouter()
  const [durum, setDurum] = useState(v.konuDurumu)
  const [ders, setDers] = useState('Matematik'); const [yeni, setYeni] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [, basla] = useTransition()
  const dersler = [...new Set(['Matematik', ...v.konular.map(k => k.ders)])]
  const tikla = (id: string) => {
    const eski = durum[id] ?? 0, sonraki = ((eski + 1) % 3) as 0 | 1 | 2
    setDurum(d => ({ ...d, [id]: sonraki }))
    basla(async () => { const r = await konuDurumu(v.ogrenci.id, id, sonraki); if (r.error) { setDurum(d => ({ ...d, [id]: eski })); setHata(r.error) } })
  }
  return (
    <div className="space-y-8">
      <section aria-label="Konu haritası">
        <h2 className="text-base font-semibold mb-2">Konu haritası <span className="text-xs font-normal text-gray-500 dark:text-slate-400">(tıkla: başlanmadı → çalışılıyor → oturdu)</span></h2>
        {dersler.map(d => {
          const ks = v.konular.filter(k => k.ders === d)
          if (!ks.length) return null
          return (
            <div key={d} className="mb-3">
              <h3 className="text-sm font-semibold mb-1">{d}</h3>
              <div className="flex flex-wrap gap-2">
                {ks.map(k => (
                  <button key={k.id} type="button" onClick={() => tikla(k.id)} aria-label={`${k.ad}: ${DURUM_AD[durum[k.id] ?? 0]}`}
                    className={`px-2 py-1 rounded border text-sm ${DURUM_RENK[durum[k.id] ?? 0]}`}>
                    {k.ad} <span className="text-xs">· {DURUM_AD[durum[k.id] ?? 0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        <form className="flex flex-wrap gap-2 items-end mt-2" onSubmit={e => {
          e.preventDefault()
          basla(async () => { const r = await konuEkle(v.ogrenci.id, ders, yeni); if (r.error) setHata(r.error); else { setYeni(''); setHata(null); router.refresh() } })
        }}>
          <label className="text-sm">Ders<input list="dersler" className="block rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-base md:text-sm w-36" value={ders} onChange={e => setDers(e.target.value)} required /></label>
          <datalist id="dersler">{['Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Türk Dili ve Edebiyatı', 'Tarih', 'Coğrafya', 'İngilizce', 'Felsefe'].map(x => <option key={x} value={x} />)}</datalist>
          <label className="text-sm">Konu<input className="block rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-base md:text-sm w-56" value={yeni} onChange={e => setYeni(e.target.value)} required /></label>
          <button className="px-3 py-1.5 rounded border border-gray-300 dark:border-slate-600 text-sm">Konu ekle</button>
          {hata && <span role="alert" className="text-sm text-red-700 dark:text-red-400">{hata}</span>}
        </form>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Eklenen konu bu sınıf ve dersin okul listesine kalıcı olarak geçer.</p>
      </section>

      <section aria-label="Okuduğu kitaplar">
        <h2 className="text-base font-semibold mb-2">Okuduğu kitaplar</h2>
        {(() => { const ok = okumaGecmisi(v.gecmis.map(h => ({ hafta: h.hafta, okuma: h.okuma })))
          return ok.length === 0 ? <p className="text-sm text-gray-500 dark:text-slate-400">Henüz kayıt yok.</p> : (
            <ul className="text-sm space-y-1">{ok.map(k => <li key={k.kitap + k.bas}>{k.kitap} — {haftaEtiketi(k.bas)}{k.son !== k.bas && ` → ${haftaEtiketi(k.son)}`} · {k.sayfa} sayfa {k.bitti && '· bitti ✓'}</li>)}</ul>) })()}
      </section>

      <section aria-label="Geçmiş haftalar">
        <h2 className="text-base font-semibold mb-2">Geçmiş haftalar</h2>
        <table className="w-full text-sm border-collapse">
          <thead><tr className="text-left text-xs text-gray-500 dark:text-slate-400 border-b border-gray-300 dark:border-slate-600">
            <th className="py-1">Hafta</th><th>Seviye</th><th>Program</th><th>Soru</th><th>Doğruluk</th><th>Okuma</th><th /></tr></thead>
          <tbody>{v.gecmis.slice().reverse().map(h => {
            const p = programYuzde(h.ozet), d = dogrulukYuzde(h.ozet)
            return (
              <tr key={h.hafta} className="border-b border-gray-100 dark:border-slate-700">
                <td className="py-1">{haftaEtiketi(h.hafta)}</td><td>{SEVIYE_ADI[h.seviye]}</td>
                <td>{h.ozet.islendi && p !== null ? `%${p}` : '—'}</td><td>{h.ozet.soru || '—'}</td>
                <td>{d === null ? '—' : `%${d}`}</td><td>{h.ozet.okuma_sayfa || '—'}</td>
                <td><Link className="text-blue-600 hover:underline" href={`/mentorluk/${v.ogrenci.id}/takip?hafta=${h.hafta}&sekme=sonuc`}>Aç</Link></td>
              </tr>)
          })}</tbody>
        </table>
      </section>
    </div>
  )
}
```

- [ ] **Step 6: `TakipIstemci.tsx`** — `SEKME_ADI`'ye `dosya: 'Öğrenci dosyası'`, `import DosyaSekmesi from './DosyaSekmesi'`, render: `{sekme === 'dosya' && <DosyaSekmesi {...props} />}`.
- [ ] **Step 7: e2e (ekle)**

```ts
test('konu haritası: tıkla → durum değişir, yenilemede kalır; konu ekle', async ({ page }) => {
  await page.goto(`/mentorluk/${ogrId}/takip?hafta=2026-10-19&sekme=dosya`)
  const ilk = page.getByRole('region', { name: 'Konu haritası' }).getByRole('button', { name: /: Başlanmadı$/ }).first()
  const ad = (await ilk.getAttribute('aria-label'))!.replace(/: Başlanmadı$/, '')
  await ilk.click()
  await expect(page.getByRole('button', { name: `${ad}: Çalışılıyor` })).toBeVisible()
  await page.waitForTimeout(1000); await page.reload()
  await expect(page.getByRole('button', { name: `${ad}: Çalışılıyor` })).toBeVisible()
  await page.getByLabel('Ders').fill('Fizik'); await page.getByLabel('Konu', { exact: true }).fill('E2Ekonu Vektörler')
  await page.getByRole('button', { name: 'Konu ekle' }).click()
  await expect(page.getByRole('button', { name: 'E2Ekonu Vektörler: Başlanmadı' })).toBeVisible({ timeout: 15_000 })
})
```
`afterAll`'a ekle: `await db.from('konu_listesi').delete().like('ad', 'E2Ekonu%')`.

- [ ] **Step 8: Run — PASS**; typecheck; **Commit + push** (`feat(mentor-takip): öğrenci dosyası — konu haritası, okuma geçmişi, geçmiş haftalar`)

### Task 10: İdare görünümü (yalnız rakamlar)

**Files:**
- Modify: `app/(dashboard)/yonetim/mentorluk/page.tsx`
- Test: e2e (ekle — müdür auth)

**Interfaces:**
- Consumes: RPC `mentor_takip_ozet`, `programYuzde`, `dogrulukYuzde`, `haftaEtiketi`.

- [ ] **Step 1: Failing e2e (ayrı describe, müdür)** — ekranı doğrular; RLS'in asıl kanıtı Step 4 SQL'i.

```ts
test.describe('idare', () => {
  test.use({ storageState: AUTH('mudur') })
  test('idare özet rakamı görür, görüşme notu görünmez', async ({ page }) => {
    await page.goto('/yonetim/mentorluk')
    const { data: o } = await db.from('students').select('full_name').eq('id', ogrId).single()
    await expect(page.getByRole('listitem').filter({ hasText: o!.full_name })).toContainText(/Program %\d+/)
    await expect(page.getByText('Birinci sekme')).toHaveCount(0)
  })
})
```

- [ ] **Step 2: Run — FAIL**
- [ ] **Step 3: Sayfa** — `Promise.all`'a `supabase.rpc('mentor_takip_ozet')` ekle; hata kontrolü listesine dahil et; `const takip = new Map((ozet.data ?? []).map(r => [r.student_id, r]))`. Öğrenci listesinin render edildiği yerde (kart içi `li`, `mentorListesi` çıktısı `k.ogrenciler`) öğrenci adının yanına:

```tsx
{(() => { const t = takip.get(o.id); if (!t) return null
  const p = programYuzde(t), d = dogrulukYuzde(t)
  return <span className={`text-xs ${soluk}`}> · {haftaEtiketi(t.hafta_basi)} · Program %{p ?? 0}{d !== null && ` · Doğruluk %${d}`}</span> })()}
```
(Önce mevcut `li` yapısını oku; `o.id` alan adı `mentorListesi` tipine göre uyarlanır.)

- [ ] **Step 4: SQL kanıtı (RLS)** — MCP `execute_sql`, müdür olarak taklit:

```sql
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from profiles where role='mudur' limit 1)::text, 'role','authenticated')::text, true);
set local role authenticated;
select count(*) as tablo_okuma from mentor_haftalari;          -- beklenen 0
select count(*) as ozet_satir from mentor_takip_ozet();          -- beklenen ≥ 1 (e2e verisi varken)
rollback;
```

- [ ] **Step 5: Run — PASS**; **Commit + push** (`feat(mentor-takip): idare mentörlük listesinde özet rakamlar`)

### Task 11: Toplu kâğıt yazdırma

**Files:**
- Create: `app/(dashboard)/mentorluk/takip-kagitlari/page.tsx`
- Modify: `app/(dashboard)/mentorluk/page.tsx` (bayrak açıksa düğme)
- Test: e2e (ekle)

**Interfaces:**
- Consumes: `MentorService.getMyMentorships`, `TakipService.sayfaVerisi`, `TakipService.durumlar`, `OgrenciKagidi`.

- [ ] **Step 1: Failing e2e (ekle)**

```ts
test('toplu kâğıt: planı olan öğrenci ayrı sayfada', async ({ page }) => {
  await page.goto('/mentorluk/takip-kagitlari?hafta=2026-10-19')
  const { data: o } = await db.from('students').select('full_name').eq('id', ogrId).single()
  await expect(page.getByRole('region', { name: o!.full_name })).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('section.break-after-page')).not.toHaveCount(0)
})
```

- [ ] **Step 2: Sayfa**

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { todayLocalISO } from '@/src/shared/date'
import { weekStartOf } from '@/src/domains/studyPlan/planMath'
import { pazartesiMi, haftaEtiketi } from '@/src/domains/mentor/lib/bultenMath'
import { MentorService } from '@/src/domains/mentor/services/MentorService'
import { TakipService } from '@/src/domains/mentor/services/TakipService'
import PrintButton from '@/components/PrintButton'
import OgrenciKagidi from '../[studentId]/takip/OgrenciKagidi'

export const metadata = { title: 'Haftalık Planlar' }

/** Planı kayıtlı tüm mentör öğrencilerinin kâğıtları, öğrenci başına bir A4. */
export default async function TakipKagitlariPage({ searchParams }: { searchParams: Promise<{ hafta?: string }> }) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isTeachingRole(profile.role)) redirect('/anasayfa')
  if (!(await TakipService.acikMi())) notFound()
  const h = (await searchParams).hafta
  const hafta = h && pazartesiMi(h) ? h : weekStartOf(todayLocalISO())
  const rows = await MentorService.getMyMentorships()
  const durum = await TakipService.durumlar(rows.map(r => r.student_id), hafta)
  const veriler = (await Promise.all(rows.filter(r => durum.has(r.student_id)).map(r => TakipService.sayfaVerisi(r.student_id, hafta))))
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.ogrenci.ad.localeCompare(b.ogrenci.ad, 'tr'))
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto print:p-0 print:max-w-none">
      <div className="flex justify-between items-start mb-4 print:hidden">
        <div>
          <Link href="/mentorluk" className="text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600">← Mentörlüğüm</Link>
          <h1 className="text-lg font-bold mt-1">Haftalık planlar · {haftaEtiketi(hafta)}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">{veriler.length} öğrenci · planı olmayanlar listede yok</p>
        </div>
        {veriler.length > 0 && <PrintButton />}
      </div>
      {veriler.length === 0
        ? <p className="text-sm text-gray-500 dark:text-slate-400 py-10 text-center">Bu hafta planı hazırlanmış öğrenci yok.</p>
        : veriler.map(v => (
            <section key={v.ogrenci.id} aria-label={v.ogrenci.ad} className="break-after-page last:break-after-auto mb-8 print:mb-0">
              <OgrenciKagidi v={v} veri={v.taslak} />
            </section>
          ))}
    </div>
  )
}
```
> N öğrenci × `sayfaVerisi` (her biri birkaç sorgu): 15 öğrenci için kabul edilebilir. `ponytail:` yorumu ekle — "öğrenci başına sayfaVerisi; 40+ öğrencide toplu sorguya geç".

- [ ] **Step 3: Düğme** — `mentorluk/page.tsx` başlık düğmelerine: `{takipAcik && <Link href="/mentorluk/takip-kagitlari" className={ikincilButon}>Bu haftanın kâğıtları</Link>}`
- [ ] **Step 4: Run — PASS**; **Commit + push** (`feat(mentor-takip): toplu kâğıt yazdırma`)

### Task 12: Erişim e2e'leri + final doğrulama

**Files:**
- Test: `tests/playwright/e2e/mentor-takip.spec.ts` (ekle)

- [ ] **Step 1: e2e (ekle)**

```ts
test.describe('erişim', () => {
  test('başka öğretmen (mentörü değil) → 404, kâğıt da 404', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH('zumre_baskani') })
    const p = await ctx.newPage()
    for (const yol of ['takip', 'takip/kagit', 'takip/veli-raporu']) {
      const r = await p.goto(`/mentorluk/${ogrId}/${yol}?hafta=2026-10-19`)
      expect(r?.status()).toBe(404)
    }
    await ctx.close()
  })

  test('bayrak kapalı → mentör de 404 alır ve bağlantıyı görmez', async ({ page }) => {
    await db.from('mentor_takip_kullanicilari').delete().eq('user_id', mentor.id)
    try {
      expect((await page.goto(`/mentorluk/${ogrId}/takip`))?.status()).toBe(404)
      await page.goto(`/mentorluk/${ogrId}`)
      await expect(page.getByRole('link', { name: 'Haftalık takip' })).toHaveCount(0)
      await page.goto('/mentorluk')
      await expect(page.getByRole('link', { name: 'Bu haftanın kâğıtları' })).toHaveCount(0)
    } finally {
      await db.from('mentor_takip_kullanicilari').upsert({ user_id: mentor.id, school_id: mentor.school_id })
    }
  })

  test('mentörlük başka öğretmene geçerse eski mentör erişemez', async ({ page }) => {
    const diger = await kullanici(process.env.TEST_EMAIL_ZUMRE ?? 'test_zumre@test.example')
    await db.from('mentorships').update({ mentor_id: diger.id, assigned_by: diger.id }).eq('student_id', ogrId)
    try {
      expect((await page.goto(`/mentorluk/${ogrId}/takip`))?.status()).toBe(404)
    } finally {
      await db.from('mentorships').update({ mentor_id: mentor.id, assigned_by: mentor.id }).eq('student_id', ogrId)
    }
  })
})
```
> `TEST_EMAIL_ZUMRE` env adını `tests/playwright/setup/global-setup.ts`'ten doğrula; farklıysa onu kullan.

- [ ] **Step 2: Break-then-revert** — `mentor_takip_erisimi` içindeki `mentor_takip_acik() and` kısmını geçici kaldıran SQL'i uygula → "bayrak kapalı" testi sayfa katmanında yine 404 verir (servis kapısı) ama **SQL** kontrolü (`select count(*) from mentor_haftalari` bayraksız mentör olarak) >0 döner → kanıt: RLS katmanı bağımsız çalışıyor. Ardından orijinal fonksiyonu geri uygula ve aynı SQL'in 0 döndüğünü göster.
- [ ] **Step 3: Tam doğrulama** — `npm run typecheck` (temiz), `npm run test:unit` (sayı yaz), `npx playwright test` tam (sayı yaz), `npm run build` (exit 0).
- [ ] **Step 4: Canlı iki katman** — kullanıcının kendi hesabıyla gerçek bir öğrencide: SQL ile `mentor_haftalari` satırı + özet sütunları; tarayıcıda Plan/Sonuç/Veli/Dosya ekranları ve kâğıt baskı önizlemesi.
- [ ] **Step 5: Commit + push** (`test(mentor-takip): erişim e2e'leri`); memory (`project_edudesk_excel_aktarim.md` + MEMORY.md satırı) güncelle.
