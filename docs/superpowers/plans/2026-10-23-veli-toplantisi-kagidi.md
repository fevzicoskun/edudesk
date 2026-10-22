# Veli Toplantısı Kâğıdı — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mentör, Stoys AGİS Excel'lerini yükler; her öğrencisi için deneme gidişi + ödev raporu + haftalık plan özeti + elle not alanı içeren basılabilir veli toplantısı kâğıdı alır.

**Architecture:** Üç yeni tablo (sınav, sınavın yüklendiği sınıflar, öğrenci sonucu) mentör takip kapısının (`mentor_takip_acik()` / `mentor_takip_erisimi()`) arkasında. Excel sunucuda `exceljs` ile okunur, saf bir ayrıştırıcı + saf bir eşleştirici önizleme üretir, mentör onaylayınca JSON olarak kaydedilir. Kâğıt sunucu bileşeni; ödev ve haftalık hesaplar mevcut fonksiyonları yeniden kullanır.

**Tech Stack:** Next.js App Router (standart dışı sürüm — `node_modules/next/dist/docs/`), React 19, Tailwind v4, Supabase (RLS), exceljs (kurulu), zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-22-veli-toplantisi-kagidi-design.md`

## Global Constraints

- Kapı: her sayfa/aksiyon `TakipService.acikMi()` false ise `notFound()` / hata döner; RLS de aynı kapıyı şart koşar. Şimdilik yalnız kullanıcı açık.
- Yazma/silme yalnız güncel mentör (`mentor_takip_erisimi(student_id)`); okuma ek olarak `is_mudur_or_my()` + aynı okul.
- Mentörün öğrencisi olmayan dosya satırları **saklanmaz**.
- Katılmadığı sınavda **0 değil "Katılmadı"**; sonucu girilmemiş hafta/soru **"Girilmedi"**.
- İşaretlenmemiş ödev (`marked_at` null / status null) yapılmadı sayılmaz.
- Deneme türleri yalnız `'TM' | 'FKB' | 'TCD'`; her tür kendi içinde izlenir, türler arası kıyas yok.
- Ödev aralığı `donemBasi()`'ten bugüne.
- Sayılar `double precision` saklanır (PostgREST `numeric`'i string döndürür — CLAUDE.md).
- PDF adı: tek öğrenci `"<Ad Soyad> - Veli Toplantısı"`, toplu `"Veli Toplantısı Kâğıtları"` (`title: { absolute }`).
- UI metni Türkçe; soluk metin `text-gray-500 dark:text-slate-400`; kâğıt sarmalayıcısı `kagit` sınıfını taşır (koyu temada beyaz kalır).
- `confirm()` kullanma (tarayıcı otomasyonunu kilitliyor) — silme iki adımlı düğme ("Sil" → "Emin misin? Sil").

## Review Focus

1. Sınava girmeyen öğrenci: önizlemede "Katılmadı", kâğıtta "Katılmadı" — 0 değil (Task 2, 5 testleri).
2. Mentörün başka sınıftaki öğrencisi 9-A dosyası yüklenince etkilenmez; kâğıtta o sınav hiç görünmez (Task 2, 5).
3. Negatif net (gerçek veride `-2.00`, `-0.25`) doğru okunur ve "−2,00" gösterilir; değişim hesabı bozulmaz (Task 2, 5).
4. Tanınmayan Excel (öğrenci listesi, boş dosya, bozuk dosya) → açık hata, hiçbir şey yazılmaz (Task 2, 3).
5. Uzun ödev listesi ikinci sayfaya taşar, satır ortadan bölünmez (`break-inside-avoid` satırlarda) (Task 6 e2e: 40 yapılmamış ödevle iki sayfa).

---

### Task 1: Veri modeli + RLS

**Files:**
- Create: `supabase/migrations/20261023120000_deneme_sonuclari.sql`
- Modify: `src/infrastructure/supabase/database.types.ts` (regen)
- Test: `tests/vitest/integration/rls/deneme-rls.test.ts`

**Interfaces:**
- Produces tablolar:
  - `deneme_sinavlari(id uuid pk, school_id, tur text check in ('TM','FKB','TCD'), seviye smallint check 9..12, tarih date, created_by uuid → profiles, created_at)`, `unique (school_id, tur, seviye, tarih)`.
  - `deneme_sinav_siniflari(sinav_id → deneme_sinavlari on delete cascade, class_id → classes on delete cascade, school_id, primary key (sinav_id, class_id))` — "bu sınıfın dosyası yüklendi" kaydı; "katılmadı" çıkarımı buna dayanır.
  - `deneme_sonuclari(sinav_id → deneme_sinavlari on delete cascade, student_id → students on delete cascade, school_id, dersler jsonb not null, toplam_net double precision not null, puan double precision, updated_by uuid, updated_at timestamptz default now(), primary key (sinav_id, student_id))`. `dersler` = `[{ "kod": "TÜR", "ss": 30, "d": 27, "y": 3, "n": 26.25 }]`.
- RLS:
  - `deneme_sinavlari` / `deneme_sinav_siniflari`: select `school_id = current_school_id()`; insert `school_id = current_school_id() and mentor_takip_acik()`; update/delete policy YOK.
  - `deneme_sonuclari`: select `school_id = current_school_id() and (mentor_takip_erisimi(student_id) or is_mudur_or_my())`; insert/update/delete `school_id = current_school_id() and mentor_takip_erisimi(student_id)`.

- [ ] **Step 1: RLS testini yaz** — `createTestSchool`, mentör (takip listesinde + öğrenci A'nın mentörü), başka öğretmen (listede değil), MY; öğrenci A ve B (B mentörsüz). Testler:
  - `mentör kendi öğrencisine sonuç yazar ve okur` → insert A ok, select 1 satır.
  - `mentör mentörü olmadığı öğrenciye yazamaz` → insert B hata/0 satır.
  - `takip listesinde olmayan öğretmen sınav oluşturamaz` → `deneme_sinavlari` insert reddedilir.
  - `MY okur ama yazamaz` → select A 1 satır, insert reddedilir.
  - `aynı okul+tür+seviye+tarih ikinci kez eklenemez` → unique ihlali (`23505`).
- [ ] **Step 2: Çalıştır, düşsün** — `npx vitest run tests/vitest/integration/rls/deneme-rls.test.ts` → FAIL (tablo yok).
- [ ] **Step 3: Migration'ı yaz ve canlıya uygula** — `psql "$DB_URL" -f supabase/migrations/20261023120000_deneme_sonuclari.sql` (DB_URL: `C:\Users\mehme\.edudesk-db.env`, asla yazdırma). Yalnız ekleme yapan migration; yine de uygulamadan önce kullanıcıya tek satırla haber ver. Sonra tipleri yeniden üret (proje yöntemi: `database.types.ts` başındaki komut / `npx supabase gen types typescript --project-id agijvfrcudpzsofgfogu`).
- [ ] **Step 4: Testler geçsin** — aynı komut → 5/5 PASS; `npx tsc --noEmit -p .` → exit 0.
- [ ] **Step 5: Commit + push**

### Task 2: Stoys ayrıştırıcı ve eşleştirici (saf)

**Files:**
- Create: `src/domains/mentor/deneme/stoys.ts`
- Test: `tests/vitest/unit/mentor/stoys.test.ts`

**Interfaces:**
- Produces:
  - `type DenemeTuru = 'TM' | 'FKB' | 'TCD'`
  - `type DersSonucu = { kod: string; ss: number; d: number; y: number; n: number }`
  - `type StoysSatir = { ad: string; dersler: DersSonucu[]; toplamNet: number; puan: number | null }`
  - `parseStoys(rows: string[][]): { tur: DenemeTuru; sinif: string; seviye: number; satirlar: StoysSatir[] } | { error: string }`
  - `adAnahtari(ad: string): string` — `tr-TR` büyük harf, fazla boşluk tek boşluk, kırpılmış.
  - `type Eslesme = { eslesen: { studentId: string; satir: StoysSatir }[]; katilmayan: string[]; eslesmeyenSatirlar: StoysSatir[] }`
  - `eslestir(satirlar: StoysSatir[], ogrenciler: { id: string; full_name: string; class_name: string | null }[], dosyaSinifi: string): Eslesme`
  - `DERS_ADLARI: Record<string, string>` — `TÜR: 'Türkçe', MAT: 'Matematik', FİZ: 'Fizik', KİM: 'Kimya', BİY: 'Biyoloji', TAR: 'Tarih', COĞ: 'Coğrafya', DİN: 'Din'`.

Kurallar: başlık satırı ilk 10 satırda `Adı Soyadı` içeren satır; ders kodları `<KOD>-N` başlıklarından (`TOP` hariç); kod kümesi `{TÜR,MAT}`→TM, `{FİZ,KİM,BİY}`→FKB, `{TAR,COĞ,DİN}`→TCD, başka her şey → `{ error: 'Bu dosya Stoys AGİS raporuna benzemiyor (TM, FKB ya da TCD bulunamadı).' }`; `SINIF` hücresi `"9-A"` → seviye 9 (9..12 dışı → hata); adı boş satır atlanır; hiç öğrenci satırı yoksa hata. `eslestir`: yalnız `class_name === dosyaSinifi` olan öğrenciler aday; `adAnahtari` eşitliği; dosyada ya da adaylarda aynı anahtar birden çok kez geçerse o ad eşleşmez (her iki taraf eşleşmeyene); aday olup eşleşmeyen → `katilmayan`.

- [ ] **Step 1: Testleri yaz** (gerçek dosyalardan kopyalanmış satırlarla):
  - TCD fixture: başlık `['OKUL','SINIF','Öğrenci No','Adı Soyadı','TAR-SS','TAR-D','TAR-Y','TAR-N','TAR-YB','COĞ-SS',…,'DİN-YB','TOP-SS','TOP-D','TOP-Y','TOP-N','TOP-YB','AGIS-Puan','AGIS-Sınıf','AGIS-Okul','AGIS-Genel']`, satırlar `KUZEY OKYAR … 26,21,5,19.75,75.96 | 26,24,0,24,92.31 | 8,8,0,8,100 | 60,53,5,51.75,86.25 | 448.309` ve `SELİN SEZEN … DİN 8,0,8,-2,-25 … TOP-N 12.5`; 1. satır `[' Stoys Rapor ']`.
    `expect(r).toMatchObject({ tur: 'TCD', sinif: '9-A', seviye: 9 })`; Kuzey `toplamNet 51.75, puan 448.309`, `dersler[0]` `{ kod: 'TAR', ss: 26, d: 21, y: 5, n: 19.75 }`; Selin DİN `n: -2`.
  - TM başlığı (`TÜR`,`MAT`) → `'TM'`; FKB (`FİZ`,`KİM`,`BİY`) → `'FKB'`.
  - `e-Okul öğrenci listesi` (`['S.No','Öğrenci No','Adı Soyadı']`) → `{ error }`; boş `[]` → `{ error }`; `SINIF 'Hazırlık'` → `{ error }`.
  - `adAnahtari('  Beren   Çıbıkçı ')` === `adAnahtari('BEREN ÇIBIKÇI')`; `adAnahtari('İdo Elçiçek') === 'İDO ELÇİÇEK'`.
  - `eslestir`: 9-A'da A (dosyada), B (dosyada yok), 9-B'de C → `eslesen` A, `katilmayan` [B], C hiçbir listede yok; dosyadaki X (öğrenci değil) `eslesmeyenSatirlar`'da; aynı adlı iki 9-A öğrencisi → ikisi de `katilmayan`, satır `eslesmeyenSatirlar`.
- [ ] **Step 2: Çalıştır, düşsün** — `npx vitest run tests/vitest/unit/mentor/stoys.test.ts` → FAIL (modül yok).
- [ ] **Step 3: `stoys.ts`'i yaz.** Hücreler string gelir (`excelCellToString` çıktısı); sayıyı `Number(x.replace(',', '.'))` ile çevir, boş → null (puan) / satır atla (ders N boşsa ders yok).
- [ ] **Step 4: Geçsin** — aynı komut PASS.
- [ ] **Step 5: Commit + push**

### Task 3: Deneme servisi + aksiyonlar

**Files:**
- Create: `src/domains/mentor/deneme/DenemeService.ts`, `app/actions/deneme.ts`
- Test: `tests/vitest/unit/mentor/denemeKaydetSema.test.ts` (zod şeması), RLS davranışı Task 1'de.

**Interfaces:**
- Consumes: Task 2 tipleri; `TakipService.acikMi()`; `MentorService.getMyMentorships()` (`student_id, full_name, class_name`; sınıf id gerekirse `students.class_id`).
- Produces:
  - `type Onizleme = { tur: DenemeTuru; seviye: number; sinif: string; sinifId: string; eslesme: Eslesme; ogrenciAdlari: Record<string, string>; oneri: { sinavId: string; tarih: string } | null }`
  - `denemeOnizle(formData: FormData): Promise<{ error: string } | Onizleme>` — dosyayı `excelImportFileSchema` ile doğrular, `exceljs` lazy import (`app/actions/classes.ts:92-108` kalıbı), `parseStoys`, mentörün öğrencileriyle `eslestir`; `sinifId` okulda `name = sinif` sınıfı (yoksa hata "Dosyadaki sınıf (9-A) okulda bulunamadı"); `oneri` = aynı okul+tür+seviye, `tarih >= bugün-14` en yeni sınav.
  - `denemeKaydet(girdi: unknown): Promise<{ error?: string; kaydedilen?: number }>` — zod: `{ tur, seviye, tarih: 'YYYY-MM-DD' (bugünden ileri olamaz), sinifId: uuid, sinavId?: uuid, sonuclar: { studentId: uuid, dersler: DersSonucu[] (1..3), toplamNet: number, puan: number | null }[] (0..60) }`. Akış: sınavı `sinavId` ile al ya da `(school,tur,seviye,tarih)` upsert; `deneme_sinav_siniflari` upsert; `sonuclar` upsert; mentörün bu sınıftaki öğrencilerinden `sonuclar`'da olmayanların bu sınavdaki satırını sil (tekrar yükleme = güncelle). Her `studentId` mentörün öğrencisi değilse tüm istek reddedilir.
  - `denemeSil(sinavId: string, sinifId: string): Promise<{ error?: string }>` — mentörün o sınıftaki öğrencilerinin o sınavdaki sonuçlarını siler (sınav ve sınıf kaydı kalır).
  - `denemeListesi(): Promise<{ sinavId: string; tur: DenemeTuru; tarih: string; sinif: string; sinifId: string; ogrenciSayisi: number }[]>` — mentörün öğrencilerinin sonucu olan sınavlar, yeniden eskiye.
- Aksiyonlar `revalidatePath('/mentorluk/denemeler')`.

- [ ] **Step 1: Şema testi** — geçerli girdi kabul; `tarih: '2099-01-01'` red; `tur: 'GENEL'` red; 61 sonuç red; `toplamNet: -12.5` kabul.
- [ ] **Step 2: Düşsün** → `npx vitest run tests/vitest/unit/mentor/denemeKaydetSema.test.ts` FAIL.
- [ ] **Step 3: Servis + aksiyonları yaz** (şema `src/domains/mentor/deneme/denemeSema.ts`'te dışa açık).
- [ ] **Step 4: Geçsin** + `npx tsc --noEmit -p .` exit 0.
- [ ] **Step 5: Commit + push**

### Task 4: Yükleme ekranı

**Files:**
- Create: `app/(dashboard)/mentorluk/denemeler/page.tsx`, `app/(dashboard)/mentorluk/denemeler/DenemeYukleForm.tsx` ('use client'), `app/(dashboard)/mentorluk/denemeler/DenemeSilButonu.tsx`
- Modify: `app/(dashboard)/mentorluk/page.tsx:97` (takipAcik bloğuna `Denemeler` bağlantısı, `ikincilButon`)
- Test: `tests/playwright/e2e/veli-toplantisi.spec.ts` (Task 6 ile ortak dosya; burada yükleme testleri)

**Interfaces:** Consumes Task 3 aksiyonları.

Ekran: başlık "Denemeler"; form: dosya (`accept=".xlsx"`), "Sınav tarihi" (`type=date`, varsayılan bugün, `max` bugün), "Önizle". Önizleme: "TCD · 9-A" başlığı; `oneri` varsa radyo "20 Ekim'deki TCD ile aynı sınav" (seçili) / "Yeni sınav (seçilen tarih)"; tablo: eşleşen öğrenciler (ad, toplam net); "Katılmadı" satırları — her birinde `eslesmeyenSatirlar`'dan seçilebilen açılır liste ("Dosyada bulunamadı" varsayılan; seçilirse eşleşene taşınır); altta "N satır başka öğrencilere ait, alınmadı." Düğme "Kaydet". Alt bölüm "Yüklenen denemeler" listesi (`denemeListesi`) + iki adımlı Sil.

- [ ] **Step 1: e2e yaz** — beforeAll: mentor-takip.spec kalıbı (mentörlük + `mentor_takip_kullanicilari`), mentörün öğrencisinin sınıf adıyla exceljs'le geçici `.xlsx` üret (öğrenci adı + bir sahte ad). Testler:
  - `kapı kapalıyken /mentorluk/denemeler bulunamadı` (bayrağı silip `bulunamadi()`; sonra geri ekle).
  - `yükle → önizleme → kaydet`: önizlemede öğrenci adı + `51,75`, "1 satır başka öğrencilere ait"; Kaydet sonrası DB'de `deneme_sonuclari` 1 satır, sahte ad için satır YOK.
  - `tanınmayan dosya hata verir`: başlıksız xlsx → "Stoys AGİS raporuna benzemiyor" görünür, DB değişmez.
  - `sil iki adımlı`: "Sil" → "Emin misin? Sil" → satır 0.
  - afterAll: `deneme_sonuclari`/`deneme_sinav_siniflari`/`deneme_sinavlari` test satırlarını sil.
- [ ] **Step 2: Düşsün** — `npx playwright test tests/playwright/e2e/veli-toplantisi.spec.ts` → FAIL.
- [ ] **Step 3: Ekranı yaz.**
- [ ] **Step 4: Geçsin** + break-then-revert: `denemeKaydet` içindeki "mentörün öğrencisi değil" kontrolünü geçici kaldır, sahte ad testi hâlâ geçiyor mu bak (eşleştirici zaten alıyor mu?) — kırmızı görmezsen testin o yolu sınamadığını yaz; geri al.
- [ ] **Step 5: Commit + push**

### Task 5: Kâğıt verisi (saf hesaplar + servis)

**Files:**
- Create: `src/domains/mentor/lib/veliToplantisi.ts`, `src/domains/mentor/deneme/VeliToplantisiService.ts`
- Test: `tests/vitest/unit/mentor/veliToplantisi.test.ts`

**Interfaces:**
- Consumes: `ozetHesapla`, `programYuzde` (`takipMath`); `soruGirildi`, `durumYuzdesi`, `durumOf`, `DURUM_ETIKETLERI` (`app/(dashboard)/mentorluk/[studentId]/takip/SonucKagidi.tsx`); `HomeworkService.getStudentHomeworkProfile(studentId, classId, { tumOdevler: true, bas: donemBasi() })`.
- Produces:
  - `type DenemeSatiri = { tarih: string; katilmadi: boolean; dersler: DersSonucu[]; toplamNet: number | null; degisim: number | null }`
  - `denemeGidisi(sinavlar: { id: string; tur: DenemeTuru; tarih: string; siniflar: string[] }[], sonuclar: { sinavId: string; dersler: DersSonucu[]; toplamNet: number }[], ogrenciSinifId: string): Record<DenemeTuru, DenemeSatiri[]>` — yalnız `siniflar` öğrencinin sınıfını içeren sınavlar; eskiden yeniye; `degisim` = bu toplam − öğrencinin **katıldığı** bir önceki aynı tür sınavın toplamı (ilk ya da katılmadı → null).
  - `type HaftaSatiri = { hafta: string; girilmedi: boolean; program: number | null; soru: number | null; hedef: number; durum: 'iyi' | 'orta' | 'dusuk' | null }`
  - `haftaSatiri(haftaBasi: string, icerik: Icerik, soruHedefi: number): HaftaSatiri` — `girilmedi` = görev yapılan 0 ve soru girilmemiş (sonuç kâğıdındaki `hicVeri` tanımı).
  - `VeliToplantisiService.veri(studentId: string): Promise<VeliToplantisiVerisi | null>` — kapı + mentörlük kontrolü (değilse null); `{ okulAdi, ogrenci: { ad, sinif }, mentorAdi, tarih: todayLocalISO(), denemeler, odevler: HomeworkRecord[], haftalar: HaftaSatiri[] }`; haftalar `mentor_haftalari` `hafta_basi >= donemBasi()` ve `<= bugün`, eskiden yeniye.

- [ ] **Step 1: Testler** —
  - `denemeGidisi`: TCD üç sınav (9-A yüklendi ×3), öğrenci 1. ve 3.'de var, 2.'de yok → `[{toplamNet 30, degisim null}, {katilmadi: true, toplamNet null}, {toplamNet 33.5, degisim 3.5}]`.
  - Sınav yalnız 9-B için yüklendiyse 9-A öğrencisinde görünmez (`TCD: []`).
  - Negatif: `-2` → `2.5` = degisim `4.5`.
  - `haftaSatiri`: sonuç girilmemiş içerik → `{ girilmedi: true, program: null, soru: null, durum: null }`; %72 program + 96/120 soru → `durum: durumOf(durumYuzdesi(72, 96, 120)!)`.
- [ ] **Step 2: Düşsün** → `npx vitest run tests/vitest/unit/mentor/veliToplantisi.test.ts`.
- [ ] **Step 3: Yaz.**
- [ ] **Step 4: Geçsin.**
- [ ] **Step 5: Commit + push**

### Task 6: Kâğıt + sayfalar + bağlantılar

**Files:**
- Create: `app/(dashboard)/mentorluk/[studentId]/veli-toplantisi/VeliToplantisiKagidi.tsx`, `app/(dashboard)/mentorluk/[studentId]/veli-toplantisi/page.tsx`, `app/(dashboard)/mentorluk/veli-toplantisi/page.tsx`
- Modify: `app/(dashboard)/mentorluk/[studentId]/page.tsx:55` (takipAcik bloğuna "Veli toplantısı" bağlantısı), `app/(dashboard)/mentorluk/page.tsx:97` ("Veli toplantısı kâğıtları"), `components/layout/Sidebar.tsx` + `components/layout/MobileNavDrawer.tsx` (Mentörlük grubunda `planAcik` altında "Denemeler" ve "Veli toplantısı" satırları, "Hepsini yazdır" deseniyle)
- Test: `tests/playwright/e2e/veli-toplantisi.spec.ts`

**Interfaces:** Consumes `VeliToplantisiService.veri`, `MentorService.getMyMentorships`, `dersGruplari`/`dersOzeti`/`dersOzetiMetni` (`src/domains/homework/lib/stats.ts`), `DERS_ADLARI`.

Kâğıt sırası (spec): başlık (okul, öğrenci, sınıf, mentör, tarih) → **Denemeler** (tür başına küçük tablo: Tarih | ders netleri | Toplam | Değişim (`+3,50` / `−1,25` / `—`); katılmadı satırı "Katılmadı"; hiç yoksa "Bu dönem için deneme sonucu yüklenmedi.") → **Ödevler** (ders oranları satırı, sonra yapılmayan/eksik tam liste: Durum | Ders | Ödev | Teslim; satır `break-inside-avoid`; hiç yoksa "Yapılmayan ödev yok.") → **Haftalık plan** (Hafta | Program | Soru | Durum; `takipHaftaEtiketi`; "Girilmedi"; yoksa "Bu dönem haftalık plan sonucu yok.") → **Mentör notu** (6 boş çizgi) + "Mentör imzası / Veli imzası / Tarih". Sayı biçimi `toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`. Sayfa sarmalayıcısı sonuc-kagidi/page.tsx deseni (`kagit`, `@page { size: A4; margin: 0 }`, body padding 12mm) ama `min-h` yok ve iki sayfaya taşabilir. Toplu sayfa: her öğrenci `break-after-page`.

- [ ] **Step 1: e2e** (aynı spec dosyası, Task 4 verisini kullanır):
  - `kâğıt: deneme gidişi, katılmadı, değişim` — iki TCD sınavı (ikincisinde öğrenci yok) + bir üçüncü → "Katılmadı" görünür, "0,00" Toplam hücresinde görünmez, değişim "+" ile.
  - `kâğıt: yapılmayan ödevler listede, işaretlenmemiş yok` — öğrencinin sınıfına 2 ödev (biri `yapilmadi` + `marked_at`, biri işaretsiz) → ilki listede, ikincisi değil.
  - `kâğıt: haftalık satır girilmedi` — `mentor_haftalari`'na sonuçsuz bir hafta → "Girilmedi".
  - `uzun liste iki sayfa` — 40 yapılmamış ödev; `page.pdf()` sayfa sayısı ≥ 2 ve bir satırın yüksekliği sayfa sınırında bölünmüyor (`break-inside: avoid` hesaplanmış stil kontrolü yeter).
  - `başlık` — `toHaveTitle(\`${ad} - Veli Toplantısı\`)`; toplu `toHaveTitle('Veli Toplantısı Kâğıtları')`.
  - `kapı kapalıyken iki sayfa da bulunamadı; MY'nin mentörü olmadığı öğrencide bulunamadı`.
  - `koyu temada kâğıt beyaz` — `sonucKagidiKontrol`'deki `renkler()` kıyası.
  - `menü: Veli toplantısı bağlantısı` — Sidebar'da tıklanınca `/mentorluk/veli-toplantisi`.
- [ ] **Step 2: Düşsün.**
- [ ] **Step 3: Yaz.**
- [ ] **Step 4: Geçsin** — `npx playwright test tests/playwright/e2e/veli-toplantisi.spec.ts tests/playwright/e2e/mentor-takip.spec.ts` hepsi PASS; `npm run test:unit` PASS; `npx tsc --noEmit -p .` exit 0; `npm run build` exit 0. Break-then-revert: `denemeGidisi`'nde katılmadı satırını `toplamNet: 0` döndürecek şekilde boz → kâğıt testi düşmeli; geri al.
- [ ] **Step 5: Commit + push; canlı doğrulama** — deploy READY sonrası kullanıcının gerçek 3 Excel'iyle (Downloads'ta yoksa kullanıcıdan iste) Beren için yükle; SQL: `deneme_sonuclari` satır sayısı = eşleşen öğrenci; tarayıcı: kâğıtta TCD/TM/FKB netleri Excel ile birebir. Memory (`project_zumre_takip.md` + `MEMORY.md`) güncelle.
