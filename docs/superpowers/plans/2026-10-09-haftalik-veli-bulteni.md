# Haftalık Veli Bülteni Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mentör `/mentorluk/bulten` sayfasından, mentörlük öğrencilerinin velilerine haftalık ödev bilgilendirmesini (kişisel metin + kişisel görsel) ve veli grubu için 2 görseli tek tıkla alır.

**Architecture:** Saf hesaplar `src/domains/mentor/lib/bultenMath.ts`'te (DB yok, unit test). `BultenService.getBulten(hafta)` mevcut `MentorService.getMyMentorships()` + `HomeworkService.getMentorHomeworkProfiles()` + küçük `BultenRepository` ile tek bir `Bulten` modeli kurar; yetki "yalnız çağıranın mentörlük öğrencileri" ile yapısal olarak sağlanır. Sayfa ve `/api/bulten/gorsel` (next/og `ImageResponse`, Node runtime) aynı modeli kullanır.

**Tech Stack:** Next.js 16.3.4 App Router (non-standard: middleware = `proxy.ts`), React 19, Tailwind v4, Supabase SSR, Zod, Vitest, Playwright, `next/og`.

**Spec:** `docs/superpowers/specs/2026-10-09-haftalik-veli-bulteni-design.md`

## Global Constraints

- Yeni tablo / migration YOK; yeni npm bağımlılığı YOK.
- Eksik = geçen hafta (`[P-7, P-1]`) `due_date`'li, işaretli (`status !== null`) ve `status ∈ {eksik, yapilmadi}`. Mazeretli, işaretsiz, `gec` eksik değildir (`gec` = yapıldı sayılır).
- Hafta seçimi: Cuma/Cumartesi/Pazar → gelecek pazartesi; Pzt–Perş → bu haftanın pazartesisi (Türkiye saati, `todayLocalISO()`).
- Grup görseli alt başlığı: `<Branş> Öğretmeni <Ad>` (`Türk Dili ve Edebiyatı` → `Edebiyat`).
- Mesaj imzası: `Saygılarımızla,\n<Mentör adı>\n<Sınıf> Mentör Öğretmeni`.
- Görsel yanıtı: `Cache-Control: private, no-store`; genişlik 1080 px.
- Renkler: lacivert `#1D2B5F`, sarı `#FFD23F`, yapıldı `#2E9E6B`, eksik `#F2B233`, yapılmadı `#D9534F`.
- Rol kapısı: `isTeachingRole(profile.role)` (mevcut mentörlük sayfalarıyla aynı).
- A11y: dokunma hedefi ≥ 44px (`min-h-[44px]`), soluk metin `text-gray-500 dark:text-slate-400`, karanlık tema sınıfları.
- Commit mesajları `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ile biter; her task sonunda commit + push.

## Review Focus

1. **Geçen hafta kontrol edilen ama 2+ hafta önce verilmiş ödev** (ör. 28 Eyl verilip 8 Ekim kontrol): eksiklerde ve özette görünmeli → servis `getMentorHomeworkProfiles`'ı `bas` OLMADAN çağırır (o parametre `assigned_date`'e göre süzer). Test: Task 2 `kayitlar` mock'u + Task 1 `ogrenciEksikleri` testi `due_date` ile süzer.
2. **Mentörün öğrencileri iki sınıfta**: grup görselleri sınıf başına, ödev listesi o sınıfın ödevleri. Test: Task 2 iki sınıflı senaryo.
3. **Başka öğretmenin öğrencisi/sınıfı için görsel URL'i** elle yazılırsa 403. Test: Task 3 route testi.
4. **Uzun ödev başlığı / çok ödevli hafta** görselde taşmamalı: başlık `kisalt(…, 44)`, yükseklik satır sayısından. Test: Task 1 `kisalt` + Task 3 yükseklik fonksiyonu testi.
5. **`localStorage` erişilemez (gizli sekme)**: "Gönderildi" işareti çalışmasa da sayfa çökmemeli → `gonderildiOku/Yaz` try/catch (Task 4 kodu; incelemede doğrula). Kalıcılık Task 5 e2e'de reload ile test edilir.

---

## File Structure

| Dosya | Sorumluluk |
|---|---|
| `src/domains/mentor/lib/bultenMath.ts` (yeni) | Saf hesaplar: hafta, eksikler, haftanın ödevleri, grup özeti, mesaj, WhatsApp linki, ders adı/rengi, kısaltma |
| `src/domains/mentor/repositories/BultenRepository.ts` (yeni) | Veli telefonları, okul adı, öğretmen adları (tek sorgu kümesi) |
| `src/domains/mentor/services/BultenService.ts` (yeni) | `getBulten(hafta)` → `Bulten` modeli |
| `src/domains/mentor/lib/bultenGorselleri.tsx` (yeni) | Satori uyumlu JSX şablonları + yükseklik hesabı |
| `app/api/bulten/gorsel/route.tsx` (yeni) | Doğrulama, yetki, `ImageResponse` |
| `assets/fonts/BricolageGrotesque-Regular.ttf`, `-ExtraBold.ttf` (yeni) | Görsel yazı tipi (OFL) |
| `next.config.ts` (değişir) | `outputFileTracingIncludes` ile yazı tiplerini route'a dahil et |
| `app/(dashboard)/mentorluk/bulten/page.tsx` (yeni) | Sunucu sayfası |
| `app/(dashboard)/mentorluk/bulten/BultenIstemci.tsx` (yeni) | Paylaş/Kopyala/WhatsApp/İndir + Gönderildi işareti |
| `app/(dashboard)/mentorluk/page.tsx` (değişir, ~satır 79-82) | "Haftalık veli bülteni" linki |
| `tests/vitest/unit/mentor/bultenMath.test.ts` (yeni) | Task 1 |
| `tests/vitest/unit/mentor/bulten-service.test.ts` (yeni) | Task 2 |
| `tests/vitest/unit/mentor/bulten-gorsel-route.test.ts` (yeni) | Task 3 |
| `tests/playwright/e2e/veli-bulteni.spec.ts` (yeni) | Task 5 |

---

### Task 1: bultenMath — saf hesaplar

**Files:**
- Create: `src/domains/mentor/lib/bultenMath.ts`
- Test: `tests/vitest/unit/mentor/bultenMath.test.ts`

**Interfaces:**
- Consumes: `HomeworkRecord` (`@/src/domains/homework/lib/stats`: `{ id, title, subject, due_date: string|null, status: SubmissionStatus|null, note, teacher_id, bekliyor }`), `addDaysISO(iso, n)` (`@/src/shared/date`).
- Produces:
  - `haftaSec(bugun: string): string` — pazartesi ISO
  - `pazartesiMi(iso: string): boolean`
  - `haftaEtiketi(pazartesi: string): string` — "12–16 Ekim" / "29 Eylül – 3 Ekim"
  - `gunAy(iso: string): string` — "12 Ekim"; `gunAdi(iso: string): string` — "Pazartesi"
  - `type Eksik = { id: string; subject: string; title: string; due_date: string; durum: 'eksik' | 'yapılmadı' }`
  - `ogrenciEksikleri(kayitlar: HomeworkRecord[], pazartesi: string): Eksik[]`
  - `type GunOdevleri = { gun: string; etiket: string; odevler: { id: string; subject: string; title: string; teacher_id: string }[] }`
  - `haftaOdevleri(kayitlar: HomeworkRecord[], pazartesi: string): GunOdevleri[]` — her zaman Pzt–Cuma 5 gün (+ varsa "Hafta sonu")
  - `type OzetSatiri = { id: string; subject: string; title: string; due_date: string; toplam: number; yapildi: number; eksik: number; yapilmadi: number }`
  - `grupOzeti(ogrenciKayitlari: HomeworkRecord[][], pazartesi: string): OzetSatiri[]`
  - `veliMesaji(g: { ogrenciAdi: string; sinif: string; pazartesi: string; eksikler: Eksik[]; gunler: GunOdevleri[]; mentorAdi: string }): string`
  - `telefonNormalize(tel: string | null): string | null`
  - `whatsappLink(metin: string, tel: string | null): string`
  - `dersKisa(subject: string): string`, `dersRengi(subject: string): string`, `kisalt(s: string, n: number): string`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/vitest/unit/mentor/bultenMath.test.ts
import { describe, it, expect } from 'vitest'
import type { HomeworkRecord } from '@/src/domains/homework/lib/stats'
import {
  haftaSec, pazartesiMi, haftaEtiketi, gunAy, gunAdi, ogrenciEksikleri, haftaOdevleri, grupOzeti,
  veliMesaji, telefonNormalize, whatsappLink, dersKisa, dersRengi, kisalt,
} from '@/src/domains/mentor/lib/bultenMath'

const P = '2026-10-12' // pazartesi
const kayit = (o: Partial<HomeworkRecord>): HomeworkRecord => ({
  id: 'h1', title: 'Başarıyorum s.1-5', subject: 'Matematik', due_date: '2026-10-07', status: null,
  note: null, teacher_id: 't1', bekliyor: false, ...o,
})

describe('haftaSec', () => {
  it('Perşembe → bu haftanın pazartesisi', () => expect(haftaSec('2026-10-08')).toBe('2026-10-05'))
  it('Cuma → gelecek pazartesi', () => expect(haftaSec('2026-10-09')).toBe('2026-10-12'))
  it('Cumartesi → gelecek pazartesi', () => expect(haftaSec('2026-10-10')).toBe('2026-10-12'))
  it('Pazar → gelecek pazartesi', () => expect(haftaSec('2026-10-11')).toBe('2026-10-12'))
  it('Pazartesi → aynı gün', () => expect(haftaSec('2026-10-12')).toBe('2026-10-12'))
  it('ay geçişi', () => expect(haftaSec('2026-10-30')).toBe('2026-11-02'))
})

describe('tarih etiketleri', () => {
  it('pazartesiMi', () => { expect(pazartesiMi('2026-10-12')).toBe(true); expect(pazartesiMi('2026-10-13')).toBe(false); expect(pazartesiMi('abc')).toBe(false) })
  it('aynı ay', () => expect(haftaEtiketi('2026-10-12')).toBe('12–16 Ekim'))
  it('ay geçen hafta', () => expect(haftaEtiketi('2026-09-28')).toBe('28 Eylül – 2 Ekim'))
  it('gunAy / gunAdi', () => { expect(gunAy('2026-10-14')).toBe('14 Ekim'); expect(gunAdi('2026-10-14')).toBe('Çarşamba') })
})

describe('ogrenciEksikleri', () => {
  it('yalnız geçen haftanın işaretli eksik/yapılmadı ödevleri, tarihe göre', () => {
    const k = [
      kayit({ id: 'a', due_date: '2026-10-08', status: 'yapilmadi' }),
      kayit({ id: 'b', due_date: '2026-10-05', status: 'eksik' }),
      kayit({ id: 'c', due_date: '2026-10-06', status: 'mazeretli' }),
      kayit({ id: 'd', due_date: '2026-10-07', status: null }),          // işaretsiz
      kayit({ id: 'e', due_date: '2026-10-07', status: 'gec' }),         // geç yapıldı
      kayit({ id: 'f', due_date: '2026-10-04', status: 'yapilmadi' }),   // önceki hafta
      kayit({ id: 'g', due_date: '2026-10-12', status: 'yapilmadi' }),   // bu hafta
      kayit({ id: 'h', due_date: null, status: 'yapilmadi' }),
    ]
    expect(ogrenciEksikleri(k, P).map(e => [e.id, e.durum])).toEqual([['b', 'eksik'], ['a', 'yapılmadı']])
  })
  it('pazar kontrollü ödev geçen haftaya dahil', () => {
    expect(ogrenciEksikleri([kayit({ due_date: '2026-10-11', status: 'eksik' })], P)).toHaveLength(1)
  })
})

describe('haftaOdevleri', () => {
  it('Pzt–Cuma 5 gün, boş gün dahil; ödevler kontrol gününe göre', () => {
    const g = haftaOdevleri([
      kayit({ id: 'x', due_date: '2026-10-14', subject: 'Fizik' }),
      kayit({ id: 'y', due_date: '2026-10-12' }),
      kayit({ id: 'z', due_date: '2026-10-20' }),   // sonraki hafta
    ], P)
    expect(g.map(d => d.etiket)).toEqual(['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'])
    expect(g[0].odevler.map(o => o.id)).toEqual(['y'])
    expect(g[2].odevler.map(o => o.id)).toEqual(['x'])
    expect(g[1].odevler).toEqual([])
  })
  it('hafta sonu kontrolü varsa ayrı "Hafta sonu" satırı', () => {
    const g = haftaOdevleri([kayit({ id: 's', due_date: '2026-10-17' })], P)
    expect(g).toHaveLength(6)
    expect(g[5]).toMatchObject({ etiket: 'Hafta sonu', odevler: [{ id: 's' }] })
  })
})

describe('grupOzeti', () => {
  it('ödev başına sayım; mazeretli/işaretsiz paydaya girmez; gec = yapıldı; hiç işaretlenmemiş ödev yok', () => {
    const ali = [kayit({ id: 'a', status: 'yapildi' }), kayit({ id: 'b', due_date: '2026-10-09', status: 'mazeretli' }), kayit({ id: 'n', status: null })]
    const ayse = [kayit({ id: 'a', status: 'eksik' }), kayit({ id: 'b', due_date: '2026-10-09', status: 'gec' }), kayit({ id: 'n', status: null })]
    const veli = [kayit({ id: 'a', status: 'yapilmadi' }), kayit({ id: 'b', due_date: '2026-10-09', status: 'yapilmadi' }), kayit({ id: 'n', status: null })]
    const o = grupOzeti([ali, ayse, veli], P)
    expect(o.map(x => [x.id, x.toplam, x.yapildi, x.eksik, x.yapilmadi])).toEqual([['a', 3, 1, 1, 1], ['b', 2, 1, 0, 1]])
  })
  it('iki grubun toplamı tüm sınıfın toplamına eşit', () => {
    const s = (st: HomeworkRecord['status']) => [kayit({ id: 'a', status: st })]
    const hepsi = grupOzeti([s('yapildi'), s('eksik'), s('yapilmadi')], P)[0]
    const g1 = grupOzeti([s('yapildi')], P)[0], g2 = grupOzeti([s('eksik'), s('yapilmadi')], P)[0]
    expect(g1.toplam + g2.toplam).toBe(hepsi.toplam)
    expect(g1.yapildi + g2.yapildi).toBe(hepsi.yapildi)
  })
})

describe('veliMesaji', () => {
  const gunler = haftaOdevleri([kayit({ id: 'y', due_date: '2026-10-12', title: 'Başarıyorum 38-40' })], P)
  it('eksikli öğrenci', () => {
    const m = veliMesaji({ ogrenciAdi: 'Ali Veli', sinif: '9-A', pazartesi: P, mentorAdi: 'Fevzi Coşkun', gunler,
      eksikler: [{ id: 'a', subject: 'Türk Dili ve Edebiyatı', title: 'PRG 38-57', due_date: '2026-10-07', durum: 'yapılmadı' }] })
    expect(m).toBe([
      'Sayın Velimiz,',
      '*Ali Veli* (9-A) için haftalık ödev bilgilendirmesi:',
      '',
      '*Geçen hafta (5–9 Ekim) tamamlanmayan ödevler:*',
      '• Edebiyat – PRG 38-57 (7 Ekim): yapılmadı',
      '',
      '*Bu hafta (12–16 Ekim) kontrol edilecek ödevler:*',
      '• Pazartesi 12 Ekim – Matematik: Başarıyorum 38-40',
      '',
      'Eksik ödevlerin tamamlanması için desteğinizi rica ederiz.',
      '',
      'Saygılarımızla,',
      'Fevzi Coşkun',
      '9-A Mentör Öğretmeni',
    ].join('\n'))
  })
  it('eksiksiz öğrenci tebrik alır, rica cümlesi olmaz; ödevsiz hafta', () => {
    const m = veliMesaji({ ogrenciAdi: 'Ali', sinif: '9-A', pazartesi: P, mentorAdi: 'X', eksikler: [], gunler: haftaOdevleri([], P) })
    expect(m).toContain('Kontrol edilen ödevlerin tamamını yaptı. Tebrikler! 👏')
    expect(m).toContain('Kontrol edilecek ödev yok.')
    expect(m).not.toContain('desteğinizi rica')
  })
})

describe('telefon ve WhatsApp', () => {
  it.each([
    ['0532 123 45 67', '905321234567'], ['532-123-4567', '905321234567'], ['+90 532 123 45 67', '905321234567'],
    ['905321234567', '905321234567'], ['', null], [null, null], ['12345', null],
  ])('telefonNormalize(%s) = %s', (girdi, beklenen) => expect(telefonNormalize(girdi)).toBe(beklenen))
  it('numarasız link kişi seçtirir, metin kodlanır', () => {
    expect(whatsappLink('a b&c\n*x*', null)).toBe('https://wa.me/?text=a%20b%26c%0A*x*')
  })
  it('numaralı link', () => expect(whatsappLink('hi', '0532 123 45 67')).toBe('https://wa.me/905321234567?text=hi'))
})

describe('ders adı, renk, kısaltma', () => {
  it('dersKisa', () => { expect(dersKisa('Türk Dili ve Edebiyatı')).toBe('Edebiyat'); expect(dersKisa('Fizik')).toBe('Fizik') })
  it('dersRengi bilinmeyen için gri', () => { expect(dersRengi('Fizik')).toBe('#E0662E'); expect(dersRengi('Resim')).toBe('#7A7F8C') })
  it('kisalt', () => { expect(kisalt('abcdef', 4)).toBe('abc…'); expect(kisalt('abc', 4)).toBe('abc') })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/vitest/unit/mentor/bultenMath.test.ts`
Expected: FAIL — `Failed to resolve import "@/src/domains/mentor/lib/bultenMath"`.

- [ ] **Step 3: Implement**

```ts
// src/domains/mentor/lib/bultenMath.ts
// Haftalık veli bülteni: saf hesaplar (DB yok). Spec: docs/superpowers/specs/2026-10-09-haftalik-veli-bulteni-design.md
import { addDaysISO } from '@/src/shared/date'
import type { HomeworkRecord } from '@/src/domains/homework/lib/stats'

const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const GUN = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
const tarih = (iso: string) => new Date(`${iso}T12:00:00Z`)
const haftaGunu = (iso: string) => tarih(iso).getUTCDay() // 0=Pazar

export function pazartesiMi(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(tarih(iso).getTime()) && haftaGunu(iso) === 1
}

/** Cuma–Pazar → gelecek pazartesi; Pzt–Perş → bu haftanın pazartesisi. `bugun` Türkiye tarihidir (todayLocalISO). */
export function haftaSec(bugun: string): string {
  const g = haftaGunu(bugun)
  if (g === 5 || g === 6 || g === 0) return addDaysISO(bugun, g === 0 ? 1 : 8 - g)
  return addDaysISO(bugun, 1 - g)
}

export const gunAy = (iso: string) => `${tarih(iso).getUTCDate()} ${AY[tarih(iso).getUTCMonth()]}`
export const gunAdi = (iso: string) => GUN[haftaGunu(iso)]

/** Pazartesi–Cuma etiketi: "12–16 Ekim" veya "28 Eylül – 2 Ekim". */
export function haftaEtiketi(pazartesi: string): string {
  const cuma = addDaysISO(pazartesi, 4)
  const [a, b] = [tarih(pazartesi), tarih(cuma)]
  return a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()}–${gunAy(cuma)}` : `${gunAy(pazartesi)} – ${gunAy(cuma)}`
}

export type Eksik = { id: string; subject: string; title: string; due_date: string; durum: 'eksik' | 'yapılmadı' }

/** Geçen hafta [P-7, P-1] kontrol edilip eksik/yapılmadı işaretlenen ödevler. Mazeretli, gec ve işaretsiz hariç. */
export function ogrenciEksikleri(kayitlar: HomeworkRecord[], pazartesi: string): Eksik[] {
  const [bas, son] = [addDaysISO(pazartesi, -7), addDaysISO(pazartesi, -1)]
  return kayitlar
    .filter(k => k.due_date !== null && k.due_date >= bas && k.due_date <= son && (k.status === 'eksik' || k.status === 'yapilmadi'))
    .map(k => ({ id: k.id, subject: k.subject, title: k.title, due_date: k.due_date as string, durum: k.status === 'eksik' ? 'eksik' as const : 'yapılmadı' as const }))
    .sort((x, y) => x.due_date.localeCompare(y.due_date) || x.subject.localeCompare(y.subject, 'tr'))
}

export type GunOdevleri = { gun: string; etiket: string; odevler: { id: string; subject: string; title: string; teacher_id: string }[] }

/** Bu hafta kontrol edilecek ödevler: Pzt–Cuma her zaman (boş gün dahil); Cmt/Paz kontrollü varsa "Hafta sonu" satırı. */
export function haftaOdevleri(kayitlar: HomeworkRecord[], pazartesi: string): GunOdevleri[] {
  const sec = (bas: string, son: string) => kayitlar
    .filter(k => k.due_date !== null && k.due_date >= bas && k.due_date <= son)
    .sort((x, y) => (x.due_date as string).localeCompare(y.due_date as string) || x.subject.localeCompare(y.subject, 'tr'))
    .map(k => ({ id: k.id, subject: k.subject, title: k.title, teacher_id: k.teacher_id }))
  const gunler: GunOdevleri[] = [0, 1, 2, 3, 4].map(i => {
    const gun = addDaysISO(pazartesi, i)
    return { gun, etiket: gunAdi(gun), odevler: sec(gun, gun) }
  })
  const hs = sec(addDaysISO(pazartesi, 5), addDaysISO(pazartesi, 6))
  if (hs.length) gunler.push({ gun: addDaysISO(pazartesi, 5), etiket: 'Hafta sonu', odevler: hs })
  return gunler
}

export type OzetSatiri = { id: string; subject: string; title: string; due_date: string; toplam: number; yapildi: number; eksik: number; yapilmadi: number }

/** Geçen haftanın her ödevi için, verilen öğrenciler arasında işaretli ve mazeretli olmayanların dağılımı (isimsiz). */
export function grupOzeti(ogrenciKayitlari: HomeworkRecord[][], pazartesi: string): OzetSatiri[] {
  const [bas, son] = [addDaysISO(pazartesi, -7), addDaysISO(pazartesi, -1)]
  const satir = new Map<string, OzetSatiri>()
  for (const k of ogrenciKayitlari.flat()) {
    if (k.due_date === null || k.due_date < bas || k.due_date > son || k.status === null || k.status === 'mazeretli') continue
    const s = satir.get(k.id) ?? { id: k.id, subject: k.subject, title: k.title, due_date: k.due_date, toplam: 0, yapildi: 0, eksik: 0, yapilmadi: 0 }
    s.toplam++
    if (k.status === 'eksik') s.eksik++
    else if (k.status === 'yapilmadi') s.yapilmadi++
    else s.yapildi++ // yapildi + gec
    satir.set(k.id, s)
  }
  return [...satir.values()].sort((x, y) => x.due_date.localeCompare(y.due_date) || x.subject.localeCompare(y.subject, 'tr'))
}

export function veliMesaji(g: { ogrenciAdi: string; sinif: string; pazartesi: string; eksikler: Eksik[]; gunler: GunOdevleri[]; mentorAdi: string }): string {
  const gecen = haftaEtiketi(addDaysISO(g.pazartesi, -7)), bu = haftaEtiketi(g.pazartesi)
  const odevSatirlari = g.gunler.flatMap(d => d.odevler.map(o =>
    `• ${d.etiket === 'Hafta sonu' ? 'Hafta sonu' : `${d.etiket} ${gunAy(d.gun)}`} – ${dersKisa(o.subject)}: ${o.title}`))
  return [
    'Sayın Velimiz,',
    `*${g.ogrenciAdi}* (${g.sinif}) için haftalık ödev bilgilendirmesi:`,
    '',
    `*Geçen hafta (${gecen}) tamamlanmayan ödevler:*`,
    ...(g.eksikler.length
      ? g.eksikler.map(e => `• ${dersKisa(e.subject)} – ${e.title} (${gunAy(e.due_date)}): ${e.durum}`)
      : ['Kontrol edilen ödevlerin tamamını yaptı. Tebrikler! 👏']),
    '',
    `*Bu hafta (${bu}) kontrol edilecek ödevler:*`,
    ...(odevSatirlari.length ? odevSatirlari : ['Kontrol edilecek ödev yok.']),
    ...(g.eksikler.length ? ['', 'Eksik ödevlerin tamamlanması için desteğinizi rica ederiz.'] : []),
    '',
    'Saygılarımızla,',
    g.mentorAdi,
    `${g.sinif} Mentör Öğretmeni`,
  ].join('\n')
}

/** TR cep numarası → "90XXXXXXXXXX"; geçersizse null. */
export function telefonNormalize(tel: string | null): string | null {
  const d = (tel ?? '').replace(/\D/g, '')
  if (/^905\d{9}$/.test(d)) return d
  if (/^05\d{9}$/.test(d)) return `9${d}`
  if (/^5\d{9}$/.test(d)) return `90${d}`
  return null
}

/** wa.me linki; numara yoksa WhatsApp kişi seçtirir. */
export function whatsappLink(metin: string, tel: string | null): string {
  const no = telefonNormalize(tel)
  return `https://wa.me/${no ?? ''}?text=${encodeURIComponent(metin)}`
}

const KISA: Record<string, string> = { 'Türk Dili ve Edebiyatı': 'Edebiyat', 'Din Kültürü ve Ahlak Bilgisi': 'Din Kültürü' }
export const dersKisa = (s: string) => KISA[s] ?? s
const RENK: Record<string, string> = {
  Matematik: '#2F6FED', Geometri: '#5B4BDB', Fizik: '#E0662E', Kimya: '#14A38B', Biyoloji: '#4CA83A', Edebiyat: '#C2417A',
  Türkçe: '#C2417A', Tarih: '#A5672B', Coğrafya: '#2A9BC1', İngilizce: '#D2463F', Almanca: '#7A7F8C', Felsefe: '#8E5BB5',
}
export const dersRengi = (s: string) => RENK[dersKisa(s)] ?? '#7A7F8C'
export const kisalt = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/vitest/unit/mentor/bultenMath.test.ts`
Expected: PASS (tüm testler). Not: `whatsappLink` testinde `*` `encodeURIComponent` tarafından kodlanmaz — beklenen string buna göredir.

- [ ] **Step 5: Commit + push**

```bash
git add src/domains/mentor/lib/bultenMath.ts tests/vitest/unit/mentor/bultenMath.test.ts
git commit -m "feat(bulten): haftalık veli bülteni saf hesapları

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 2: BultenRepository + BultenService.getBulten

**Files:**
- Create: `src/domains/mentor/repositories/BultenRepository.ts`
- Create: `src/domains/mentor/services/BultenService.ts`
- Test: `tests/vitest/unit/mentor/bulten-service.test.ts`

**Interfaces:**
- Consumes: Task 1 tüm export'ları; `MentorService.getMyMentorships(): Promise<MentorshipRow[]>` (`student_id, full_name, class_name`); `HomeworkService.getMentorHomeworkProfiles(ids: string[], bas?: string)` → `{ error } | { ogrenciler: { id, full_name, class_id, class_name, homeworks: HomeworkRecord[] }[] }`; `getCurrentProfile()` → `{ id, full_name, subject, school_id, role }`.
- Produces:
  - `BultenRepository.ekBilgi(schoolId: string, studentIds: string[]): Promise<{ telefonlar: Map<string, string | null>; okulAdi: string; ogretmenAdlari: Map<string, string> }>`
  - `type BultenSinifi = { class_id: string; class_name: string; gunler: (GunOdevleri & { odevler: (GunOdevleri['odevler'][number] & { ogretmen: string })[] })[]; ozet: OzetSatiri[] }`
  - `type BultenOgrencisi = { student_id: string; full_name: string; class_id: string; class_name: string; eksikler: Eksik[]; telefon: string | null; mesaj: string }`
  - `type Bulten = { hafta: string; okulAdi: string; mentorAdi: string; mentorUnvani: string; siniflar: BultenSinifi[]; ogrenciler: BultenOgrencisi[] }`
  - `BultenService.getBulten(hafta: string): Promise<Bulten>` — `hafta` pazartesi değilse `Error('Geçersiz hafta')` fırlatır.

- [ ] **Step 1: Write the failing test**

```ts
// tests/vitest/unit/mentor/bulten-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { HomeworkRecord } from '@/src/domains/homework/lib/stats'

vi.mock('@/src/shared/authorization/server', () => ({ requireAbility: vi.fn().mockResolvedValue({ userId: 'm1', schoolId: 's1' }) }))
vi.mock('@/src/shared/auth', () => ({ getCurrentProfile: vi.fn() }))
vi.mock('@/src/domains/mentor/services/MentorService', () => ({ MentorService: { getMyMentorships: vi.fn() } }))
vi.mock('@/src/domains/homework/services/HomeworkService', () => ({ HomeworkService: { getMentorHomeworkProfiles: vi.fn() } }))
vi.mock('@/src/domains/mentor/repositories/BultenRepository', () => ({ BultenRepository: { ekBilgi: vi.fn() } }))

const { getCurrentProfile } = await import('@/src/shared/auth')
const { MentorService } = await import('@/src/domains/mentor/services/MentorService')
const { HomeworkService } = await import('@/src/domains/homework/services/HomeworkService')
const { BultenRepository } = await import('@/src/domains/mentor/repositories/BultenRepository')
const { BultenService } = await import('@/src/domains/mentor/services/BultenService')

const k = (o: Partial<HomeworkRecord>): HomeworkRecord => ({ id: 'h', title: 'T', subject: 'Fizik', due_date: '2026-10-07', status: null, note: null, teacher_id: 't1', bekliyor: false, ...o })

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockResolvedValue({ id: 'm1', full_name: 'Fevzi Coşkun', subject: 'Matematik', school_id: 's1', role: 'ogretmen' } as never)
  vi.mocked(MentorService.getMyMentorships).mockResolvedValue([
    { student_id: 'a', full_name: 'Ali', class_name: '9-A', last_report_date: null, idare_atadi: false },
    { student_id: 'b', full_name: 'Ayşe', class_name: '9-A', last_report_date: null, idare_atadi: false },
    { student_id: 'c', full_name: 'Can', class_name: '10-A', last_report_date: null, idare_atadi: false },
  ])
  vi.mocked(HomeworkService.getMentorHomeworkProfiles).mockResolvedValue({ ogrenciler: [
    // eski verilmiş (28 Eyl), geçen hafta kontrol (7 Ekim) — bas filtresi olsaydı düşerdi
    { id: 'a', full_name: 'Ali', student_number: null, class_id: 'c9', class_name: '9-A', stats: {} as never,
      homeworks: [k({ id: 'f1', status: 'yapilmadi' }), k({ id: 'n1', due_date: '2026-10-14', subject: 'Kimya' })] },
    { id: 'b', full_name: 'Ayşe', student_number: null, class_id: 'c9', class_name: '9-A', stats: {} as never,
      homeworks: [k({ id: 'f1', status: 'yapildi' }), k({ id: 'n1', due_date: '2026-10-14', subject: 'Kimya' })] },
    { id: 'c', full_name: 'Can', student_number: null, class_id: 'c10', class_name: '10-A', stats: {} as never,
      homeworks: [k({ id: 'g1', due_date: '2026-10-08', status: 'eksik', teacher_id: 't2' })] },
  ] })
  vi.mocked(BultenRepository.ekBilgi).mockResolvedValue({
    telefonlar: new Map([['a', '0532 123 45 67'], ['b', null], ['c', null]]),
    okulAdi: 'Bahçeşehir Koleji Denizli',
    ogretmenAdlari: new Map([['t1', 'Esra Ergün'], ['t2', 'Pınar Çaprak']]),
  })
})

describe('BultenService.getBulten', () => {
  it('pazartesi olmayan hafta reddedilir', async () => {
    await expect(BultenService.getBulten('2026-10-13')).rejects.toThrow('Geçersiz hafta')
  })

  it('ödev profilleri bas filtresi OLMADAN istenir (eski verilmiş ödev kaçmasın)', async () => {
    await BultenService.getBulten('2026-10-12')
    expect(HomeworkService.getMentorHomeworkProfiles).toHaveBeenCalledWith(['a', 'b', 'c'])
  })

  it('sınıf başına grup verisi, öğrenci başına mesaj', async () => {
    const b = await BultenService.getBulten('2026-10-12')
    expect(b.mentorUnvani).toBe('Matematik Öğretmeni Fevzi Coşkun')
    expect(b.okulAdi).toBe('Bahçeşehir Koleji Denizli')
    expect(b.siniflar.map(s => s.class_name)).toEqual(['9-A', '10-A'])   // numeric sıralama
    const s9 = b.siniflar.find(s => s.class_id === 'c9')!
    expect(s9.ozet).toEqual([expect.objectContaining({ id: 'f1', toplam: 2, yapildi: 1, yapilmadi: 1 })])
    expect(s9.gunler[2].odevler).toEqual([expect.objectContaining({ id: 'n1', ogretmen: 'Esra Ergün' })])
    const ali = b.ogrenciler.find(o => o.student_id === 'a')!
    expect(ali.eksikler.map(e => e.id)).toEqual(['f1'])
    expect(ali.telefon).toBe('0532 123 45 67')
    expect(ali.mesaj).toContain('*Ali* (9-A)')
    expect(b.ogrenciler.find(o => o.student_id === 'b')!.mesaj).toContain('Tebrikler')
  })

  it('mentörlükte öğrenci yoksa boş bülten, ödev servisi çağrılmaz', async () => {
    vi.mocked(MentorService.getMyMentorships).mockResolvedValue([])
    vi.mocked(HomeworkService.getMentorHomeworkProfiles).mockClear()
    const b = await BultenService.getBulten('2026-10-12')
    expect(b.ogrenciler).toEqual([]); expect(b.siniflar).toEqual([])
    expect(HomeworkService.getMentorHomeworkProfiles).not.toHaveBeenCalled()
  })

  it('ödev servisi hata dönerse fırlatır (sessiz boş bülten yok)', async () => {
    vi.mocked(HomeworkService.getMentorHomeworkProfiles).mockResolvedValue({ error: 'Bu işlem için yetkiniz yok.' })
    await expect(BultenService.getBulten('2026-10-12')).rejects.toThrow('yetkiniz yok')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/vitest/unit/mentor/bulten-service.test.ts`
Expected: FAIL — `BultenService` / `BultenRepository` modülü bulunamadı.

- [ ] **Step 3: Implement repository**

```ts
// src/domains/mentor/repositories/BultenRepository.ts
import { createClient } from '@/src/infrastructure/supabase/server'

export const BultenRepository = {
  /** Bülten için ek bilgiler: veli telefonları, okul adı, okul öğretmenlerinin adları. Hata = fırlat (sessiz boş yok). */
  async ekBilgi(schoolId: string, studentIds: string[]) {
    const db = await createClient()
    const [ogr, okul, ogretmen] = await Promise.all([
      db.from('students').select('id, veli_telefon').in('id', studentIds).eq('school_id', schoolId).is('deleted_at', null),
      db.from('schools').select('name').eq('id', schoolId).single(),
      db.from('profiles').select('id, full_name').eq('school_id', schoolId),
    ])
    for (const r of [ogr, okul, ogretmen]) if (r.error) throw new Error(r.error.message)
    return {
      telefonlar: new Map((ogr.data ?? []).map(s => [s.id, s.veli_telefon])),
      okulAdi: okul.data?.name ?? '',
      ogretmenAdlari: new Map((ogretmen.data ?? []).map(p => [p.id, p.full_name ?? ''])),
    }
  },
}
```

- [ ] **Step 4: Implement service**

```ts
// src/domains/mentor/services/BultenService.ts
import { requireAbility } from '@/src/shared/authorization/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { MentorService } from './MentorService'
import { HomeworkService } from '@/src/domains/homework/services/HomeworkService'
import { BultenRepository } from '../repositories/BultenRepository'
import {
  pazartesiMi, ogrenciEksikleri, haftaOdevleri, grupOzeti, veliMesaji, dersKisa,
  type Eksik, type GunOdevleri, type OzetSatiri,
} from '../lib/bultenMath'

export type BultenSinifi = {
  class_id: string; class_name: string
  gunler: (Omit<GunOdevleri, 'odevler'> & { odevler: (GunOdevleri['odevler'][number] & { ogretmen: string })[] })[]
  ozet: OzetSatiri[]
}
export type BultenOgrencisi = { student_id: string; full_name: string; class_id: string; class_name: string; eksikler: Eksik[]; telefon: string | null; mesaj: string }
export type Bulten = { hafta: string; okulAdi: string; mentorAdi: string; mentorUnvani: string; siniflar: BultenSinifi[]; ogrenciler: BultenOgrencisi[] }

export const BultenService = {
  /** Çağıranın mentörlük öğrencileri için haftalık bülten. Yetki yapısal: veri yalnız getMyMentorships'ten. */
  async getBulten(hafta: string): Promise<Bulten> {
    if (!pazartesiMi(hafta)) throw new Error('Geçersiz hafta')
    const ability = await requireAbility()
    const profil = await getCurrentProfile()
    const mentorAdi = profil?.full_name ?? ''
    const mentorUnvani = profil?.subject ? `${dersKisa(profil.subject)} Öğretmeni ${mentorAdi}` : mentorAdi
    const mentorluk = await MentorService.getMyMentorships()
    const bos: Bulten = { hafta, okulAdi: '', mentorAdi, mentorUnvani, siniflar: [], ogrenciler: [] }
    if (mentorluk.length === 0) return bos

    const ids = mentorluk.map(m => m.student_id)
    // bas YOK: o parametre assigned_date'e göre süzer; geçen hafta kontrol edilen eski ödevler kaçardı
    const profiller = await HomeworkService.getMentorHomeworkProfiles(ids)
    if ('error' in profiller) throw new Error(profiller.error)
    const ek = await BultenRepository.ekBilgi(ability.schoolId, ids)

    const sinifIdleri = [...new Set(profiller.ogrenciler.map(o => o.class_id))]
    const siniflar: BultenSinifi[] = sinifIdleri.map(cid => {
      const ogr = profiller.ogrenciler.filter(o => o.class_id === cid)
      return {
        class_id: cid,
        class_name: ogr[0].class_name ?? '—',
        gunler: haftaOdevleri(ogr[0].homeworks, hafta).map(g => ({
          ...g, odevler: g.odevler.map(o => ({ ...o, ogretmen: ek.ogretmenAdlari.get(o.teacher_id) ?? '' })),
        })),
        ozet: grupOzeti(ogr.map(o => o.homeworks), hafta),
      }
    }).sort((a, b) => a.class_name.localeCompare(b.class_name, 'tr', { numeric: true }))

    const ogrenciler = profiller.ogrenciler.map(o => {
      const eksikler = ogrenciEksikleri(o.homeworks, hafta)
      const sinifAdi = o.class_name ?? '—'
      return {
        student_id: o.id, full_name: o.full_name, class_id: o.class_id, class_name: sinifAdi, eksikler,
        telefon: ek.telefonlar.get(o.id) ?? null,
        mesaj: veliMesaji({ ogrenciAdi: o.full_name, sinif: sinifAdi, pazartesi: hafta, eksikler,
          gunler: haftaOdevleri(o.homeworks, hafta), mentorAdi }),
      }
    })
    return { ...bos, okulAdi: ek.okulAdi, siniflar, ogrenciler }
  },
}
```

Not: `haftaOdevleri(ogr[0].homeworks, …)` — aynı sınıftaki öğrencilerin ödev listesi aynıdır (`sinifOdevKayitlari` sınıf ödevlerinin tamamını her öğrenciye verir).

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/vitest/unit/mentor/bulten-service.test.ts && npx tsc --noEmit`
Expected: PASS; tsc 0 hata.

- [ ] **Step 6: Commit + push**

```bash
git add src/domains/mentor/repositories/BultenRepository.ts src/domains/mentor/services/BultenService.ts tests/vitest/unit/mentor/bulten-service.test.ts
git commit -m "feat(bulten): BultenService — mentörün öğrencileri için haftalık bülten modeli

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 3: Görsel şablonları + yazı tipi + `/api/bulten/gorsel`

**Files:**
- Create: `assets/fonts/BricolageGrotesque-Regular.ttf`, `assets/fonts/BricolageGrotesque-ExtraBold.ttf`, `assets/fonts/OFL.txt`
- Create: `src/domains/mentor/lib/bultenGorselleri.tsx`
- Create: `app/api/bulten/gorsel/route.tsx`
- Modify: `next.config.ts` (nextConfig nesnesine `outputFileTracingIncludes`)
- Test: `tests/vitest/unit/mentor/bulten-gorsel-route.test.ts`

**Interfaces:**
- Consumes: `BultenService.getBulten(hafta)` → `Bulten`; Task 1 `haftaEtiketi, gunAy, dersKisa, dersRengi, kisalt, addDaysISO`.
- Produces:
  - `gorselYuksekligi(tur: 'odevler' | 'ozet' | 'ogrenci', satir: { gunler?: number; odev?: number; eksik?: number; ozet?: number }): number`
  - `OdevlerGorseli({ sinif, bulten }: { sinif: BultenSinifi; bulten: Bulten })`, `OzetGorseli({ sinif, bulten })`, `OgrenciGorseli({ ogrenci, sinif, bulten })` — JSX (satori)
  - `GET /api/bulten/gorsel?tur=odevler|ozet&hafta=YYYY-MM-DD&sinif=<uuid>` ve `?tur=ogrenci&hafta=…&ogrenci=<uuid>` → `image/png`

- [ ] **Step 1: Download fonts (OFL) and verify Turkish glyphs**

```bash
mkdir -p assets/fonts
# Google Fonts css2 bilinmeyen UA'ya statik TTF URL'leri döner
for W in 400 800; do
  URL=$(curl -s "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@$W" | grep -o 'https://[^)]*\.ttf' | head -1)
  NAME=$([ $W = 400 ] && echo Regular || echo ExtraBold)
  curl -s -o assets/fonts/BricolageGrotesque-$NAME.ttf "$URL"
done
curl -s -o assets/fonts/OFL.txt https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/OFL.txt
ls -la assets/fonts
python -m pip install -q fonttools && python -c "
from fontTools.ttLib import TTFont
for f in ['Regular','ExtraBold']:
    cmap=TTFont(f'assets/fonts/BricolageGrotesque-{f}.ttf').getBestCmap()
    eksik=[c for c in 'ÇçĞğİıÖöŞşÜü–…•' if ord(c) not in cmap]
    print(f, 'eksik glif:', eksik or 'yok')"
```
Expected: iki TTF de var (her biri < 200 KB), `eksik glif: yok`. Eksik glif varsa DURDUR ve kullanıcıya bildir.

- [ ] **Step 2: Write the failing route test**

```ts
// tests/vitest/unit/mentor/bulten-gorsel-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/og', () => ({
  ImageResponse: class extends Response {
    constructor(_el: unknown, opt: { headers?: Record<string, string>; width?: number; height?: number }) {
      super('png', { headers: { 'content-type': 'image/png', ...(opt.headers ?? {}), 'x-h': String(opt.height) } })
    }
  },
}))
vi.mock('@/src/shared/authorization/server', () => ({ getAbility: vi.fn() }))
vi.mock('@/src/domains/mentor/services/BultenService', () => ({ BultenService: { getBulten: vi.fn() } }))
vi.mock('node:fs/promises', () => ({ readFile: vi.fn().mockResolvedValue(Buffer.from('font')) }))

const { getAbility } = await import('@/src/shared/authorization/server')
const { BultenService } = await import('@/src/domains/mentor/services/BultenService')
const { GET } = await import('@/app/api/bulten/gorsel/route')
const { gorselYuksekligi } = await import('@/src/domains/mentor/lib/bultenGorselleri')

const SINIF = '11111111-1111-4111-8111-111111111111'
const OGR = '22222222-2222-4222-8222-222222222222'
const YABANCI = '33333333-3333-4333-8333-333333333333'
const istek = (q: string) => GET(new Request(`http://x/api/bulten/gorsel?${q}`) as never)
const bulten = {
  hafta: '2026-10-12', okulAdi: 'Okul', mentorAdi: 'M', mentorUnvani: 'Matematik Öğretmeni M',
  siniflar: [{ class_id: SINIF, class_name: '9-A', gunler: [], ozet: [] }],
  ogrenciler: [{ student_id: OGR, full_name: 'Ali', class_id: SINIF, class_name: '9-A', eksikler: [], telefon: null, mesaj: '' }],
}

beforeEach(() => {
  vi.mocked(getAbility).mockResolvedValue({ cannot: () => false } as never)
  vi.mocked(BultenService.getBulten).mockResolvedValue(bulten as never)
})

describe('GET /api/bulten/gorsel', () => {
  it('girişsiz → 401', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    expect((await istek(`tur=odevler&hafta=2026-10-12&sinif=${SINIF}`)).status).toBe(401)
  })
  it('ödev okuma yetkisi yok → 403', async () => {
    vi.mocked(getAbility).mockResolvedValue({ cannot: () => true } as never)
    expect((await istek(`tur=odevler&hafta=2026-10-12&sinif=${SINIF}`)).status).toBe(403)
  })
  it.each([
    'tur=odevler&hafta=2026-10-13&sinif=' + SINIF,   // pazartesi değil
    'tur=xxx&hafta=2026-10-12&sinif=' + SINIF,
    'tur=odevler&hafta=2026-10-12&sinif=abc',
    'tur=ogrenci&hafta=2026-10-12',                  // ogrenci eksik
  ])('geçersiz parametre → 400 (%s)', async q => expect((await istek(q)).status).toBe(400))
  it('mentörün olmayan öğrencisi → 403', async () => {
    expect((await istek(`tur=ogrenci&hafta=2026-10-12&ogrenci=${YABANCI}`)).status).toBe(403)
  })
  it('mentörün öğrencisi olmayan sınıf → 403', async () => {
    expect((await istek(`tur=ozet&hafta=2026-10-12&sinif=${YABANCI}`)).status).toBe(403)
  })
  it.each([`tur=odevler&hafta=2026-10-12&sinif=${SINIF}`, `tur=ozet&hafta=2026-10-12&sinif=${SINIF}`, `tur=ogrenci&hafta=2026-10-12&ogrenci=${OGR}`])
  ('geçerli → 200 png, önbelleksiz (%s)', async q => {
    const r = await istek(q)
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('image/png')
    expect(r.headers.get('cache-control')).toBe('private, no-store')
  })
})

describe('gorselYuksekligi', () => {
  it('satır arttıkça büyür, alt sınır var', () => {
    expect(gorselYuksekligi('odevler', { gunler: 5, odev: 0 })).toBeGreaterThan(600)
    expect(gorselYuksekligi('odevler', { gunler: 5, odev: 12 })).toBeGreaterThan(gorselYuksekligi('odevler', { gunler: 5, odev: 2 }))
    expect(gorselYuksekligi('ogrenci', { eksik: 7, gunler: 3, odev: 6 })).toBeGreaterThan(gorselYuksekligi('ogrenci', { eksik: 0, gunler: 3, odev: 6 }))
  })
})
```

- [ ] **Step 3: Run to verify fail**

Run: `npx vitest run tests/vitest/unit/mentor/bulten-gorsel-route.test.ts`
Expected: FAIL — route modülü yok.

- [ ] **Step 4: Implement templates**

Satori kuralları: çok çocuklu her `div` `display: 'flex'`; grid yok; metin `<span>`/`<div>` içinde. Ölçüler 2x (1080 genişlik).

```tsx
// src/domains/mentor/lib/bultenGorselleri.tsx
// next/og (Satori) şablonları — yalnız flexbox. Ölçüler 1080px genişlik için.
import { addDaysISO } from '@/src/shared/date'
import { haftaEtiketi, gunAy, dersKisa, dersRengi, kisalt } from './bultenMath'
import type { Bulten, BultenSinifi, BultenOgrencisi } from '../services/BultenService'

const C = { ink: '#1D2B5F', soft: '#5A6485', rule: '#DCE3F0', sun: '#FFD23F', wash: '#F5F7FC', ok: '#2E9E6B', eks: '#F2B233', yok: '#D9534F' }
const BASLIK = 300, ALT = 110, GUN_BOS = 104, ODEV = 92, EKSIK = 112, OZET = 128, BOLUM = 96

export function gorselYuksekligi(tur: 'odevler' | 'ozet' | 'ogrenci', s: { gunler?: number; odev?: number; eksik?: number; ozet?: number }): number {
  const odevler = (s.gunler ?? 0) * 34 + Math.max((s.gunler ?? 0) * GUN_BOS, (s.odev ?? 0) * ODEV + (s.gunler ?? 0) * 34)
  if (tur === 'odevler') return Math.max(700, BASLIK + odevler + ALT)
  if (tur === 'ozet') return Math.max(600, BASLIK + (s.ozet ?? 0) * OZET + 240 + ALT)
  return Math.max(800, BASLIK + BOLUM * 2 + Math.max(1, s.eksik ?? 0) * EKSIK + odevler + ALT)
}

const Baslik = ({ sinif, ust, alt }: { sinif: string; ust: string; alt: string[] }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 32, borderBottom: `6px solid ${C.ink}` }}>
    <div style={{ display: 'flex', fontSize: 156, fontWeight: 800, lineHeight: 0.82, letterSpacing: -4, padding: '0 8px',
      backgroundImage: `linear-gradient(transparent 58%, ${C.sun} 58%)` }}>{sinif}</div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <div style={{ fontSize: 44, fontWeight: 800 }}>{ust}</div>
      {alt.map(a => <div key={a} style={{ fontSize: 30, color: C.soft }}>{a}</div>)}
    </div>
  </div>
)
const Alt = ({ okul }: { okul: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, fontSize: 25, color: C.soft }}>
    <span>{okul}</span><span>EduDesk</span>
  </div>
)
const Kart = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '60px 60px 44px', background: '#fff', color: C.ink, fontFamily: 'Bricolage' }}>{children}</div>
)
const DersSatiri = ({ subject, title, alt }: { subject: string; title: string; alt?: string }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', padding: '6px 0' }}>
    <div style={{ width: 20, height: 20, borderRadius: 10, background: dersRengi(subject), marginTop: 12, marginRight: 20 }} />
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', fontSize: 34 }}>
        <span style={{ fontWeight: 800, color: dersRengi(subject), marginRight: 10 }}>{dersKisa(subject)}</span>
        <span>{kisalt(title, 44)}</span>
      </div>
      {alt ? <div style={{ fontSize: 25, color: C.soft }}>{alt}</div> : null}
    </div>
  </div>
)
const Gunler = ({ sinif, ogretmenli }: { sinif: BultenSinifi; ogretmenli: boolean }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    {sinif.gunler.map(g => (
      <div key={g.gun + g.etiket} style={{ display: 'flex', borderBottom: `2px solid ${C.rule}`, padding: '24px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 208 }}>
          <span style={{ fontSize: 32, fontWeight: 800 }}>{g.etiket}</span>
          {g.etiket !== 'Hafta sonu' ? <span style={{ fontSize: 26, color: C.soft }}>{gunAy(g.gun)}</span> : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {g.odevler.length
            ? g.odevler.map(o => <DersSatiri key={o.id} subject={o.subject} title={o.title} alt={ogretmenli ? o.ogretmen : undefined} />)
            : <span style={{ fontSize: 28, color: '#A2A9BF', paddingTop: 4 }}>Kontrol edilecek ödev yok</span>}
        </div>
      </div>
    ))}
  </div>
)

export const OdevlerGorseli = ({ sinif, bulten }: { sinif: BultenSinifi; bulten: Bulten }) => (
  <Kart>
    <Baslik sinif={sinif.class_name} ust="Haftanın ödevleri" alt={[`${haftaEtiketi(bulten.hafta)} · kontrol günlerine göre`]} />
    <Gunler sinif={sinif} ogretmenli />
    <Alt okul={bulten.okulAdi} />
  </Kart>
)

export const OzetGorseli = ({ sinif, bulten }: { sinif: BultenSinifi; bulten: Bulten }) => (
  <Kart>
    <Baslik sinif={sinif.class_name} ust="Geçen haftanın ödevleri" alt={[haftaEtiketi(addDaysISO(bulten.hafta, -7)), bulten.mentorUnvani]} />
    {sinif.ozet.length === 0
      ? <div style={{ fontSize: 30, color: C.soft, padding: '32px 0' }}>Geçen hafta kontrol edilen ödev yok</div>
      : sinif.ozet.map(o => (
        <div key={o.id} style={{ display: 'flex', flexDirection: 'column', padding: '22px 0', borderBottom: `2px solid ${C.rule}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ display: 'flex', fontSize: 32 }}>
              <span style={{ fontWeight: 800, color: dersRengi(o.subject), marginRight: 10 }}>{dersKisa(o.subject)}</span>
              <span>{kisalt(o.title, 34)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span style={{ fontSize: 32, fontWeight: 800 }}>{`${o.yapildi}/${o.toplam}`}</span>
              <span style={{ fontSize: 25, color: C.soft, marginLeft: 8 }}>tamamladı</span>
            </div>
          </div>
          <div style={{ display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden', background: C.rule, marginTop: 14 }}>
            <div style={{ width: `${(100 * o.yapildi) / o.toplam}%`, background: C.ok }} />
            <div style={{ width: `${(100 * o.eksik) / o.toplam}%`, background: C.eks }} />
            <div style={{ width: `${(100 * o.yapilmadi) / o.toplam}%`, background: C.yok }} />
          </div>
        </div>
      ))}
    <div style={{ display: 'flex', gap: 32, fontSize: 25, color: C.soft, marginTop: 28 }}>
      {([['Yapıldı', C.ok], ['Eksik', C.eks], ['Yapılmadı', C.yok]] as const).map(([t, r]) => (
        <div key={t} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 20, height: 20, borderRadius: 4, background: r, marginRight: 10 }} /><span>{t}</span>
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', marginTop: 28, background: C.wash, borderLeft: `8px solid ${C.sun}`, padding: '22px 26px', fontSize: 29 }}>
      Öğrencinizin eksik ödevleri size ayrıca, kişisel mesajla iletilecektir.
    </div>
    <Alt okul={bulten.okulAdi} />
  </Kart>
)

export const OgrenciGorseli = ({ ogrenci, sinif, bulten }: { ogrenci: BultenOgrencisi; sinif: BultenSinifi; bulten: Bulten }) => {
  const bolum = (t: string, a: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '36px 0 8px' }}>
      <span style={{ fontSize: 34, fontWeight: 800 }}>{t}</span><span style={{ fontSize: 26, color: C.soft }}>{a}</span>
    </div>
  )
  return (
    <Kart>
      <Baslik sinif={ogrenci.class_name} ust={ogrenci.full_name} alt={['Haftalık ödev bilgilendirmesi']} />
      {bolum('Geçen hafta tamamlanmayanlar', haftaEtiketi(addDaysISO(bulten.hafta, -7)))}
      {ogrenci.eksikler.length === 0
        ? <div style={{ display: 'flex', background: C.wash, borderLeft: `8px solid ${C.ok}`, padding: '22px 26px', fontSize: 29 }}>Kontrol edilen ödevlerin tamamını yaptı. Tebrikler!</div>
        : ogrenci.eksikler.map(e => (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: `2px solid ${C.rule}` }}>
            <DersSatiri subject={e.subject} title={e.title} alt={`${gunAy(e.due_date)} kontrolü`} />
            <span style={{ fontSize: 25, fontWeight: 600, padding: '4px 18px', borderRadius: 20, marginTop: 8,
              background: e.durum === 'eksik' ? '#FFF1CC' : '#FBE1E0', color: e.durum === 'eksik' ? '#8A5A00' : '#A12A26' }}>{e.durum}</span>
          </div>
        ))}
      {bolum('Bu hafta kontrol edilecek ödevler', haftaEtiketi(bulten.hafta))}
      <Gunler sinif={{ ...sinif, gunler: sinif.gunler.filter(g => g.odevler.length) }} ogretmenli={false} />
      <Alt okul={bulten.okulAdi} />
    </Kart>
  )
}
```

- [ ] **Step 5: Implement route**

```tsx
// app/api/bulten/gorsel/route.tsx
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import { BultenService } from '@/src/domains/mentor/services/BultenService'
import { pazartesiMi } from '@/src/domains/mentor/lib/bultenMath'
import { OdevlerGorseli, OzetGorseli, OgrenciGorseli, gorselYuksekligi } from '@/src/domains/mentor/lib/bultenGorselleri'
import { logger } from '@/src/infrastructure/observability/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const hafta = z.string().refine(pazartesiMi)
const Sorgu = z.discriminatedUnion('tur', [
  z.object({ tur: z.enum(['odevler', 'ozet']), hafta, sinif: z.string().uuid() }),
  z.object({ tur: z.literal('ogrenci'), hafta, ogrenci: z.string().uuid() }),
])
const BASLIKLAR = { 'Cache-Control': 'private, no-store' }
const font = (ad: string) => readFile(path.join(process.cwd(), 'assets/fonts', ad))

export async function GET(req: Request) {
  const ability = await getAbility()
  if (!ability) return Response.json({ error: 'Giriş gerekli' }, { status: 401 })
  if (ability.cannot(P.HOMEWORK.READ)) return Response.json({ error: 'Yetki yok' }, { status: 403 })
  const q = Sorgu.safeParse(Object.fromEntries(new URL(req.url).searchParams))
  if (!q.success) return Response.json({ error: 'Geçersiz parametre' }, { status: 400 })

  try {
    const bulten = await BultenService.getBulten(q.data.hafta)
    let el: React.ReactElement, height: number
    if (q.data.tur === 'ogrenci') {
      const ogrenciId = q.data.ogrenci
      const ogrenci = bulten.ogrenciler.find(o => o.student_id === ogrenciId)
      if (!ogrenci) return Response.json({ error: 'Yetki yok' }, { status: 403 })
      const sinif = bulten.siniflar.find(s => s.class_id === ogrenci.class_id)!
      const dolu = sinif.gunler.filter(g => g.odevler.length)
      el = <OgrenciGorseli ogrenci={ogrenci} sinif={sinif} bulten={bulten} />
      height = gorselYuksekligi('ogrenci', { eksik: ogrenci.eksikler.length, gunler: dolu.length, odev: dolu.reduce((a, g) => a + g.odevler.length, 0) })
    } else {
      const sinifId = q.data.sinif
      const sinif = bulten.siniflar.find(s => s.class_id === sinifId)
      if (!sinif) return Response.json({ error: 'Yetki yok' }, { status: 403 })
      el = q.data.tur === 'odevler' ? <OdevlerGorseli sinif={sinif} bulten={bulten} /> : <OzetGorseli sinif={sinif} bulten={bulten} />
      height = q.data.tur === 'odevler'
        ? gorselYuksekligi('odevler', { gunler: sinif.gunler.length, odev: sinif.gunler.reduce((a, g) => a + g.odevler.length, 0) })
        : gorselYuksekligi('ozet', { ozet: sinif.ozet.length })
    }
    const [normal, kalin] = await Promise.all([font('BricolageGrotesque-Regular.ttf'), font('BricolageGrotesque-ExtraBold.ttf')])
    return new ImageResponse(el, {
      width: 1080, height, headers: BASLIKLAR,
      fonts: [{ name: 'Bricolage', data: normal, weight: 400, style: 'normal' }, { name: 'Bricolage', data: kalin, weight: 800, style: 'normal' }],
    })
  } catch (e) {
    logger.error({ event: 'bulten_gorsel_hatasi', err: e instanceof Error ? e.message : String(e) }, 'Bülten görseli üretilemedi')
    return Response.json({ error: 'Görsel oluşturulamadı' }, { status: 500 })
  }
}
```

Not: `fontWeight: 600` olan etiket için ayrı 600 dosyası yok; satori en yakın ağırlığı (800) kullanır — kabul.

- [ ] **Step 6: Font tracing in next.config.ts**

`nextConfig` nesnesine (`serverExternalPackages`'tan sonra) ekle:

```ts
  // Bülten görseli yazı tiplerini fs ile okur — Vercel paketine dahil edilmeli
  outputFileTracingIncludes: {
    '/api/bulten/gorsel': ['./assets/fonts/**'],
  },
```

- [ ] **Step 7: Run tests + typecheck**

Run: `npx vitest run tests/vitest/unit/mentor && npx tsc --noEmit`
Expected: PASS; tsc 0 hata.

- [ ] **Step 8: Real render smoke (no mock)**

Run: `npm run dev` (webpack; Turbopack YASAK) arka planda, sonra tarayıcıda giriş yapılmış mentör hesabıyla (ör. Fevzi) `http://localhost:3000/api/bulten/gorsel?tur=ogrenci&hafta=2026-10-12&ogrenci=<İdo Elçiçek id: 7047824b-b8e3-44ca-932f-cc1e1f9acf1c>` aç.
Expected: PNG; Türkçe karakterler (İ, ş, ğ, ı) doğru; içerik prototiple aynı (İdo: 7 eksik). Ekran görüntüsünü al ve kontrol et; taşma/kesilme varsa `gorselYuksekligi` sabitlerini ayarla.

- [ ] **Step 9: Commit + push**

```bash
git add assets/fonts src/domains/mentor/lib/bultenGorselleri.tsx app/api/bulten/gorsel/route.tsx next.config.ts tests/vitest/unit/mentor/bulten-gorsel-route.test.ts
git commit -m "feat(bulten): sunucuda PNG görseller (next/og) + yetkili /api/bulten/gorsel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 4: `/mentorluk/bulten` sayfası + paylaşım istemcisi + link

**Files:**
- Create: `app/(dashboard)/mentorluk/bulten/page.tsx`
- Create: `app/(dashboard)/mentorluk/bulten/BultenIstemci.tsx`
- Modify: `app/(dashboard)/mentorluk/page.tsx` (~satır 79-82, "Hepsini yazdır" linkinin yanına)

**Interfaces:**
- Consumes: `BultenService.getBulten(hafta): Promise<Bulten>`; Task 1 `haftaSec, pazartesiMi, haftaEtiketi, whatsappLink`; `addDaysISO`, `todayLocalISO` (`@/src/shared/date`); `getCurrentProfile`, `isTeachingRole`, `yazdirmaBasligi` (mevcut, `/mentorluk/yazdir/page.tsx` ile aynı importlar).
- Produces: sayfa URL'i `/mentorluk/bulten?hafta=YYYY-MM-DD`; DOM: başlık "Haftalık veli bülteni", her öğrenci için `<details>` ve içinde düğmeler: "Paylaş" (yalnız destekleniyorsa), "WhatsApp'ta aç", "Kopyala", "Görseli indir", "Gönderildi" onay kutusu.

- [ ] **Step 1: Server page**

```tsx
// app/(dashboard)/mentorluk/bulten/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { yazdirmaBasligi } from '@/src/shared/utils'
import { todayLocalISO, addDaysISO } from '@/src/shared/date'
import { BultenService } from '@/src/domains/mentor/services/BultenService'
import { haftaSec, pazartesiMi, haftaEtiketi, whatsappLink } from '@/src/domains/mentor/lib/bultenMath'
import BultenIstemci from './BultenIstemci'

export const metadata = { title: yazdirmaBasligi('Haftalık Veli Bülteni') }

const ikincil = 'inline-flex items-center justify-center min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-slate-700 text-sm text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-500'

export default async function BultenPage({ searchParams }: { searchParams: Promise<{ hafta?: string | string[] }> }) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id || !isTeachingRole(profile.role)) redirect('/anasayfa')
  const istenen = (await searchParams).hafta
  const hafta = typeof istenen === 'string' && pazartesiMi(istenen) ? istenen : haftaSec(todayLocalISO())
  const b = await BultenService.getBulten(hafta)
  const eksikli = b.ogrenciler.filter(o => o.eksikler.length).length
  const gorsel = (q: string) => `/api/bulten/gorsel?${q}&hafta=${hafta}`

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <Link href="/mentorluk" className="text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600">← Mentörlüğüm</Link>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-1 mb-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Haftalık veli bülteni</h1>
        <nav aria-label="Hafta" className="flex items-center gap-2">
          <Link href={`/mentorluk/bulten?hafta=${addDaysISO(hafta, -7)}`} className={ikincil} aria-label="Önceki hafta">‹</Link>
          <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 min-w-[7rem] text-center">{haftaEtiketi(hafta)}</span>
          <Link href={`/mentorluk/bulten?hafta=${addDaysISO(hafta, 7)}`} className={ikincil} aria-label="Sonraki hafta">›</Link>
        </nav>
      </div>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
        Geçen hafta {haftaEtiketi(addDaysISO(hafta, -7))} · {b.ogrenciler.length} öğrenci · {eksikli} öğrencinin eksiği var
      </p>

      {b.ogrenciler.length === 0 ? (
        <div className="text-center border border-dashed border-gray-200 dark:border-slate-700 rounded-2xl p-8">
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">Mentörlüğünüzde öğrenci yok</p>
          <Link href="/mentorluk" className={`${ikincil} mt-3`}>Mentörlüğüme öğrenci ekle</Link>
        </div>
      ) : (
        <BultenIstemci
          hafta={hafta}
          gruplar={b.siniflar.map(s => ({
            class_name: s.class_name,
            odevlerUrl: gorsel(`tur=odevler&sinif=${s.class_id}`),
            ozetUrl: gorsel(`tur=ozet&sinif=${s.class_id}`),
          }))}
          ogrenciler={b.ogrenciler.map(o => ({
            student_id: o.student_id, full_name: o.full_name, class_name: o.class_name, eksikSayisi: o.eksikler.length,
            mesaj: o.mesaj, whatsapp: whatsappLink(o.mesaj, o.telefon), gorselUrl: gorsel(`tur=ogrenci&ogrenci=${o.student_id}`),
          }))}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Client component**

```tsx
// app/(dashboard)/mentorluk/bulten/BultenIstemci.tsx
'use client'
import { useEffect, useState } from 'react'

type Grup = { class_name: string; odevlerUrl: string; ozetUrl: string }
type Ogr = { student_id: string; full_name: string; class_name: string; eksikSayisi: number; mesaj: string; whatsapp: string; gorselUrl: string }

const dugme = 'inline-flex items-center justify-center min-h-[44px] px-3 rounded-xl border border-gray-200 dark:border-slate-700 text-sm text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-500'
const ana = 'inline-flex items-center justify-center min-h-[44px] px-3 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700'

const anahtar = (hafta: string, id: string) => `bulten:${hafta}:${id}`
function gonderildiOku(hafta: string, id: string): boolean {
  try { return localStorage.getItem(anahtar(hafta, id)) === '1' } catch { return false } // gizli sekme / engelli depolama
}
function gonderildiYaz(hafta: string, id: string, v: boolean) {
  try { if (v) localStorage.setItem(anahtar(hafta, id), '1'); else localStorage.removeItem(anahtar(hafta, id)) } catch { /* yok say */ }
}

async function pngDosyasi(url: string, ad: string): Promise<File> {
  const r = await fetch(url)
  if (!r.ok) throw new Error('Görsel oluşturulamadı')
  return new File([await r.blob()], `${ad}.png`, { type: 'image/png' })
}

function Gorsel({ url, alt }: { url: string; alt: string }) {
  const [hata, setHata] = useState(false)
  return hata
    ? <p role="status" className="text-sm text-gray-500 dark:text-slate-400 p-4 border border-dashed rounded-xl">Görsel oluşturulamadı</p>
    : <img src={url} alt={alt} loading="lazy" onError={() => setHata(true)} className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white" />
}

function PaylasIndir({ url, ad, metin }: { url: string; ad: string; metin?: string }) {
  const [paylasilir, setPaylasilir] = useState(false)
  const [durum, setDurum] = useState('')
  useEffect(() => {
    const deneme = new File([''], 'x.png', { type: 'image/png' })
    setPaylasilir(typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [deneme] }))
  }, [])
  return (
    <>
      {paylasilir && (
        <button type="button" className={ana} onClick={async () => {
          try { await navigator.share({ files: [await pngDosyasi(url, ad)], ...(metin ? { text: metin } : {}) }) }
          catch (e) { if ((e as Error).name !== 'AbortError') setDurum('Paylaşılamadı, Görseli indir ile deneyin') }
        }}>Paylaş</button>
      )}
      <a className={dugme} href={url} download={`${ad}.png`}>Görseli indir</a>
      {durum && <span role="status" className="text-sm text-red-600 dark:text-red-400">{durum}</span>}
    </>
  )
}

export default function BultenIstemci({ hafta, gruplar, ogrenciler }: { hafta: string; gruplar: Grup[]; ogrenciler: Ogr[] }) {
  const [gonderildi, setGonderildi] = useState<Record<string, boolean>>({})
  const [kopyalandi, setKopyalandi] = useState('')
  useEffect(() => { setGonderildi(Object.fromEntries(ogrenciler.map(o => [o.student_id, gonderildiOku(hafta, o.student_id)]))) }, [hafta, ogrenciler])
  const isaretle = (id: string, v: boolean) => { gonderildiYaz(hafta, id, v); setGonderildi(g => ({ ...g, [id]: v })) }

  return (
    <div className="space-y-8">
      <section aria-labelledby="grup-baslik">
        <h2 id="grup-baslik" className="text-base font-bold text-gray-900 dark:text-slate-100 mb-1">Veli grubu için</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">Bu görseller isim içermez; sınıf veli grubunda paylaşılabilir.</p>
        {gruplar.map(g => (
          <div key={g.class_name} className="grid gap-4 sm:grid-cols-2 mb-4">
            {[['Bu haftanın ödevleri', g.odevlerUrl], ['Geçen haftanın özeti', g.ozetUrl]].map(([baslik, url]) => (
              <figure key={url} className="space-y-2">
                <figcaption className="text-sm font-semibold text-gray-700 dark:text-slate-300">{g.class_name} · {baslik}</figcaption>
                <Gorsel url={url} alt={`${g.class_name} ${baslik}`} />
                <div className="flex flex-wrap gap-2"><PaylasIndir url={url} ad={`${g.class_name} ${baslik}`} /></div>
              </figure>
            ))}
          </div>
        ))}
      </section>

      <section aria-labelledby="veli-baslik">
        <h2 id="veli-baslik" className="text-base font-bold text-gray-900 dark:text-slate-100 mb-1">Velilere kişisel mesaj</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">
          {Object.values(gonderildi).filter(Boolean).length}/{ogrenciler.length} gönderildi olarak işaretli (yalnız bu cihazda).
        </p>
        <ul className="divide-y divide-gray-200 dark:divide-slate-700 border border-gray-200 dark:border-slate-700 rounded-2xl">
          {ogrenciler.map(o => (
            <li key={o.student_id}>
              <details className="group">
                <summary className="flex items-center justify-between gap-3 min-h-[44px] px-4 py-2 cursor-pointer">
                  <span className="font-medium text-gray-900 dark:text-slate-100">
                    {o.full_name} <span className="text-sm text-gray-500 dark:text-slate-400">· {o.class_name}</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm">
                    <span className={o.eksikSayisi ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}>
                      {o.eksikSayisi ? `${o.eksikSayisi} eksik` : 'tebrik'}
                    </span>
                    {gonderildi[o.student_id] && <span className="text-green-700 dark:text-green-400">✓ Gönderildi</span>}
                  </span>
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-xl p-3 font-sans">{o.mesaj}</pre>
                  <Gorsel url={o.gorselUrl} alt={`${o.full_name} haftalık ödev kartı`} />
                  <div className="flex flex-wrap gap-2 items-center">
                    <PaylasIndir url={o.gorselUrl} ad={o.full_name} metin={o.mesaj} />
                    <a className={dugme} href={o.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp&apos;ta aç</a>
                    <button type="button" className={dugme} onClick={async () => {
                      try { await navigator.clipboard.writeText(o.mesaj); setKopyalandi(o.student_id) } catch { setKopyalandi('') }
                    }}>{kopyalandi === o.student_id ? 'Kopyalandı' : 'Kopyala'}</button>
                    <label className="inline-flex items-center gap-2 min-h-[44px] text-sm text-gray-700 dark:text-slate-300">
                      <input type="checkbox" className="w-5 h-5" checked={!!gonderildi[o.student_id]} onChange={e => isaretle(o.student_id, e.target.checked)} />
                      Gönderildi
                    </label>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Link in /mentorluk**

`app/(dashboard)/mentorluk/page.tsx` içinde:
```tsx
            <Link href={`/mentorluk/yazdir?bas=${bas}`} className={ikincilButon}>Hepsini yazdır</Link>
```
satırının ALTINA ekle:
```tsx
            <Link href="/mentorluk/bulten" className={ikincilButon}>Haftalık veli bülteni</Link>
```

- [ ] **Step 4: Typecheck + lint + unit**

Run: `npx tsc --noEmit && npm run lint -- --quiet && npx vitest run --project unit`
Expected: tsc 0, lint 0 hata, tüm unit testler PASS (sayıyı kaydet).

- [ ] **Step 5: Manual check in browser**

`npm run dev` (webpack) → Fevzi hesabıyla `http://localhost:3000/mentorluk/bulten?hafta=2026-10-12`.
Expected: 9 öğrenci, "7 öğrencinin eksiği var"; 2 grup görseli yüklenir; İdo Elçiçek satırı açılınca 7 eksik + görsel; Kopyala "Kopyalandı" olur; Gönderildi işaretlenince sayaç artar ve yenilemede kalır; dar ekranda (375px) yatay kaydırma yok; karanlık temada okunur.

- [ ] **Step 6: Commit + push**

```bash
git add "app/(dashboard)/mentorluk/bulten" "app/(dashboard)/mentorluk/page.tsx"
git commit -m "feat(bulten): /mentorluk/bulten — veli mesajı, görseller, paylaş/kopyala/WhatsApp

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 5: E2E + canlı doğrulama

**Files:**
- Create: `tests/playwright/e2e/veli-bulteni.spec.ts`

**Interfaces:**
- Consumes: `tests/playwright/.auth/ogretmen.json` (mevcut setup); `/mentorluk` "+ Öğrenci ekle" akışı (`mentorluk.spec.ts` deseni); sayfa DOM'u Task 4.

- [ ] **Step 1: Write e2e**

```ts
// tests/playwright/e2e/veli-bulteni.spec.ts
import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

test.describe('Haftalık veli bülteni', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('mentörlükten bültene gidilir; öğrenci mesajı, görsel ve kopyala çalışır', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    // Kendi verisini üretir: bir öğrenciyi mentörlüğe ekler (mentorluk.spec.ts deseni)
    await page.goto('/mentorluk')
    await page.getByRole('button', { name: '+ Öğrenci ekle' }).click()
    const ilk = page.locator('ul button').first()
    await expect(ilk).toBeVisible()
    const ad = (await ilk.locator('span').first().textContent())?.trim() ?? ''
    await ilk.click()
    await expect(page.locator('table').getByRole('link', { name: new RegExp(ad) })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('link', { name: 'Haftalık veli bülteni' }).click()
    await expect(page.getByRole('heading', { name: 'Haftalık veli bülteni' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Veli grubu için' })).toBeVisible()

    const satir = page.locator('details', { hasText: ad })
    await satir.locator('summary').click()
    await expect(satir.locator('pre')).toContainText(`*${ad}*`)
    await expect(satir.locator('pre')).toContainText('Mentör Öğretmeni')
    await satir.getByRole('button', { name: 'Kopyala' }).click()
    await expect(satir.getByRole('button', { name: 'Kopyalandı' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(ad)

    const url = await satir.getByRole('link', { name: 'Görseli indir' }).getAttribute('href')
    const r = await page.request.get(url!)
    expect(r.status()).toBe(200)
    expect(r.headers()['content-type']).toBe('image/png')
    expect(r.headers()['cache-control']).toBe('private, no-store')

    await satir.getByLabel('Gönderildi').check()
    await page.reload()
    await expect(page.locator('details', { hasText: ad }).getByText('✓ Gönderildi')).toBeVisible()

    // Temizlik: öğrenciyi mentörlükten çıkar
    await page.goto('/mentorluk')
    await page.locator('table').getByRole('link', { name: new RegExp(ad) }).click()
    await page.getByRole('button', { name: 'Listeden çıkar' }).click()
    await page.getByRole('button', { name: 'Çıkar' }).click()
    await expect(page).toHaveURL(/\/mentorluk$/, { timeout: 10_000 })
  })

  test('başka öğretmenin öğrencisinin görseli 403', async ({ page }) => {
    const r = await page.request.get('/api/bulten/gorsel?tur=ogrenci&hafta=2026-10-12&ogrenci=00000000-0000-4000-8000-000000000000')
    expect(r.status()).toBe(403)
  })

  test('pazartesi olmayan hafta 400', async ({ page }) => {
    const r = await page.request.get('/api/bulten/gorsel?tur=odevler&hafta=2026-10-13&sinif=00000000-0000-4000-8000-000000000000')
    expect(r.status()).toBe(400)
  })
})
```

- [ ] **Step 2: Run e2e (this spec, then full suite)**

Run: `npx playwright test tests/playwright/e2e/veli-bulteni.spec.ts` sonra `npx playwright test`
Expected: yeni spec 3/3 PASS; tüm e2e PASS (sayıyı kaydet; önceki 132'ye +3 = 135 beklenir).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exit 0; route listesinde `/api/bulten/gorsel` ve `/mentorluk/bulten` var.

- [ ] **Step 4: Commit + push (deploy)**

```bash
git add tests/playwright/e2e/veli-bulteni.spec.ts
git commit -m "test(e2e): haftalık veli bülteni akışı ve görsel yetkisi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 5: Live verification (two layers)**

1. **DB:** Supabase'de 9-A hafta 2026-10-12 için mentör bazlı özet sorgusu (prototipte kullanılan) — Fevzi grubu Fizik 4/9, Kimya ORBİTAL 6/9; Yasemin grubu Fizik 10/13.
2. **UI (canlı, Vercel deploy sonrası):** Fevzi hesabıyla `https://www.myedudesk.com.tr/mentorluk/bulten?hafta=2026-10-12` → 9 öğrenci, 7'sinde eksik; grup özet görselindeki sayılar DB ile aynı; İdo Elçiçek kartında 7 eksik; görsel Türkçe karakterleri doğru.
3. Yasemin hesabına giriş YAPILMAZ (başkasının şifresi); onun görünümü DB + Fevzi'nin 403 testleriyle güvence altında.

- [ ] **Step 6: Memory**

`C:\Users\mehme\.claude\projects\C--Users-mehme\memory\project_edudesk_excel_aktarim.md`'ye "Haftalık veli bülteni EduDesk'te CANLI (commit'ler, test sayıları)" satırı; `MEMORY.md` index satırını güncelle.
