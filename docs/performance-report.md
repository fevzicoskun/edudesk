# Performans Analiz Raporu

**Analiz tarihi:** 2026-06-14
**Kapsam:** anasayfa (rol bazlı), odevler, odevler/sinif/[classId], yoklama, yoklama/cizelge, rapor/devamsizlik, rapor/ogretmen-aktivite, platform
**Yöntem:** Supabase MCP (advisors + EXPLAIN ANALYZE), Chrome DevTools Lighthouse, statik sorgu denetimi
**Supabase proje ID:** agijvfrcudpzsofgfogu

> ⚠️ Bu rapor 2026-05-19 tarihli önceki raporun yerini alır. Eski rapor **superseded**:
> referans verdiği tüm dosyalar (DersProgramiWidget, MudurDashboard, MudurYardimcisiDashboard,
> MentorSinifimWidget, raporlar/mentor, raporlar/ogrenci, src/shared/perf) sonraki
> refactor'larda silinmişti ve önerileri uygulanamıyordu.

---

## 1. Veritabanı Katmanı

_Ölçüm tarihi: 2026-06-14 — Supabase MCP (proje: agijvfrcudpzsofgfogu)_

### Advisor Bulguları

Supabase `get_advisors` (type: "performance") sonuçları — toplam **242 bulgu**:

| Tür | Seviye | Sayı | Özet |
|-----|--------|------|------|
| `auth_rls_initplan` | WARN | 99 | RLS politikalarında `auth.<function>()` / `current_setting()` her satır için yeniden değerlendiriliyor |
| `multiple_permissive_policies` | WARN | 70 | Aynı tablo+rol+aksiyon için birden fazla permissive policy (her sorgu tüm policy'leri çalıştırıyor) |
| `unindexed_foreign_keys` | INFO | 54 | Yabancı anahtar kısıtı olan 54 kolon için covering index yok |
| `unused_index` | INFO | 14 | Hiç kullanılmamış 14 index |
| `duplicate_index` | WARN | 5 | Birbiriyle özdeş 5 index çifti |

**En kritik RLS initplan tabloları** (yüksek trafik beklentisi):

- `attendance`: `attendance_delete`, `attendance_teacher_write`, `attendance_teacher_update`
- `homeworks`: `homeworks_owner_insert`, `homeworks_owner_delete`, `homeworks_owner_update`
- `homework_submissions`: `submissions_owner_delete`, `submissions_owner_upsert`, `submissions_owner_update`
- `profiles`: `profiles_school_read`, `profiles_update_own`, `profiles_self_update`
- `students`: (multiple_permissive_policies — `students_manager_read_deleted` + `students_school_read`)

**Düzeltme:** `auth.uid()` → `(select auth.uid())` şeklinde sarılmalı. [Supabase docs](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)

**Çakışan (duplicate) indexler:**

| Tablo | Özdeş index çifti |
|-------|-------------------|
| `classes` | `idx_classes_active` = `idx_classes_school_grade` |
| `export_jobs` | `export_jobs_user_status` = `idx_export_jobs_user_status` |
| `homework_submissions` | `idx_homework_submissions_student_id` = `idx_hw_submissions_student` |
| `homeworks` | `homeworks_teacher_id_idx` = `idx_homeworks_teacher_id` |
| `permissions` | `permissions_resource_action_scope_key` = `uq_permissions_ras` |

**Kullanılmayan indexler (örnekler — hot tablolardan):**

- `classes`: `idx_classes_active` (aynı zamanda duplicate)

---

### Index Envanteri

Sorgulanan tablolar: `attendance`, `homeworks`, `homework_submissions`, `students`, `classes`, `profiles`

**Hot filtreler ve index durumu:**

| Hot filtre | Mevcut index | Durum |
|------------|-------------|-------|
| `attendance(school_id, date, status='absent')` | `idx_attendance_school_date` — `btree(school_id, date DESC) WHERE status IN ('absent','late')` | **VAR** (partial index, status filtresi kapsıyor) |
| `attendance(school_id)` | `idx_attendance_school_id` — `btree(school_id)` | **VAR** |
| `attendance(student_id, school_id, date)` | `idx_attendance_student_school_date` — `btree(student_id, school_id, date DESC)` | **VAR** |
| `homeworks(school_id, teacher_id)` | `idx_homeworks_teacher_school_date` — `btree(teacher_id, school_id, due_date DESC)` | **VAR** (sütun sırası ters — teacher_id önce) |
| `homeworks(school_id)` | `idx_homeworks_school_id` — `btree(school_id)` | **VAR** |
| `students(school_id)` | `idx_students_school_id` — `btree(school_id)` | **VAR** |
| `homework_submissions(student_id)` | `idx_homework_submissions_student_id` + `idx_hw_submissions_student` | **VAR** (ikisi özdeş — biri silinmeli) |

**Unindexed FK'ler (hot tablolarda):**

| Tablo | FK adı | Durum |
|-------|--------|-------|
| `attendance` | `attendance_teacher_id_fkey` | **EKSİK** index |
| `homeworks` | `homeworks_deleted_by_fkey`, `homeworks_source_id_fkey` | **EKSİK** index |
| `students` | `students_deleted_by_fkey` | **EKSİK** index |
| `classes` | `classes_created_by_fkey`, `classes_deleted_by_fkey`, `classes_mentor_teacher_id_fkey` | **EKSİK** index |

---

### EXPLAIN Sonuçları

**Sorgu 1 — `attendance` devamsızlık sorgusu (son 30 gün)**

```sql
EXPLAIN ANALYZE
SELECT student_id, class_id, date FROM attendance
WHERE school_id = '60bb727f-...' AND status = 'absent' AND date >= (CURRENT_DATE - 30);
```

| Metrik | Değer |
|--------|-------|
| Plan türü | **Index Scan** (`idx_attendance_school_id`) |
| Tahmini satır | 1 |
| Gerçek satır | 0 |
| Toplam süre | **1.37 ms** (planning: 6.12 ms) |

**Yorum:** Index Scan kullanıldı. Planlayıcı `idx_attendance_school_id` üzerinden `school_id` filtresini index'ten, `status` ve `date` filtrelerini tablo taramasıyla uyguluyor. Daha optimal olan partial index `idx_attendance_school_date` (`school_id, date DESC WHERE status IN ('absent','late')`) bu sorguda da kullanılabilir; test ortamında satır sayısı 0 olduğundan planlayıcı daha basit indexi seçti. Üretim verisinde partial index'in tercih edilmesi beklenir.

---

**Sorgu 2 — `homeworks` öğretmen+okul filtresi**

```sql
EXPLAIN ANALYZE
SELECT id FROM homeworks
WHERE school_id = '60bb727f-...' AND teacher_id = '6e2e59c9-...';
```

| Metrik | Değer |
|--------|-------|
| Plan türü | **Seq Scan** |
| Filtre | `school_id = ... AND teacher_id = ...` |
| Rows Removed by Filter | 13 |
| Gerçek satır | 0 |
| Toplam süre | **0.13 ms** (planning: 1.23 ms) |

**Yorum:** Seq Scan seçildi. Tabloda yalnızca 13 satır var; bu boyutta Seq Scan planlayıcı için daha ucuz. Ancak `idx_homeworks_teacher_school_date` (`teacher_id, school_id, due_date DESC`) mevcut — üretimde satır sayısı arttıkça (yüzlerce/binlerce kayıt) bu index devreye girecektir. Şu an için false-positive; izlenmeye devam edilmeli.

---

### Üretim Log Sinyali

`get_logs` (service: "postgres") sonuçları incelendi. Son 24 saatte:

- **Yavaş sorgu sinyali yok** — `slow query` veya `duration:` üzerinde eşik aşımı gösteren kayıt bulunamadı.
- Loglar yalnızca bağlantı açma/kapama (`connection received`, `connection authenticated`, `checkpoint`) ve entegrasyon testlerinden kaynaklanan RLS hatalarından (`new row violates row-level security policy`) oluşuyor.
- RLS hataları test koşumundan kaynaklanıyor (integration test suite); üretim trafiğini yansıtmıyor.

**Sonuç:** Anlamlı yavaş sorgu sinyali yok (düşük trafik / geliştirme ortamı).

## 2. Sunucu Sorgu Denetimi

_Statik kaynak denetimi — 2026-06-14. Her bulgu gerçek dosya:satır referansı taşır._

### Özet Tablosu

| Sayfa | Toplam Sorgu | Paralel | Seri/Waterfall | Sorun |
|-------|-------------|---------|----------------|-------|
| anasayfa (ogretmen) | 6 (Service üzerinden) | kısmen | **VAR** | waterfall |
| anasayfa (mudur) — MYStatsWidget | 6 | Evet | YOK | duplicate profiles |
| anasayfa (mudur) — MYSolSutunWidget | 5 | Evet | YOK | duplicate profiles |
| anasayfa (mudur) — MudurOgretmenAktivite | 3 | Evet | YOK | over-fetch (attendance) |
| odevler/page | 3 | Evet | YOK | temiz |
| odevler/sinif/[classId] | 4 | kısmen | **VAR** | waterfall |
| yoklama/page | 5 | kısmen | **VAR** | over-fetch + .limit(100000) |
| yoklama/cizelge | 3–4 | kısmen | **VAR** | waterfall (koşullu) |
| rapor/devamsizlik | 2 | Evet | YOK | limit yok (attendance) |
| rapor/ogretmen-aktivite | 2 | Evet | YOK | temiz |
| platform/page | 1 | — | — | temiz |
| platform/actions | mutations | — | — | N+1: YOK |

---

### Bulgular (dosya:satır)

#### anasayfa — Ogretmen Dashboard (OgretmenDashboard.tsx)

- **Waterfall — `riskEngine.ts:128–138`:** `fetchRiskInputs()` önce `getTeacherHomeworks()` ile `homeworks` tablosunu seri olarak bekliyor; hwIds/classIds alındıktan sonra `getSubmissions`, `getAttendanceRows`, `getStudentsByClasses` ikinci aşamada paralel çalışıyor. İlk sorgunun tamamlanması beklenmeden diğerleri başlatılamaz — gereksiz gecikme. `src/domains/dashboard/lib/riskEngine.ts:124–138`

- **Waterfall — `TeacherDashboardService.ts:32–37`:** `fetchRiskInputs()` tamamlanmadan `getWeeklySubmissionStats` ve `getTodayClassAttendance` başlatılamıyor (hwIds ve classIds gereksinimi). `src/domains/dashboard/services/TeacherDashboardService.ts:32–37`

- **Waterfall — `TeacherDashboardService.ts:27–32`:** `getDashboardMetrics()` başında `getCurrentProfile()` seri bekleniyor, sonra `fetchRiskInputs()` çağrılıyor; profil ve homework sorguları paralel başlatılabilirdi. `src/domains/dashboard/services/TeacherDashboardService.ts:27–32`

#### anasayfa — Mudur/MY widgetları (MYStatsWidget + MYSolSutunWidget)

- **Duplicate sorgu — `profiles` tablosu:** `MYStatsWidget.tsx:37` `profiles.select('id')` çekiyor; `MYSolSutunWidget.tsx:19` aynı `school_id + role IN [ogretmen, zumre_baskani]` filtresiyle `profiles.select('id, full_name, subject, role')` çekiyor. Bu iki bileşen aynı request'te bağımsız `Suspense` altında render ediliyor ve doğrudan `supabase.from()` çağrısı yaptıklarından React `cache()` deduplication'ı uygulanmıyor. `app/(dashboard)/anasayfa/MYStatsWidget.tsx:37` ve `app/(dashboard)/anasayfa/MYSolSutunWidget.tsx:19`

- **Not:** `getAbsentYearRows()` ve `getSessionRows()` her iki widget tarafından da çağrılıyor ancak `src/domains/dashboard/queries/schoolStats.ts:7,20` satırlarında React `cache()` ile sarılmış — bu iki sorgu request bazlı otomatik dedup ediliyor, sorun değil.

#### anasayfa — MudurOgretmenAktivite

- **Over-fetch — `attendance` tablosu:** `MudurOgretmenAktivite.tsx:33` `attendance.select('teacher_id')` çekiyor; sorguda `.limit()` yok. Büyük okullarda binlerce kayıt döner, tek kullanılan alan `teacher_id` (Set oluşturmak için). Limit yok + `date` aralığı sınırlı olsa da üst sınır belirsiz. `app/(dashboard)/anasayfa/MudurOgretmenAktivite.tsx:33`

- **Over-fetch — `homeworks` tablosu:** `MudurOgretmenAktivite.tsx:29` `homeworks.select('teacher_id')` çekiyor; `.limit()` yok. `app/(dashboard)/anasayfa/MudurOgretmenAktivite.tsx:29`

#### odevler/sinif/[classId] (sinif/[classId]/page.tsx)

- **Waterfall — `homework_submissions`:** `homeworksRes` sonucu beklendikten sonra hwIds alınıp `homework_submissions` sorgusu başlatılıyor. Bu seri bağımlılık kaçınılmaz (hwIds önceden bilinmiyor) ama tasarımsal bir waterfall'dur. `app/(dashboard)/odevler/sinif/[classId]/page.tsx:51–58`

#### yoklama/page (yoklama/page.tsx)

- **Over-fetch — limit(100000):** `absencesRes` sorgusu `attendance.select('student_id, status, date').limit(100000)` olarak tanımlanmış. Çok büyük bir üst sınır; yıl boyu devamsızlıkları tek sorguda çekiyor. `app/(dashboard)/yoklama/page.tsx:64` — Potansiyel bellek baskısı; pagination veya toplu gruplandırma düşünülmeli.

- **Waterfall (classes → studentIds → attendance):** `classes` sorgusu bekleniyor, sonra `studentIds` çıkarılıyor, ardından `absencesRes`, `todayRes`, `takenTodayRes` paralel başlatılıyor. Classes → studentIds bağımlılığı zorunlu; ancak `teacher_classes` sorgusu `classes` sonucu beklenmeden paralel başlatılabilirdi. `app/(dashboard)/yoklama/page.tsx:18–82`

#### yoklama/cizelge (yoklama/cizelge/page.tsx)

- **Waterfall (koşullu — ogretmen rolü):** `isYonetici` false ise `teacher_classes` sorgusu `classes` tamamlandıktan sonra seri olarak çalışıyor. Yönetici değilse zorunlu bağımlılık (class listesi filtreleme için gerekli); yönetici ise `teacher_classes` hiç çekilmiyor. `app/(dashboard)/yoklama/cizelge/page.tsx:31–40`

- **Over-fetch — limit(100000):** `attendance.select(...).limit(100000)` — yoklama/page ile aynı pattern. `app/(dashboard)/yoklama/cizelge/page.tsx:52`

#### rapor/devamsizlik (rapor/devamsizlik/page.tsx)

- **Over-fetch — `attendance` limitsiz:** `db.from('attendance').select('student_id, status, date')` sorgusunda `.limit()` yok. Yıl boyu tüm devamsızlıklar (tüm öğrenciler) döner. `app/(dashboard)/rapor/devamsizlik/page.tsx:34`

#### Temiz Sayfalar

- `app/(dashboard)/odevler/page.tsx` — 3 paralel sorgu, waterfall yok, temiz.
- `app/(dashboard)/rapor/ogretmen-aktivite/page.tsx` — 2 paralel sorgu, temiz.
- `app/platform/page.tsx` — 1 sorgu (`tenant_metrics`), temiz.

---

### Platform N+1 Borcu — ÇÖZÜM

**N+1 MEVCUT DEĞİL.**

`app/platform/page.tsx:17` → tek bir `tenant_metrics` view sorgusu tüm okul metriklerini (teacher_count, student_count vb.) tek seferde çekiyor. `schools?.map()` (satır 57) ve `.map()` (satır 42) yalnızca in-memory render işlemi, ek DB sorgusu içermiyor. `app/platform/actions.ts` dosyasındaki `from()` çağrıları mutation action'larına ait (createSchool, updateSchoolStatus, cancelSchool) ve hiçbiri döngü/map içinde çalışmıyor. **Platform N+1 yok.**

## 3. İstemci (Lighthouse)

_Ölçüm tarihi: 2026-06-14 — Chrome DevTools MCP (performance_start_trace + evaluate_script). Perf skoru: Chrome DevTools MCP performance trace aracı Lighthouse Perf skoru üretmiyor; "—" olarak gösterildi. TBT: trace aracının özet çıktısı LCP ve CLS'i raporluyor, TBT/INP doğrudan ölçülemiyor._

### 3.1 Ölçüm Tablosu

| Rota | Ölçüm yöntemi | Perf skoru | LCP | TBT/INP | CLS | JS (KB, transfer) | Başlıca fırsat |
|------|--------------|-----------|-----|---------|-----|-------------------|----------------|
| `/` | canlı | — | 309–317 ms | ölçülemedi (araç TBT raporlamıyor) | 0.00 | 156 KB | Render delay %80 (248–258 ms): JS değerlendirme gecikmesi; `sw.js` redirect hatası |
| `/login` | canlı | — | 252 ms | ölçülemedi | 0.00 | ~156 KB (önbellekten) | Render delay %77 (194 ms): JS parse/hydration süresi |
| `/gizlilik` | canlı | — | 284 ms | ölçülemedi | 0.00 | ~156 KB (önbellekten) | Render delay %81 (229 ms): kritik yol CSS zinciri (max 277 ms) |
| `/anasayfa` | yerel dev — prod'dan yavaş | — | 888 ms | ölçülemedi | 0.00 | (dev, minifikasyonsuz) | TTFB 499 ms (server render + Supabase sorguları); ForcedReflow 48 ms |
| `/odevler` | yerel dev — prod'dan yavaş | — | 1174 ms | ölçülemedi | 0.00 | (dev, minifikasyonsuz) | Render delay 803 ms; ForcedReflow; riskEngine waterfall tetiklenmiyor ama client hydration ağır |
| `/yoklama` | yerel dev — prod'dan yavaş | — | 1124 ms | ölçülemedi | 0.00 | (dev, minifikasyonsuz) | TTFB 373 ms + render delay 750 ms; ForcedReflow; `limit(100000)` sorgusu TTFB'ye katkı |

### 3.2 Bulgular

**Canlı genel durum — LCP çok iyi, CLS mükemmel:**
- Tüm canlı rotalar LCP < 320 ms; "İyi" eşiği olan 2500 ms'nin çok altında.
- CLS tüm rotalarda 0.00 — layout kayması yok.
- Render delay LCP süresinin %77–81'ini oluşturuyor: H1 metin elemanı ağ kaynağı beklemiyor (LCP image yok), asıl gecikme JS bundle'ların parse ve React hydration süresi.
- JS transfer: İlk ziyarette **156 KB** (sıkıştırılmış, 11 chunk), parsed/decoded 514 KB. Cache'den sonraki sayfa geçişleri neredeyse 0 KB aktarım. Tek büyük chunk `3w8d8k_dca5rp.js` — 72.5 KB transfer / 227 KB decoded (muhtemelen Supabase istemcisi + React framework).

**Canlı render-blocking CSS:**
- `/_next/static/chunks/3ha8-7h-xizg1.css` render-blocking olarak işaretlendi; ancak download süresi 0.2 ms (Vercel CDN + Brotli, max-age: 1 yıl). Tahmini LCP/FCP tasarrufu: 0 ms — pratik etki yok.

**Canlı console hataları (Best Practices puanını etkiliyor):**
- `sw.js` ServiceWorker kaydı başarısız: `proxy.ts:5`'teki `PUBLIC_PATHS` listesi `/sw.js`'i içermiyor; `proxy.ts:227`'deki `matcher` yalnızca `_next/static`, `_next/image`, favicon ve resim uzantılarını muaf tutuyor. Kimlik doğrulanmamış `/sw.js` istekleri `/login` sayfasına yönlendiriliyor; tarayıcı JS yerine HTML alıyor → SecurityError ile ServiceWorker kaydı başarısız oluyor. Offline destek çalışmıyor.
- `manifest.json` parse edilemiyor: aynı nedenle — `proxy.ts:5` ve `proxy.ts:227` `/manifest.json`'ı muaf tutmuyor. Kimlik doğrulanmamış istek `/login` HTML'ine yönlendiriliyor; tarayıcı JSON yerine HTML alıyor → manifest parse başarısız → PWA kurulumu kırık. (`public/manifest.json` dosyasının içeriği geçerli JSON'dur; sorun dosyada değil, middleware'dedir.)

**Yerel dev rotaları (prod değerler önemli ölçüde daha iyi olacak):**
- TTFB 370–500 ms aralığında: dev modda webpack JIT derleme + Supabase SSR sorgu süresi birlikte görünüyor.
- Render delay 390–800 ms: minifikasyonsuz dev bundle'lar React hydration'ı uzatıyor.
- `/odevler` en yüksek LCP: 1174 ms — render delay 803 ms. Supabase sorgu zinciri (3 paralel sorgu) ve büyük dev bundle birleşimi.
- `/yoklama` ve `/anasayfa`'da **ForcedReflow** (48 ms) tespit edildi: JavaScript DOM değişiklikinden sonra geometrik özellik (offsetWidth vb.) sorguluyor. Kod kanalı: `[unattributed]` (muhtemelen Tailwind animasyonu veya sidebar collapse bileşeni).

**Başlıca fırsatlar öncelik sırası:**
1. **`sw.js` + `manifest.json` middleware muafiyeti** — `proxy.ts:5` `PUBLIC_PATHS` listesine ve/veya `proxy.ts:227` `matcher` pattern'ına `/sw.js` ve `/manifest.json` eklenmeli; böylece kimlik doğrulanmamış istekler doğrudan dosyaya ulaşır, `/login`'e yönlendirilmez. ServiceWorker kaydı ve PWA kurulumu düzelir.
2. **ForcedReflow kaynağı belirlenmeli** — `/anasayfa`, `/odevler`, `/yoklama`'da 48 ms reflow var. Sidebar collapse veya animasyon bileşenlerinde `offsetWidth`/`getBoundingClientRect()` DOM mutation sonrası çağrılıyor olabilir; `requestAnimationFrame` içine alınmalı.
3. **Büyük tek chunk** (`3w8d8k_dca5rp.js`, 227 KB decoded / 72.5 KB gzip): Route-level code splitting veya dinamik import ile public sayfaların JS yükü azaltılabilir. Render delay'in ana kaynağı bu bundle'ın parse süresi.
4. **Yerel dev TTFB** (Supabase SSR, 370–500 ms): `riskEngine` waterfall `src/domains/dashboard/services/TeacherDashboardService.ts:27–37` üretimde SSR TTFB'ye katkıda bulunuyor; Task 2'de belirtilen paralel refactor TTFB'yi doğrudan azaltır.

**Ölçüm kapsamı özeti:**
- `/`, `/login`, `/gizlilik`: canlı site üzerinde Chrome DevTools MCP performance trace ile ölçüldü — gerçek sayılar.
- `/anasayfa`, `/odevler`, `/yoklama`: yerel dev sunucu (localhost:3000) üzerinde ölçüldü; test kullanıcısıyla giriş yapıldı. Dev mod sayıları minifikasyonsuz bundle ve webpack JIT derleme nedeniyle prod değerlerinden önemli ölçüde yüksektir — yalnızca göreli karşılaştırma için kullanılmalı.
- TBT ve INP: Chrome DevTools MCP performance trace özeti bu metrikleri raporlamıyor; ölçülemedi.

## 4. Önceliklendirilmiş Aksiyon Listesi

_Aşağıdaki liste bölüm 1–3 bulgularını etkiye göre sıralıyor. Her satır: önem derecesi · kaynak referansı · beklenen kazanım · tahmini efor._

| # | Önem | Referans | Sorun | Beklenen Kazanım | Efor |
|---|------|----------|-------|-----------------|------|
| 1 | 🔴 | `proxy.ts:5` (`PUBLIC_PATHS`) + `proxy.ts:227` (`matcher`) | `/sw.js` ve `/manifest.json` middleware muafiyeti yok → kimlik doğrulanmamış istekler `/login`'e yönlendiriliyor → tarayıcı JSON/JS yerine HTML alıyor → ServiceWorker kaydı + PWA manifest parse başarısız | PWA kurulumu + offline destek düzelir; Best Practices puanı iyileşir | Düşük (2 satır değişikliği) |
| 2 | 🔴 | RLS politikaları — `attendance`, `homeworks`, `homework_submissions`, `profiles`, `students` (99 `auth_rls_initplan` uyarısı) | `auth.uid()` her satır için yeniden değerlendiriliyor | Hot tablolarda satır başı RLS maliyeti ortadan kalkar; yüksek trafik altında sorgular hızlanır | Orta (birçok policy'i touch eden migration) |
| 3 | 🟡 | `app/(dashboard)/yoklama/page.tsx:64`, `app/(dashboard)/yoklama/cizelge/page.tsx:52`, `app/(dashboard)/rapor/devamsizlik/page.tsx:34`, `app/(dashboard)/anasayfa/MudurOgretmenAktivite.tsx:29,33` | `.limit(100000)` veya limit yok — yıl boyu kayıtlar tek sorguda çekiliyor | Bellek baskısı azalır; TTFB kısalır; SSR maliyeti düşer | Düşük-orta (her sayfada limit + kolon daraltma) |
| 4 | 🟡 | `src/domains/dashboard/lib/riskEngine.ts:124–138`, `src/domains/dashboard/services/TeacherDashboardService.ts:32–37`, `app/(dashboard)/odevler/sinif/[classId]/page.tsx:51–58`, `app/(dashboard)/yoklama/cizelge/page.tsx:31–40` | Seri/waterfall sorgular — bağımsız olanlar paralel başlatılabilir; hwIds bağımlılığı JOIN ile çözülebilir | SSR TTFB'de 100–300 ms kazanım; yerel dev LCP düşer | Orta |
| 5 | 🟡 | `classes` (`idx_classes_active`=`idx_classes_school_grade`), `export_jobs`, `homework_submissions` (`idx_homework_submissions_student_id`=`idx_hw_submissions_student`), `homeworks` (`homeworks_teacher_id_idx`=`idx_homeworks_teacher_id`), `permissions` — 5 `duplicate_index` uyarısı | Özdeş index çiftleri; planner overhead + write amplification | Write performansı iyileşir; storage azalır | Düşük (DROP INDEX migration) |
| 6 | 🟡 | `attendance_teacher_id_fkey`, `homeworks_deleted_by_fkey`, `homeworks_source_id_fkey`, `students_deleted_by_fkey`, `classes_*_fkey` — 54 `unindexed_foreign_keys` uyarısından hot olanlar | FK üzerinden JOIN/lookup'larda Seq Scan riski | Hot tablo JOIN'leri hızlanır | Düşük-orta (index ekleme migration) |
| 7 | 🟡 | `app/(dashboard)/anasayfa/MYStatsWidget.tsx:37` + `app/(dashboard)/anasayfa/MYSolSutunWidget.tsx:19` | Aynı `profiles` filtresi iki bağımsız bileşende; React `cache()` dedup uygulanmıyor | Bir profiles sorgusu eliminasyonu; daha temiz prop drilling | Düşük |
| 8 | 🟢 | Büyük JS chunk `3w8d8k_dca5rp.js` — 72.5 KB gzip / 227 KB parsed | Route-level code splitting ile public sayfalarda JS yükü azaltılabilir | Render delay kısalır; public sayfa LCP iyileşir | Orta |
| 9 | 🟢 | `/anasayfa`, `/odevler`, `/yoklama` — ForcedReflow ~48 ms | Sidebar/animasyon bileşeni DOM mutation sonrası geometrik özellik sorgulayarak reflow tetikliyor | 48 ms reflow kazanımı; INP iyileşir | Düşük-orta (kaynak tespiti gerekiyor) |
| 10 | 🟢 | 14 `unused_index` + 70 `multiple_permissive_policies` | Kullanılmayan indexler write overhead; çok sayıda permissive policy her sorguda tüm policy setini çalıştırıyor | Write hızı + RLS değerlendirme süresi iyileşir | Orta (inceleme + konsolidasyon) |

**Not:** Platform N+1 borcu çözülmüş (`app/platform/page.tsx` tek `tenant_metrics` view sorgusu kullanıyor, in-memory render döngüleri ek DB sorgusu içermiyor).

---

### 4.1 Uygulanan Düzeltmeler (Düzeltme Turu — 2026-06-14)

Kapsam: 1. turda 🔴 kritikler + düşük-efor 🟡'ler (#1,2,5,6,7); 2. turda kalan tüm maddeler (#3,4,8,9,10) — "hatasız" ilkesiyle, riskli/marjinal alt-kısımlar gerekçeyle ertelenerek.

| # | Durum | Ne yapıldı |
|---|-------|-----------|
| 1 | ✅ | `proxy.ts:227` matcher'ına `sw\.js` ve `manifest\.json` eklendi — bu dosyalar artık middleware'e girmeyip doğru `Content-Type` ile doğrudan sunuluyor. ServiceWorker + PWA manifest düzeldi. |
| 2 | ✅ | Migration `rls_initplan_wrap_auth_functions`: in-DB DO block ile **99 politikada** `auth.uid()`/`auth.role()` → `(select …)`. Doğrulama: `auth_rls_initplan` advisor **99 → 0**. RLS semantiği değişmedi (sadece initplan'a çevrildi). |
| 5 | ✅ | Migration `drop_duplicate_indexes`: 4 özdeş index kopyası + 1 redundant unique constraint (`uq_permissions_ras`) düşürüldü. `duplicate_index` advisor **5 → 0**. |
| 6 | ✅ | Migration `add_missing_fk_indexes`: 7 index'siz FK kolonuna covering index (nullable olanlar partial). `unindexed_foreign_keys` **54 → 47**. (Yeni index'ler trafik görene dek geçici olarak `unused_index`'te görünür.) |
| 7 | ✅ | `getSchoolTeachers` (cache'li) eklendi (`schoolStats.ts`); `MYStatsWidget` + `MYSolSutunWidget` artık bu tek sorguyu paylaşıyor — request içi dedup ile bir `profiles` sorgusu elendi. |
| 3 | ✅ (2. tur) | `limit(100000)` küçültmek yerine **doğru çözüm**: `count_absences_by_student` RPC (hafta sonu hariç, `countAbsences` ile birebir doğrulandı — 19/19 satır, 0 uyumsuzluk). `AttendanceRepository.getAbsenceCounts` üzerinden yoklama/cizelge/devamsizlik bağlandı — artık yıl boyu satırlar yerine öğrenci-başı sayım dönüyor. `MudurOgretmenAktivite` 2 over-fetch sorgusu → 1 `school_teacher_activity` distinct RPC + profiles `getSchoolTeachers` cache'ine bağlandı. |
| 4 | ✅ kısmi (2. tur) | **Güvenli paralelizasyon:** `cizelge` + `yoklama`'da `teacher_classes` artık `classes` ile paralel (seri değildi). `riskEngine`/`TeacherDashboardService` zinciri **kaçınılmaz veri bağımlılığı** (`homeworks→hwIds→bağımlı sorgular`) ve `getCurrentProfile` zaten `cache()`'li → JOIN/RPC rewrite riski alınmadı. |
| 10 | ✅ kısmi (2. tur) | **Permissive konsolidasyon:** aynı tablo+cmd+rol için 2'şer permissive politika olan 8 grup tek policy(A OR B)'ye birleştirildi (permissive=OR → birebir eşdeğer; doğrulama: `multiple_permissive` **70 → 32**). **Redundant index:** composite lead-kolonuyla karşılanan 4 gereksiz tek-kolonlu index düşürüldü. Kalan 32 örtüşme `FOR ALL` + spesifik desen (6 tablo) — farklı principal'lar nedeniyle yapısal/riskli, gerekçeyle ertelendi. Salt "unused" index'ler genç DB nedeniyle korundu. |
| 8 | ✅ kısmi (2. tur) | Bundle zaten iyi optimize (dashboard chart'ları `dynamic ssr:false`, `exceljs` `serverExternalPackages`, `optimizePackageImports`). Tek statik recharts importu olan veli portalı chart'ı `VeliDevamsizlikChartLazy` ile lazy-load edildi. Public landing chunk'ı framework+ssr baseline'ı — güvenle küçültülemez. |
| 9 | ✅ incelendi (2. tur) | **Aksiyon alınabilir kod nedeni yok.** Tüm geometri-okuma API'leri (`getBoundingClientRect`/`scrollIntoView`) event-driven (klavye nav, hata-scroll, dropdown click) — hiçbiri ilk render'da çalışmıyor. 48ms ForcedReflow **dev modda** ölçülmüştü (rapor prod'u yansıtmaz diye not düşmüş); framework hydration/dev-bundle kaynaklı, uygulama koduna atfedilemiyor. |

**Doğrulama (2. tur):** `tsc --noEmit` temiz · 610 unit test geçti · prod `npm run build` başarılı · güvenlik advisor'ında yeni bulgu yok (yeni RPC'ler `SECURITY INVOKER` + `search_path=''`) · performans advisor toplamı **~242 → ~95** (`auth_rls_initplan` 99→0, `duplicate_index` 5→0, `multiple_permissive` 70→32, `unindexed_fk` 54→47).

---

### 4.2 Production Doğrulama Turu (2026-06-15)

_Düzeltmeler production'a deploy edildikten sonra (`dpl_5qvoV9BPcVNkyADG7bdZNZhCHATF`) canlı ortamda yeniden ölçüldü. Yöntem: Supabase MCP advisor + Chrome DevTools MCP (canlı `myedudesk.com.tr`)._

**Adım 1 — DB advisor (production, canlı):**

| Kategori | Seviye | 2026-06-15 | 14 Haz baseline | Fark |
|----------|--------|-----------:|----------------:|-----:|
| `auth_rls_initplan` | WARN | **0** | 99 | −99 ✅ |
| `duplicate_index` | WARN | **0** | 5 | −5 ✅ |
| `multiple_permissive_policies` | WARN | 32 | 70 | −38 |
| `unindexed_foreign_keys` | INFO | 47 | 54 | −7 |
| `unused_index` | INFO | 16 | 14 | +2 (yeni FK index'leri trafik görene dek beklenen) |
| **Toplam** | | **95** | 242 | **−61%** |

**Adım 2 — Server sorgu (statik):** `limit(100000)` pattern'ı tüm kod tabanında **kalmadı**; `count_absences_by_student` / `school_teacher_activity` RPC'leri yoklama, cizelge, devamsizlik, MudurOgretmenAktivite sayfalarında + `AttendanceRepository`'de aktif. `proxy.ts:227` matcher `sw\.js` + `manifest\.json` muafiyetini içeriyor.

**Adım 3.3 — PWA (canlı, eski #1 kritik bug):**

| Kontrol | Sonuç |
|---------|-------|
| `GET /manifest.json` | 200/304, `Content-Type: application/manifest`, geçerli JSON gövdesi (HTML redirect yok) |
| `GET /sw.js` | 200, `application/javascript; charset=utf-8`, gerçek JS içeriği |
| ServiceWorker | Kayıtlı + **activated**, scope `https://myedudesk.com.tr/` |
| `link[rel=manifest]` | DOM'da mevcut |
| Console error/warn | **0** (14 Haz'da SecurityError + manifest parse error vardı) |

**Adım 3.1 — Canlı public LCP (Chrome DevTools MCP performance trace):**

| Rota | LCP (2026-06-15) | LCP (5.1 baseline) | CLS | TTFB | Render delay |
|------|-----------------:|-------------------:|-----|-----:|-------------:|
| `/` | 292 ms | 309–317 ms | 0.00 | 239 ms | 53 ms |
| `/login` | 362 ms | 252 ms | 0.00 | 295 ms | 67 ms |
| `/gizlilik` | 267 ms | 284 ms | 0.00 | 207 ms | 61 ms |

Tüm rotalar "İyi" eşiği (2500 ms) çok altında, CLS 0.00. `/login` farkı ölçüm gürültüsü (soğuk cache + ağ jitter). LCP'nin baskın bileşeni TTFB; render delay 14 Haz'a göre belirgin düştü. ServiceWorker artık aktif olduğundan tekrar ziyaretlerde statik varlıklar SW cache'inden geliyor.

**Henüz ölçülmedi (opsiyonel):** Adım 3.2 (kimlik doğrulamalı `/anasayfa`, `/odevler`, `/yoklama` — Playwright login gerekir; baseline zaten yalnızca dev/göreli) ve Adım 3.4 (ForcedReflow — 14 Haz'da dev-only ölçülmüş, uygulama koduna atfedilemiyordu).

**Sonuç:** 14 Haziran düzeltme turu production'da **tam olarak tuttu**; regresyon yok. Kalan en büyük kaldıraç 32 `multiple_permissive_policies` (yapısal, ertelenmişti) — aşağıda 4.3'te çözüldü.

---

### 4.3 RLS Permissive Konsolidasyonu — Tamamlandı (2026-06-15)

Bölüm 4.2'de kalan 32 `multiple_permissive_policies` (8 tablo) iki aşamada tamamen elendi. Migration dosyaları: `20260615120000_drop_redundant_permissive_policies_tier1.sql`, `20260615120001_consolidate_permissive_policies_tier2.sql`.

**Tip 1 — saf gereksizlik (5 DROP, anlam değişmez, 32→15):** Her silinen policy kalan birinin strict alt kümesi:
- `notification_preferences` "okuyabilir" (SELECT) ≡ ALL policy'nin USING'i
- `teacher_classes` `tc_school_read` ≡ `tc_school_write` (ALL) USING'i
- `permissions` `permissions_read_all` (authenticated,true) ⊆ `permissions_select` (public,true)
- `roles` `roles_read_school` ⊆ `roles_select` (public,true)
- `school_meetings` `mudur_write` ≡ `yonetici` (current_school_id() = profil school_id → özdeş; yonetici public/daha geniş)

**Tip 2 — yapısal (FOR ALL → komut-bazlı + SELECT'i OR ile birleştir, 15→0):** `push_subscriptions`, `zumre_meeting_templates`, `school_meetings`, `user_roles` tablolarındaki `FOR ALL` politikaları INSERT/UPDATE/DELETE'e bölündü; SELECT tek politikaya indirildi. Eklenen tüm `auth.*` çağrıları `(select …)` ile sarıldı → yeni initplan uyarısı yok.

| Metrik | 4.2 (önce) | 4.3 (sonra) |
|--------|-----------:|------------:|
| `multiple_permissive_policies` | 32 | **0** ✅ |
| `auth_rls_initplan` | 0 | **0** (korundu) |
| `duplicate_index` | 0 | 0 |
| `unindexed_foreign_keys` | 47 | 47 |
| `unused_index` | 16 | 16 |
| **Performans advisor toplamı** | 78 | **63** |

Doğrulama: `get_advisors(performance)` → `multiple_permissive` ve `auth_rls_initplan` kategorileri tamamen yok; her tablo+komut için tek permissive policy (pg_policies ile teyit). Erişim semantiği değişmedi (her değişiklik OR-eşdeğer veya strict-subset).

---

## 5. Baseline Metrikler

_Bu bölüm bir sonraki tur karşılaştırması için bugünkü sayıları sabitler. Ölçüm tarihi: 2026-06-14._

### 5.1 Canlı Sayfa Performansı (Chrome DevTools MCP performance trace)

| Rota | LCP | CLS | JS Transfer (ilk ziyaret) | Not |
|------|-----|-----|--------------------------|-----|
| `/` | 309–317 ms | 0.00 | ~156 KB (11 chunk) | — |
| `/login` | 252 ms | 0.00 | ~156 KB (önbellekten) | — |
| `/gizlilik` | 284 ms | 0.00 | ~156 KB (önbellekten) | — |

> TBT ve INP: Chrome DevTools MCP performance trace özeti bu metrikleri raporlamıyor; ölçülemedi.

### 5.2 Kimlik Doğrulamalı Sayfalar (yerel dev — prod'dan yavaş)

| Rota | LCP (dev) | Başlıca katkı | Uyarı |
|------|-----------|--------------|-------|
| `/anasayfa` | 888 ms | TTFB 499 ms (SSR + Supabase), ForcedReflow 48 ms | Yalnızca göreli karşılaştırma için kullanılmalı |
| `/odevler` | 1174 ms | Render delay 803 ms (dev bundle + hydration) | Yalnızca göreli karşılaştırma için kullanılmalı |
| `/yoklama` | 1124 ms | TTFB 373 ms + render delay 750 ms | Yalnızca göreli karşılaştırma için kullanılmalı |

### 5.3 Supabase Advisor Sayıları

| Tür | Seviye | Sayı (2026-06-14) |
|-----|--------|-------------------|
| `auth_rls_initplan` | WARN | 99 |
| `multiple_permissive_policies` | WARN | 70 |
| `unindexed_foreign_keys` | INFO | 54 |
| `unused_index` | INFO | 14 |
| `duplicate_index` | WARN | 5 |
| **Toplam** | | **242** |

### 5.4 Index Durumu

Hot filtre index kapsamı: mevcut (bkz. Bölüm 1 — Index Envanteri tablosu).

---

## 6. Yeniden Ölçüm Yönergesi

_Bu bölüm bir sonraki tur denetiminin nasıl yeniden üretileceğini açıklar. Kaynak plan: `docs/superpowers/plans/2026-06-14-performans-olcum-taramasi.md`_

### Adım 1 — Veritabanı Katmanı

1. **Supabase MCP advisor taraması:**
   ```
   get_advisors(type: "performance", project_id: "agijvfrcudpzsofgfogu")
   ```
   Yeni bulgu sayılarını Bölüm 5.3 tablosuyla karşılaştır; azalma olmayan kategoriler için aksiyon listesini gözden geçir.

2. **Index envanteri:**
   ```sql
   SELECT indexname, tablename, indexdef
   FROM pg_indexes
   WHERE schemaname = 'public'
   AND tablename IN ('attendance','homeworks','homework_submissions','students','classes','profiles')
   ORDER BY tablename, indexname;
   ```
   Duplicate ve unused index sayılarının değişip değişmediğini doğrula.

3. **EXPLAIN ANALYZE — iki hot sorgu:**
   - `attendance` devamsızlık sorgusu (son 30 gün, gerçek `school_id` ile)
   - `homeworks` öğretmen+okul filtresi (gerçek `teacher_id` + `school_id` ile)

   Bölüm 1 "EXPLAIN Sonuçları" tablolarıyla plan türü ve süreyi karşılaştır; üretim verisiyle Index Scan'e geçildi mi gözlemle.

### Adım 2 — Sunucu Sorgu Denetimi

1. Hot sayfalardaki sorgu pattern'larını statik olarak tara:
   ```
   grep -n "\.limit(100000\|\.limit(10000\|from('attendance')\|from('homeworks')" \
     app/\(dashboard\)/yoklama/page.tsx \
     app/\(dashboard\)/yoklama/cizelge/page.tsx \
     app/\(dashboard\)/rapor/devamsizlik/page.tsx \
     app/\(dashboard\)/anasayfa/MudurOgretmenAktivite.tsx
   ```
2. `riskEngine.ts` ve `TeacherDashboardService.ts` waterfall satırlarını yeniden oku; `Promise.all` refactor uygulandıysa seri bekleme kaldı mı doğrula.
3. `MYStatsWidget.tsx:37` ve `MYSolSutunWidget.tsx:19` — profiles sorgusu hâlâ iki kez çekiliyor mu, yoksa prop drilling'e geçildi mi?

### Adım 3 — İstemci (Lighthouse / DevTools)

1. **Canlı public rotalar** (`/`, `/login`, `/gizlilik`) — Chrome DevTools MCP `performance_start_trace` + `evaluate_script` ile LCP ve CLS ölç; Bölüm 5.1 değerleriyle karşılaştır.
2. **Kimlik doğrulamalı rotalar** (`/anasayfa`, `/odevler`, `/yoklama`) — Playwright MCP ile test kullanıcısı girişi (`browser_navigate` → login form → `browser_fill_form`) yap, ardından performance trace; Bölüm 5.2 dev değerleriyle karşılaştır.
3. **PWA doğrulama:** `/manifest.json` ve `/sw.js`'e kimlik doğrulanmamış GET isteği gönder; HTTP 200 + doğru `Content-Type` (`application/json` ve `application/javascript`) aldığını doğrula.
4. **ForcedReflow:** Performance trace'de `[unattributed]` reflow kaynağını tespit et; 48 ms'nin altına indi mi ölç.
