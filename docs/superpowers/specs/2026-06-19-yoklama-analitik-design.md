# Yoklama Analitik — Tasarım

Tarih: 2026-06-19
Yaklaşım: A (ödev analitiğini aynala) — saf compute lib + sayfa + kapsama RPC

## Amaç

Yoklama verisine ödev analitiğinin olgun karşılığını getirmek. Müdür/MY şu an
yalnız ham çizelge + dağınık widget'lar görüyor; sınıflar arası karşılaştırma,
trend, okul geneli kronik devamsızlar ve yoklama-alma disiplini için tek bir
analitik yüzey yok. Veri (attendance tablosu) zaten mevcut.

## Mimari asimetri (gerekçe)

`domains/homework/lib/` altında `analitik.ts` + tam `/odevler/analitik` sayfası
var. `domains/attendance/lib/` altında yalnız `attendanceMath.ts` +
`absenceReport.ts` var — analitik katmanı yok. Bu tasarım o boşluğu kapatır.

## Erişim (ödev analitiğiyle birebir)

- `isTeachingRole(role) || isMudurOrAbove(role)` değilse `/yoklama`'ya redirect.
- Öğretmen → yalnız kendi sınıfları (`teacher_classes`, `teacher_id = user.id`).
- Müdür/MY/zümre başkanı (`isManager`) → tüm okul + **④ Kapsama** bölümü
  (yalnız müdür/MY; aşağıda netleştirildi).
- `isManager = role === 'zumre_baskani' || isMudurOrAbove(role)` (ödev deseni).
  **④ Kapsama bölümü yalnız `isMudurOrAbove`** (yönetici hesap-verebilirlik
  aracı; zümre başkanı görmez).

## Zaman pencereleri

- **KPI + kronik + sınıf karşılaştırma:** `schoolYearStart()`'tan bugüne
  (MEB kümülatif eşik mantığıyla — 15/20 gün — uyumlu).
- **Trend:** son 8 hafta, haftalık.
- **Kapsama:** son 30 gün.

## Veri kaynakları

1. **Devamsızlık satırları:** `attendance` → `status ∈ {absent, late, excused}`,
   `date >= schoolYearStart()`, `school_id` filtreli. Öğretmen ise yalnız kendi
   sınıflarının `class_id`'leri. KPI + kronik + trend + sınıf karşılaştırma
   bunlardan TS'de hesaplanır.
2. **Kapsama RPC'si:** `get_class_attendance_coverage(p_school_id, p_since)` →
   son 30 günde sınıf başına yoklama girilen ayrı gün sayısı. Yalnız ④ için.
3. **classes + students:** isim, sınıf, öğrenci sayısı (payda), profil linki.

`/yoklama` sayfasına "Analitik →" linki eklenir (ödevdeki gibi).

## Sayfa bölümleri

### ① KPI Özet (yıl başından, kullanıcının kapsamında)
4 kart:
- **Toplam özürsüz devamsızlık (gün):** absent×1 + late×0.5 toplamı.
- **Sınırı aşan öğrenci:** özürsüz ≥ `ATTENDANCE_LIMIT_DAYS` (20). Kırmızı.
- **Uyarı bölgesi:** `ATTENDANCE_WARN_DAYS` (15) ≤ özürsüz < 20. Sarı.
- **Bugün yoklama:** bugün yoklaması alınan sınıf / toplam sınıf (örn. "12/18").
  **Dikkat:** "alınan sınıf" = bugün için herhangi bir attendance satırı olan
  ayrı `class_id` sayısı. Mevcut `getTodayClassAttendance` `.neq('status',
  'present')` kullandığından tam-katılımlı sınıfı kaçırır — bu KPI için
  **present filtresiz** ayrı bir sorgu kullanılmalı:
  `attendance.select('class_id').eq('school_id', sid).eq('date', today)` →
  TS'de distinct `class_id` say. (Öğretmen kapsamında yalnız kendi sınıfları.)

### ② Sınıf Karşılaştırma + Trend (yıl başından)
- **Sınıf tablosu:** her sınıf için öğrenci başına ort. özürsüz gün, en kötüden
  iyiye sıralı, mini bar. "9-A · ort. 4.2 gün/öğrenci".
- **Trend (son 8 hafta):** haftalık devamsızlık oranı =
  o haftanın özürsüz günleri / (öğrenci sayısı × o haftanın okul günü).

### ③ Kronik Devamsızlar Sicili (yıl başından, sınıflar arası tek liste)
Özürsüz ≥ 15 olan TÜM öğrenciler tek listede, gün sayısına göre azalan.
Her satır: ad · sınıf · "18 gün" · sınır/uyarı rozeti · öğrenci profili linki
(`/siniflar/[classId]/ogrenciler/[studentId]`).

### ④ Sınıf Yoklama Kapsaması (son 30 gün, YALNIZ müdür/MY)
Her sınıf için kapsama % = yoklama girilen gün / okuldaki gerçek okul günü,
en düşükten sıralı, % bar. "9-A · son 30 günde %60 alınmış". Düşük = kırmızı.

## Önemli teknik bulgu

`YoklamaClient.tsx` kaydederken tüm öğrencileri (present dahil) upsert eder →
present satırları DB'de **vardır**. Ama `getTodayClassAttendance`
`.neq('status','present')` kullanır. Bu yüzden "yoklama alındı mı" present
satırından DEĞİL, **bir (sınıf, tarih) için herhangi bir satırın varlığından**
türetilir. Kapsama RPC'si `count(distinct date)` ile bunu yapar (status filtresi
yok). Present satırları da saklandığı için 30 günlük tüm satırları çekmek ağır
olurdu (sınıf × gün × öğrenci) → RPC ile agregasyon DB'de yapılır.

## Compute lib

`src/domains/attendance/lib/analitik.ts` — saf fonksiyonlar; mevcut
`countAbsences` / `isWeekendISO` (attendanceMath) yeniden kullanılır.

```ts
interface AbsenceRowA  { student_id: string; status: string; date: string }
interface StudentA     { id: string; class_id: string; full_name: string; student_number: string | null }
interface ClassA       { id: string; name: string; grade: number }
interface CoverageRpcRow { class_id: string; covered_days: number }

interface AttendanceKpi {
  totalUnexcused: number
  overLimit:      number
  inWarn:         number
  takenToday:     number
  totalClasses:   number
}
function computeAttendanceKpi(
  rows: AbsenceRowA[], students: StudentA[], takenToday: number, totalClasses: number
): AttendanceKpi

interface ClassAbsenceStat { classId: string; name: string; grade: number; studentCount: number; avgUnexcused: number }
function computeClassAbsence(
  rows: AbsenceRowA[], students: StudentA[], classes: ClassA[]
): ClassAbsenceStat[]   // avgUnexcused azalan

interface WeeklyAbsencePoint { weekStart: string; rate: number }   // rate 0–100
function computeWeeklyAbsenceTrend(
  rows: AbsenceRowA[], studentCount: number, weeks?: number /* =8 */
): WeeklyAbsencePoint[]

interface ChronicAbsentee { studentId: string; name: string; classId: string; className: string; unexcused: number; level: 'warn' | 'danger' }
function computeChronicAbsentees(
  rows: AbsenceRowA[], students: StudentA[], classes: ClassA[], warnDays: number
): ChronicAbsentee[]   // unexcused azalan

interface CoverageStat { classId: string; name: string; coveragePct: number }
function computeCoverage(
  rpcRows: CoverageRpcRow[], classes: ClassA[]
): CoverageStat[]      // coveragePct artan
```

Kurallar:
- `unexcused` = absent×1 + late×0.5, hafta sonu hariç (`countAbsences` zaten böyle).
- `overLimit`: unexcused ≥ 20; `inWarn`: 15 ≤ unexcused < 20.
- Trend `rate`: hafta sonu günleri paydadan düşülür; öğrenci sayısı 0 ise rate 0.
- **Kapsama paydası `schoolDays = max(covered_days)`** (yoklamayı her gün alan
  sınıf paydayı verir; tatilleri eler; ekstra sorgu yok).
  `// ponytail: max(covered_days) paydası; hiçbir sınıf her gün almazsa kapsama
  hafif yüksek görünür — gerçek okul-günü tablosu gerekirse RPC'ye eklenir.`
  `rpcRows` boşsa coverage listesi boş döner (bölün­me yok).

## Kapsama RPC migration

```sql
-- SECURITY INVOKER → attendance RLS okul izolasyonunu zorlar (DEFINER değil)
create or replace function get_class_attendance_coverage(p_school_id uuid, p_since date)
returns table(class_id uuid, covered_days bigint)
language sql
security invoker
set search_path = public
as $$
  select class_id, count(distinct date)
  from attendance
  where school_id = p_school_id and date >= p_since
  group by class_id
$$;
grant execute on function get_class_attendance_coverage(uuid, date) to authenticated;
```

Migration adı: `2026XXXX_get_class_attendance_coverage.sql` (uygulama anındaki
tarihle). RPC SELECT-only; mevcut `attendance` RLS politikaları (okul-içi
authenticated SELECT) izolasyonu sağlar.

## Test

`tests/vitest/unit/domains/attendance/analitik.test.ts` — 5 fonksiyon:
- `computeAttendanceKpi`: boş veri (hepsi 0); eşik sınırları (14→warn değil,
  15→warn, 19→warn, 20→overLimit); late 0.5 katkısı; takenToday/totalClasses
  aynen yansır.
- `computeClassAbsence`: sınıf başına ortalama doğru; öğrencisi olmayan sınıf
  listede yer almaz; azalan sıralama.
- `computeWeeklyAbsenceTrend`: 8 nokta döner; hafta sonu satırı sayılmaz;
  studentCount 0 → rate 0; oran 0–100 aralığında.
- `computeChronicAbsentees`: yalnız ≥15; level eşiği (15–19 warn, ≥20 danger);
  azalan; className doğru eşleşir.
- `computeCoverage`: rpcRows boş → []; coveragePct = covered/max(covered),
  %0 ve %100 uçları; artan sıralama; bilinmeyen class_id atlanır.

Sayfa/bileşenler sunumsal → birim test yok. tsc + build doğrulaması yapılır.

## Değişen/eklenen dosyalar

| Dosya | İşlem |
|---|---|
| `src/domains/attendance/lib/analitik.ts` | yeni (saf compute) |
| `tests/vitest/unit/domains/attendance/analitik.test.ts` | yeni test |
| `supabase/migrations/2026XXXX_get_class_attendance_coverage.sql` | yeni RPC |
| `app/(dashboard)/yoklama/analitik/page.tsx` | yeni (veri+RBAC+compute) |
| `app/(dashboard)/yoklama/analitik/loading.tsx` | yeni skeleton |
| `app/(dashboard)/yoklama/analitik/KpiOzet.tsx` | yeni ① |
| `app/(dashboard)/yoklama/analitik/SinifTrend.tsx` | yeni ② |
| `app/(dashboard)/yoklama/analitik/KronikSicil.tsx` | yeni ③ |
| `app/(dashboard)/yoklama/analitik/SinifKapsama.tsx` | yeni ④ (yalnız müdür/MY) |
| `app/(dashboard)/yoklama/page.tsx` | "Analitik →" linki ekle |

## Kapsam dışı (bilinçli)

- Devamsızlık nedeni/notu (ayrı özellik, ayrı şema).
- Excel dışa aktarım (çizelgede zaten var; analitik için YAGNI).
- Öğretmen-bazlı (kişi) disiplin tablosu — sınıf kapsaması tercih edildi
  (bulanık atfı önler).
- Per-ders yoklama (model sınıf+gün bazında).
