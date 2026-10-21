# Mentör takip — çalışma saatleri, otomatik ödevler, yeni kâğıt — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Öğrenciye özel çalışma saatleri, okul ödevlerinin haftalık plana kurallı otomatik yerleşmesi ve yeniden tasarlanmış öğrenci kâğıdı.

**Architecture:** Saatler yeni `ogrenci_calisma_saatleri` tablosunda (hafta satırından ayrı). Ödev görevleri mevcut `icerik.gorevler` JSON'una `odevId` ile girer; yerleşim/sayaç/saat hesapları iki saf modülde (`calismaSaatleri.ts`, `odevYerlesim.ts`), `TakipService.sayfaVerisi` her açılışta birleştirir. Kâğıt `OgrenciKagidi.tsx` yeniden yazılır.

**Tech Stack:** Next.js App Router (proxy.ts sürümü), React 19, Tailwind v4, Supabase (RLS), zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-mentor-takip-saatler-odevler-kagit-design.md`

## Global Constraints

- Mevcut veriyi değiştiren migration yok; yalnız `create table ogrenci_calisma_saatleri` + `alter table mentor_haftalari add column if not exists kagit_basildi_at timestamptz`.
- Canlı DDL öncesi tam `pg_dump` (`--no-owner/--no-privileges` YOK) + kullanıcıya DDL gösterilip onay; sonra `database.types.ts` regen.
- Sabitler: 3 hafta sınırı = 21 gün; varsayılan müsait = 150 dk; ödev payı = `Math.floor(müsait / 2)`; ödev görevi `miktar 30, birim 'dk', soruSatiri false`.
- `soru`/`serbest` birimli görevler süre hesabına 0 dk.
- Saat yazımı Türkçe noktalı: `18.00`. Süre yazımı: `2 sa 15 dk`, `45 dk`, `2 sa`.
- Bugün = `todayLocalISO()` (İstanbul); tarih aritmetiği `addDaysISO`.
- Soluk metin `text-gray-500 dark:text-slate-400`; e2e'de responsive ikiz içerikte `{ exact: true }`/kapsamlı locator.
- Commit + push her task sonunda (kullanıcı kuralı), test çıktısı OKUNDUKTAN sonra ayrı komutla.

## Review Focus

1. Saat girilmemiş öğrenci (tablo satırı yok) — sayfa açılır, ödevler 150 dk varsayılanla yerleşir, gün başlığında aşım uyarısı ÇIKMAZ, kâğıtta saat yok. → Task 2 + Task 5 testleri.
2. Kayıtlı (eski biçim) hafta, `gizliOdevler`/`odevId` alanı yok — normalize/kopyala/özet bozulmaz. → Task 3 testi.
3. Mola görevin ortasına düşer (18.00 başl., 60 dk görev, mola 18.30–19.00) → görev 19.00'da başlar. → Task 1 testi.
4. Ödev adı 120 karakteri aşarsa (ders + uzun başlık) zod reddeder → otomatik kayıt kırılır; ad 120'ye kısaltılmalı. → Task 2 testi.
5. Kapalı haftada kâğıt açılır → `kagit_basildi_at` yazımı trigger'a çarpar, sayfa çökmemeli. → Task 4 testi.

---

### Task 1: Saf çalışma saati hesapları

**Files:**
- Create: `src/domains/mentor/takip/calismaSaatleri.ts`
- Test: `tests/vitest/unit/mentor/calismaSaatleri.test.ts`

**Interfaces:**
- Produces:
  - `type GunSaati = { bas: string; bit: string; molaBas?: string; molaBit?: string }` (HH:MM)
  - `type CalismaSaatleri = { gunler: (GunSaati | null)[]; not: string }` (7 eleman, 0=Pzt)
  - `BOS_SAATLER: CalismaSaatleri` (7×null, not '')
  - `saatlerVarMi(s: CalismaSaatleri | null): boolean` — en az bir gün dolu
  - `netSure(g: GunSaati | null): number` — dk
  - `sureKisa(dk: number): string` — `"2 sa 15 dk"`, `"45 dk"`, `"2 sa"`
  - `saatYaz(hhmm: string): string` — `"18:00"` → `"18.00"`
  - `duzenMetni(s: CalismaSaatleri): string`
  - `planlananDk(gorevler: Gorev[], gun: number): number`
  - `gorevSaatleri(g: GunSaati | null, gorevler: Gorev[]): { gorev: Gorev; saat: string | null }[]`

- [ ] **Step 1: Failing tests**

```ts
const g = (bas: string, bit: string, molaBas?: string, molaBit?: string) => ({ bas, bit, ...(molaBas && { molaBas, molaBit }) })
it('netSure molayı düşer', () => { expect(netSure(g('18:00', '20:30', '19:30', '20:00'))).toBe(120); expect(netSure(null)).toBe(0) })
it('sureKisa', () => { expect(sureKisa(135)).toBe('2 sa 15 dk'); expect(sureKisa(45)).toBe('45 dk'); expect(sureKisa(120)).toBe('2 sa') })
it('duzenMetni ardışık aynı günleri birleştirir + not', () => {
  const s = { gunler: [g('18:00','20:30','19:30','20:00'), g('18:00','20:30','19:30','20:00'), g('18:00','20:30','19:30','20:00'), g('18:00','20:30','19:30','20:00'), g('18:00','20:30','19:30','20:00'), g('10:00','13:00'), null], not: 'Salı kurs var' }
  expect(duzenMetni(s)).toBe('Pzt–Cum 18.00–20.30 (mola 19.30–20.00) · Cmt 10.00–13.00 · Salı kurs var')
})
it('duzenMetni boş saatte boş', () => expect(duzenMetni(BOS_SAATLER)).toBe(''))
it('planlananDk: dk toplar, soru/serbest 0, her gün grubu her güne', ...)  // gun 2: 30dk + 15 soru + grup(gün2) 60dk → 90
it('gorevSaatleri sıralı + mola kaydırma', () => {
  // 18:00 başl., mola 18:30–19:00; görevler 30dk, 60dk, 20 soru → 18.00, 19.00, null (sona)
  expect(r.map(x => [x.gorev.ad, x.saat])).toEqual([['A','18.00'],['B','19.00'],['C',null]])
})
it('gorevSaatleri: görev molayı keserse molanın bitişine kayar', ...) // 18:00, mola 18:30–19:00, görevler 20dk, 30dk → 18.00, 19.00
it('gorevSaatleri: saatsiz günde hepsi null', ...)
it('gorevSaatleri: ödev görevleri önce (teslime göre), sonra diğerleri, soru/serbest en sonda', ...)
```

- [ ] **Step 2:** `npx vitest run tests/vitest/unit/mentor/calismaSaatleri.test.ts` → FAIL (modül yok)
- [ ] **Step 3:** Uygula. Gün adları için `GUNLER` (`takipMath`). `gorevSaatleri` sıralaması: `odevId`'li (teslim artan) → diğerleri (girdi sırası) → `birim !== 'dk'` olanlar saatsiz en sonda. Kaydırma: görev başlangıcı `[molaBas, molaBit)` içindeyse ya da `bas < molaBas < bas+miktar` ise başlangıç = `molaBit`.
- [ ] **Step 4:** Test PASS
- [ ] **Step 5:** Commit `feat(mentor-takip): çalışma saati saf hesapları`

### Task 2: Saf ödev yerleşimi

**Files:**
- Create: `src/domains/mentor/takip/odevYerlesim.ts`
- Test: `tests/vitest/unit/mentor/odevYerlesim.test.ts`

**Interfaces:**
- Consumes: Task 1 `CalismaSaatleri`, `netSure`, `saatlerVarMi`; Task 3 `Gorev.odevId/teslim`, `Icerik.gizliOdevler`.
- Produces:
  - `ESKI_SINIR_GUN = 21`, `VARSAYILAN_MUSAIT = 150`
  - `odevGorevAdi(subject: string, title: string): string` — `"${dersKisa(subject)} — ${title}"`, en çok 120 karakter (`…` ile)
  - `odevEtiketi(teslim: string, bugun: string): { tur: 'gecikmis' | 'yarin' | 'tarih'; metin: string }` — `gecikmiş` / `yarın teslim` / `teslim gg.aa`
  - `odevleriBirlestir(a: { gorevler: Gorev[]; gizli: string[]; odevler: HomeworkRecord[]; saatler: CalismaSaatleri | null; hafta: string; bugun: string }): { gorevler: Gorev[]; disarida: HomeworkRecord[] }`
    — durum senkronu + silinmiş ödevin görevini düşürme + yeni adayların yerleşimi; `disarida` = plana girmeyenler (gizli, sığmayan gecikmiş, 3 haftadan eski yapılmamış, teslimi > P+7).
  - `HomeworkRecord` için yeni opsiyonel `created_at?: string` (Task 4'te doldurulur).

- [ ] **Step 1: Failing tests** — hafta `2026-10-19` (Pzt), bugün `2026-10-21` (Çar), saatler: Pzt–Cum 18:00–20:30 (müsait 150 → pay 75), Cmt null, Paz 10:00–12:00 (pay 60).

```ts
it('yarın teslim → bugüne (teslim-1)', ...)            // due 10-22 → gun 2
it('hafta sonu teslim (Cmt 10-24) → Cum; Cmt kapalı değil hedef Cum', ...) // due 10-24 → hedef Cum(4)
it('Paz teslim, Cmt kapalı → Cum', ...)                // due 10-25 → hedef Cmt(5) null → Cum(4)
it('gelecek Pazartesi teslim → Pazar', ...)            // due 10-26 → gun 6
it('payı dolu güne düşen önceki güne kayar', ...)      // Per'e 3×30dk ödev (90 > 75): 3. ödev Çar'a
it('hiç sığmazsa hedef güne aşımla girer', ...)        // bugün Per, due Cum: Per dolu → Per (geriye gün yok)
it('gecikmiş en eski önce bugünden dağılır, sığmayan disarida', ...)
it('3 haftadan eski yapılmamış disarida, plana girmez', ...)  // due 2026-09-29 (bugün-22)
it('yapildi/gec/mazeretli aday değil', ...)
it('teslimi > P+7 disarida (gelecek hafta)', ...)
it('gizli ödev eklenmez ve disarida', ...)
it('planda olan tekrar eklenmez; yapti öğretmen işaretinden senkron', ...)
it('ödev listede yoksa (silinmiş) görev düşer; elle görevlere dokunulmaz', ...)
it('saat girilmemiş → her gün 150 dk varsayılan', ...)
it('gelecek hafta planında ilk gün Pazartesi', ...)    // hafta 10-26, bugün 10-21: gecikmiş → gun 0
it('deterministik: aynı girdi aynı çıktı (id\'ler odevId\'den türetilir)', ...)
it('odevGorevAdi 120 karakteri aşmaz', ...)
it('odevEtiketi', () => { expect(odevEtiketi('2026-10-20','2026-10-21').metin).toBe('gecikmiş'); expect(odevEtiketi('2026-10-22','2026-10-21').metin).toBe('yarın teslim'); expect(odevEtiketi('2026-10-30','2026-10-21').metin).toBe('teslim 30.10') })
```

- [ ] **Step 2:** FAIL
- [ ] **Step 3:** Uygula. Görev id `o-${odevId}`. Adaylar sırası: önce teslimi gelecek olanlar (due ≥ bugün ve hedef ≥ ilk) due/subject/id artan, sonra gecikmişler due artan. Gün müsaiti: saatlerVarMi ise `netSure(gunler[i])` (null → kapalı), değilse 150. Pay doluluğu yalnız o gündeki `odevId`'li görevlerin `miktar` toplamı. Mazeretli işaretli ama planda duran görev: kalır, `yapti=false`.
- [ ] **Step 4:** PASS
- [ ] **Step 5:** Commit `feat(mentor-takip): ödevlerin plana yerleşimi (saf)`

### Task 3: Plan veri modeli — ödev görevlerini koru

**Files:**
- Modify: `src/domains/mentor/takip/takipMath.ts` (`Gorev`, `Icerik`, `gruplandir`, `seviyeDegistir`, `planKopyala`, `yeniHafta`)
- Modify: `src/domains/mentor/validators/takip.ts` (gorevSchema: `odevId: UUID.optional()`, `teslim: tarih optional`; icerikSchema: `gizliOdevler: z.array(UUID).max(200).optional()`)
- Test: `tests/vitest/unit/mentor/takipMath.test.ts`, `tests/vitest/unit/mentor/takipValidators.test.ts`

**Interfaces:**
- Produces: `Gorev.odevId?: string`, `Gorev.teslim?: string`, `Icerik.gizliOdevler?: string[]`; `elleGorevler(g: Gorev[]): Gorev[]` (odevId'siz), `sablonaDon(icerik: Icerik, sinif: number, seviye: Seviye): Gorev[]` (şablon + mevcut ödev görevleri).

- [ ] **Step 1: Failing tests**
  - `seviyeDegistir` ödev görevinin miktarını değiştirmez (30 kalır, elle görev 60→75).
  - `planKopyala` ödev görevlerini ve `gizliOdevler`'i taşımaz; `duzen` `''` olur.
  - `yeniHafta(null, 9)`: `duzen === ''`.
  - `normalizeIcerik` ödev görevlerini gruplamaz (Pzt–Cum aynı adlı 5 ödev görevi grupsuz kalır).
  - `sablonaDon` ödev görevlerini korur, elle görevleri şablonla değiştirir.
  - validator: `odevId`'li görev ve `gizliOdevler` geçer; eski biçim (alanlar yok) geçer.
- [ ] **Step 2:** FAIL
- [ ] **Step 3:** Uygula. `VARSAYILAN_DUZEN` export'u kalır (Task 5 eski metni "otomatik" saymak için kullanır).
- [ ] **Step 4:** `npx vitest run tests/vitest/unit/mentor` PASS
- [ ] **Step 5:** Commit `feat(mentor-takip): ödev görevleri kopyala/seviye/şablondan korunur`

### Task 4: Migration + repository + servis + action

**Files:**
- Create: `supabase/migrations/20261021120000_mentor_calisma_saatleri.sql`
- Modify: `src/infrastructure/supabase/database.types.ts` (regen)
- Modify: `src/domains/homework/lib/stats.ts` (`HomeworkRecord.created_at?`, `OdevSatiri.created_at?` aktarılır), `src/domains/homework/repositories/HomeworkRepository.ts` (`findStudentHomeworkProfile` select'ine `created_at`)
- Modify: `src/domains/mentor/repositories/TakipRepository.ts` (`calismaSaatleri`, `calismaSaatleriYaz`, `kagitBasildi`)
- Modify: `src/domains/mentor/services/TakipService.ts`
- Modify: `src/domains/mentor/validators/takip.ts` (`saatlerSchema`)
- Modify: `app/actions/mentor-takip.ts` (`calismaSaatleriKaydet`)
- Test: `tests/vitest/unit/mentor/takip-service.test.ts`, `tests/vitest/unit/mentor/takipValidators.test.ts`

**Interfaces:**
- Consumes: Task 1–3.
- Produces (`SayfaVerisi`'ne eklenenler): `saatler: CalismaSaatleri | null`, `kagitBasildiAt: string | null`, `disaridaOdevler: HomeworkRecord[]`, `odevVerilis: Record<string, string>` (odevId → created_at), `bugun: string`. `taslak.icerik.gorevler` birleşmiş halde gelir.
- Action: `calismaSaatleriKaydet(studentId: string, saatler: CalismaSaatleri): Promise<ActionResult>`.
- Service: `TakipService.kagitBasildi(studentId, hafta): Promise<void>` (hata yutulmaz ama kapalı hafta/P0001 ve kayıt yokluğu sessiz atlanır).

Migration SQL:

```sql
create table if not exists public.ogrenci_calisma_saatleri (
  student_id uuid primary key references public.students(id) on delete cascade,
  school_id  uuid not null references public.schools(id) on delete cascade,
  gunler     jsonb not null check (jsonb_typeof(gunler) = 'array' and jsonb_array_length(gunler) = 7),
  "not"      text not null default '' check (length("not") <= 300),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.ogrenci_calisma_saatleri enable row level security;
create policy ogrenci_calisma_saatleri_all on public.ogrenci_calisma_saatleri for all
  using (school_id = current_school_id() and mentor_takip_erisimi(student_id))
  with check (school_id = current_school_id() and mentor_takip_erisimi(student_id));
alter table public.mentor_haftalari add column if not exists kagit_basildi_at timestamptz;
```

- [ ] **Step 1: Failing tests**
  - `saatlerSchema`: `bas >= bit` red; mola yarım red; mola aralık dışı red; 7'den farklı uzunluk red; HH:MM dışı red; geçerli geçer.
  - takip-service: `herkeseUygula` hedefe ödev görevi ve `duzen` kopyalamaz (mock repo `haftaEkle` argümanı); `sayfaVerisi` açık bu-hafta için ödevleri birleştirir, kapalı haftada birleştirmez; geçmiş hafta (Pazarı < bugün) birleştirmez. (Mevcut `vi.mock` fabrikalarına yeni repo fn'leri ekle — TUZAK.)
- [ ] **Step 2:** FAIL
- [ ] **Step 3:** Uygula. `sayfaVerisi`: `R.calismaSaatleri` paralel okunur; birleşme koşulu `!kapali && addDaysISO(hafta, 6) >= bugun`; gizli = `taslak.icerik.gizliOdevler ?? []`. Kapalı/geçmişte `disaridaOdevler` = `[]` ve eski `okulOdevleri` alanı (kapalı anlık görüntü) korunur. `herkeseUygula`: `gorevler: elleGorevler(...)`, `duzen: ''`.
- [ ] **Step 4:** `npx vitest run tests/vitest/unit/mentor` PASS, `npx tsc --noEmit` 0 (regen sonrası)
- [ ] **Step 5:** Canlı: pg_dump + DDL kullanıcı onayı → `psql -v ON_ERROR_STOP=1 -1 -f <migration>`; doğrulama `select count(*) from ogrenci_calisma_saatleri` = 0, `\d mentor_haftalari` kolon var; tip regen.
- [ ] **Step 6:** Commit `feat(mentor-takip): çalışma saatleri tablosu, ödev birleşmesi, kâğıt damgası`

### Task 5: Ekranlar — saat kartı, gün sayacı, ödev görevleri, listeler

**Files:**
- Create: `app/(dashboard)/mentorluk/[studentId]/takip/CalismaSaatleriKarti.tsx`
- Modify: `DosyaSekmesi.tsx` (kartı ekle), `PlanSekmesi.tsx`
- Test: `tests/playwright/e2e/mentor-takip-saatler.spec.ts` (yeni)

**Interfaces:**
- Consumes: Task 1 (`netSure`, `sureKisa`, `duzenMetni`, `planlananDk`, `saatlerVarMi`), Task 2 (`odevEtiketi`), Task 4 (`SayfaVerisi` yeni alanları, `calismaSaatleriKaydet`).

Davranış (spec Bölüm 0–1):
- Kart: 7 satır `type="time"` baş/bit + "Mola" (açılır iki saat), satırda net süre `Çar: 2 sa 15 dk`, "Hafta içi hepsine uygula", not (≤300), "Kaydet" → action; hata `role="alert"`.
- Gün başlığı: `Çar · 2 sa 10 dk / 2 sa 15 dk`; aşım → turuncu + `45 dk fazla`; saat yok ama görev var → `Çalışma saati yok`; saat hiç girilmemişse yalnız planlanan + üstte ipucu bağlantısı (`?sekme=dosya`).
- Ödev görevi satırı: ad/miktar/gün değiştirilebilir (gün seçici yalnız ödev görevinde, `aria-label="Gün"`), birim/Soru/kitap yok, etiket, "yapıldı" salt göstergesi, `odevVerilis[odevId] > kagitBasildiAt` → `yeni` rozeti. Silme → `gizliOdevler`'e ekle.
- "Sınıf şablonuna dön" → `sablonaDon`.
- Üst uyarı: `Kâğıt yazdırıldıktan sonra N yeni ödev eklendi — tekrar yazdır.`
- Eski üç okul listesi yerine tek "Plana girmeyen ödevler" (`disaridaOdevler`, etiketli) + satırda "Plana ekle" (gizliden çıkar; çıkmıyorsa — sığmayan/eski/ileri — `odevId` görevini `ilk` güne koy). Kapalı haftada eski `okulOdevleri` görüntüsü salt okunur gösterilir.
- Düzen alanı: değer `''` ya da `VARSAYILAN_DUZEN` ise placeholder/gösterim `duzenMetni(saatler)`; "Saatlerden oluştur" bağlantısı alanı `''` yapar.

- [ ] **Step 1: Failing e2e** (test öğrencileri mevcut `mentor-takip.spec.ts` kurulum yardımcılarıyla):
  - iki öğrenciye farklı saat → A'da "Bu planı tüm mentör öğrencilerime uygula" → B'nin kartında saatler aynen (UI) + `ogrenci_calisma_saatleri` satırı değişmemiş (service-role sorgu).
  - Plan gün başlığı sayacı + aşımda `45 dk fazla` metni.
  - Ödev görevi silinir → reload → geri gelmez, "Plana girmeyen ödevler" listesinde.
  - Öğretmen işareti (service-role ile `homework_submissions` yapildi) → reload → görev yapıldı göstergesi.
- [ ] **Step 2:** FAIL
- [ ] **Step 3:** Uygula
- [ ] **Step 4:** Yeni spec + `mentor-takip.spec.ts` PASS (kâğıt testleri Task 6'da güncellenir; o testler şimdilik kırmızıysa not et)
- [ ] **Step 5:** Commit `feat(mentor-takip): saat kartı, gün sayacı, otomatik ödev görevleri`

### Task 6: Öğrenci kâğıdı yeniden tasarım + damga

**Files:**
- Modify: `app/(dashboard)/mentorluk/[studentId]/takip/OgrenciKagidi.tsx` (yeniden yaz; `OkulOdevTablosu`/`ImzaAlanlari` export'ları `SonucKagidi` için kalır)
- Modify: `app/(dashboard)/mentorluk/[studentId]/takip/kagit/page.tsx`, `app/(dashboard)/mentorluk/takip-kagitlari/page.tsx` (`TakipService.kagitBasildi`)
- Modify: `tests/playwright/e2e/mentor-takip.spec.ts` (kâğıt beklentileri: "Program" tablosu yerine gün kutuları)
- Test: `tests/playwright/e2e/mentor-takip-kagit.spec.ts` (yeni)

Yapı (spec Bölüm 2): üst bant + `Bu hafta hedefin: N soru` + `Günlük düzen: …`; `<section aria-label="Çarşamba">` gün kutuları 2 sütun, başlık `Çarşamba · 21 Ekim · 18.00–20.30`; satır `saat ☐ ad …… miktar` (`gorevSaatleri`), etiket metni, soru görevinde `Çözdüm: ___ Doğru: ___` (+ `kitapSayfaYaz`), kutu sonunda 2 satır `Yeni ödev: ________ Teslim: ____`; alt bant plana girmeyenler + okuma/mentör ödevi (doluysa) + `ImzaAlanlari ekran`. Gövde `text-[11pt]`, `break-inside-avoid`, gri dolgu yok.

- [ ] **Step 1: Failing e2e**: 7 günü dolu, molalı plan → kâğıtta `Çarşamba` kutusu başlığı saat aralığıyla, ilk görev `18.00`, molayı kesen görev mola bitişinde; soru görevinde `Çözdüm`, diğerinde yok; `page.pdf({ format: 'A4' })` sayfa sayısı ≤ 2; kâğıt açıldıktan sonra yeni ödev (service-role insert, `created_at` now) → plan sekmesinde `yeni` rozeti + `tekrar yazdır` uyarısı.
- [ ] **Step 2:** FAIL
- [ ] **Step 3:** Uygula
- [ ] **Step 4:** Yeni spec + güncellenmiş `mentor-takip.spec.ts` PASS
- [ ] **Step 5:** Commit `feat(mentor-takip): yeni öğrenci kâğıdı`

### Task 7: Bütün doğrulama

- [ ] `npx tsc --noEmit` → 0
- [ ] `npm run test:unit` → tümü geçer (sayı not edilir)
- [ ] `npm run build` → exit 0
- [ ] `npx playwright test` → tam paket (sonucu OKU, sonra commit)
- [ ] Canlı iki katman: SQL (`ogrenci_calisma_saatleri`, `kagit_basildi_at`) + tarayıcıda Plan/kâğıt
- [ ] Final whole-branch review (fresh reviewer), bulguları doğrula/uygula
- [ ] Memory + MEMORY.md güncelle; commit + push
