# EduDesk Teknik Borç Düzeltme Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard'un her yüklenişinde DB'ye yazma sorununu, UTC timezone bug'ını, kod tekrarlarını ve güvenlik açıklarını sırayla düzeltmek.

**Architecture:** 6 bağımsız fix görevi; Task 1'deki `getWeeklyRiskCount` kaldırma, Task 3'teki getRiskAlerts refactor'una zemin hazırlar. Diğer tasklar bağımsızdır. Her task kendi başına derlenip test edilebilir.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase SSR, Inngest 4, date-fns 4, ExcelJS (Task 6'da ekleniyor)

---

## Dosya Haritası

| Dosya | Task | Değişiklik |
|---|---|---|
| `src/domains/dashboard/services/TeacherDashboardService.ts` | 1, 3, 4 | insertRiskSnapshots kaldır, getRiskAlerts sadeleştir, computeAlerts refactor |
| `src/domains/dashboard/repositories/DashboardRepository.ts` | 1 | getWeeklyRiskCount sil |
| `app/(dashboard)/anasayfa/OgretmenDashboard.tsx` | 1 | "Yeni risk" → "Aktif risk" |
| `src/shared/date/index.ts` | 2 | `todayLocalISO()` export ekle |
| `app/(dashboard)/anasayfa/MYStatsWidget.tsx` | 2 | todayLocalISO kullan |
| `app/(dashboard)/yoklama/page.tsx` | 2 | todayLocalISO kullan |
| `app/(dashboard)/anasayfa/MYSolSutunWidget.tsx` | 2 | schoolYearStart → inceleme gerekli |
| `src/domains/dashboard/queries/schoolStats.ts` | 5 | getAbsentYearRows → DB aggregate |
| `app/(dashboard)/anasayfa/MYStatsWidget.tsx` | 5 | aggregate sonuçları kullan |
| `src/domains/export/services/XlsxBuilder.ts` | 6 | xlsx → ExcelJS |
| `package.json` | 6 | xlsx kaldır, exceljs ekle |
| `tests/vitest/unit/dashboard/service.test.ts` | 1, 3 | testleri güncelle |

---

## Task 1: Dashboard'dan DB Write'ı Kaldır

**Sorun:**
- `getDashboardMetrics` her çağrıda `insertRiskSnapshots` fire-and-forget yapıyor
- `getWeeklyRiskCount` bu write'ın tamamlanmasına race-condition ile bağımlı
- `getDashboardMetrics` içinde `getCurrentProfile()` çağrısı oluyor (çağıran page zaten çağırdı)
- `getRiskAlerts` da aynı snapshot insert'i tekrar yapıyor (await ile)

**Fix:** `weeklyRiskCount` = `activeRiskCount` (zaten bellekte var). DB write yoldan çıkar.

**Files:**
- Modify: `src/domains/dashboard/services/TeacherDashboardService.ts`
- Modify: `src/domains/dashboard/repositories/DashboardRepository.ts`
- Modify: `app/(dashboard)/anasayfa/OgretmenDashboard.tsx`
- Modify: `tests/vitest/unit/dashboard/service.test.ts`

- [ ] **Step 1: DashboardRepository'den `getWeeklyRiskCount` metodunu sil**

`src/domains/dashboard/repositories/DashboardRepository.ts` dosyasından şu bloğu tamamen kaldır:

```ts
// SİL — bu metodun tamamını kaldır
async getWeeklyRiskCount(teacherId: string, weekStart: string) {
  const supabase = await createClient()
  const { count } = await supabase
    .from('student_risk_history')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .neq('risk_level', 'low')
    .gte('snapshot_at', weekStart)
  return count ?? 0
},
```

- [ ] **Step 2: `getDashboardMetrics`'ten insertRiskSnapshots, getWeeklyRiskCount ve getCurrentProfile kaldır**

`src/domains/dashboard/services/TeacherDashboardService.ts` içinde `getDashboardMetrics` metodunu düzenle.

Dosyanın başında `getCurrentProfile` import'unu kaldır — artık kullanılmıyor (getRiskAlerts da düzenlenecek):

```ts
// ESKİ (silinecek satır):
import { getCurrentProfile } from '@/src/shared/auth'
```

`getDashboardMetrics` içindeki Promise.all'ı şu şekilde güncelle — `getWeeklyRiskCount` çağrısını kaldır:

```ts
// ESKİ Promise.all — 7 çağrı:
const [subsResult, attResult, studentsResult, weeklyResult, weeklyRiskCount, trendResult, todayAttResult] = await Promise.all([
  DashboardRepository.getSubmissions(hwIds),
  DashboardRepository.getAttendanceRows(classIds, teacherId, twoWeeksAgo),
  DashboardRepository.getStudentsByClasses(classIds),
  DashboardRepository.getWeeklySubmissionStats(hwIds, weekStart),
  DashboardRepository.getWeeklyRiskCount(teacherId, weekStart),
  DashboardRepository.getAttendanceTrend(classIds, eightWeeksAgo),
  DashboardRepository.getTodayClassAttendance(classIds, today),
])

// YENİ Promise.all — 6 çağrı:
const [subsResult, attResult, studentsResult, weeklyResult, trendResult, todayAttResult] = await Promise.all([
  DashboardRepository.getSubmissions(hwIds),
  DashboardRepository.getAttendanceRows(classIds, teacherId, twoWeeksAgo),
  DashboardRepository.getStudentsByClasses(classIds),
  DashboardRepository.getWeeklySubmissionStats(hwIds, weekStart),
  DashboardRepository.getAttendanceTrend(classIds, eightWeeksAgo),
  DashboardRepository.getTodayClassAttendance(classIds, today),
])
```

`getDashboardMetrics` içinden `getCurrentProfile()` çağrısını ve `insertRiskSnapshots` bloğunu tamamen kaldır:

```ts
// SİL — bu bloğun tamamını kaldır (satır 130-143 civarı):
const profile = await getCurrentProfile()
if (alerts.length > 0 && profile?.school_id) {
  void DashboardRepository.insertRiskSnapshots(
    alerts.map(a => ({
      student_id: a.studentId,
      school_id:  profile.school_id!,
      teacher_id: teacherId,
      risk_level: a.riskLevel,
      risk_score: computeRiskScore(a.hwMisses, a.absences),
      hw_misses:  a.hwMisses,
      absences:   a.absences,
    }))
  ).catch(() => {})
}
```

`weeklyRiskCount`'u şu şekilde değiştir (DB sorgusu değil, bellekteki alerts'ten türet):

```ts
// ESKİ:
const weeklyDoneCount = weeklySubmissions.filter(s => s.status === 'yapildi').length
const avgCompletionPct = weeklySubmissions.length > 0
  ? Math.round((weeklyDoneCount / weeklySubmissions.length) * 100)
  : 0

// YENİ — weekly bloğunu alerts hesaplandıktan sonraya taşı, activeRiskCount'u kullan:
// (Bu satır alerts hesaplandıktan sonra gelmeli, sırayı kontrol et)
const weeklyDoneCount = weeklySubmissions.filter(s => s.status === 'yapildi').length
const avgCompletionPct = weeklySubmissions.length > 0
  ? Math.round((weeklyDoneCount / weeklySubmissions.length) * 100)
  : 0

// weekly.newRiskCount = activeRiskCount (DB round-trip yok)
```

`return` bloğundaki `newRiskCount` alanını güncelle:

```ts
// ESKİ:
weekly: {
  submittedCount: weeklyDoneCount,
  avgCompletionPct,
  newRiskCount: weeklyRiskCount,
},

// YENİ:
weekly: {
  submittedCount: weeklyDoneCount,
  avgCompletionPct,
  newRiskCount: activeRiskCount,
},
```

- [ ] **Step 3: `getRiskAlerts`'tan insertRiskSnapshots ve getCurrentProfile kaldır**

`TeacherDashboardService.ts` içinde `getRiskAlerts` metodunu düzenle:

```ts
async getRiskAlerts(teacherId: string): Promise<RiskAlert[]> {
  const twoWeeksAgo = subDays(new Date(), 14).toISOString().split('T')[0]

  const { data: hwData } = await DashboardRepository.getTeacherHomeworks(teacherId)
  const homeworks = (hwData ?? []) as unknown as HwRow[]
  const hwIds = homeworks.map(h => h.id)
  const classIds = [...new Set(homeworks.map(h => h.class_id))]

  const [subsResult, attResult, studentsResult] = await Promise.all([
    DashboardRepository.getSubmissions(hwIds),
    DashboardRepository.getAttendanceRows(classIds, teacherId, twoWeeksAgo),
    DashboardRepository.getStudentsByClasses(classIds),
  ])

  const submissions    = (subsResult.data    ?? []) as SubmissionRow[]
  const attendanceRows = (attResult.data      ?? []) as { student_id: string; status: string }[]
  const students       = (studentsResult.data ?? []) as unknown as StudentRow[]

  return computeAlerts(homeworks, submissions, attendanceRows, students)
},
```

Not: `getCurrentProfile()`, `insertRiskSnapshots()` çağrıları ve `schoolId` değişkeni tamamen silindi.

- [ ] **Step 4: UI'daki "Yeni risk" etiketini güncelle**

`app/(dashboard)/anasayfa/OgretmenDashboard.tsx`:

```tsx
// ESKİ:
<p className="text-[10px] text-gray-400">Yeni risk</p>

// YENİ:
<p className="text-[10px] text-gray-400">Aktif risk</p>
```

- [ ] **Step 5: `DashboardMetrics` tipindeki `newRiskCount` alanını kontrol et**

`src/domains/dashboard/types.ts` dosyasını aç. `weekly` objesindeki `newRiskCount` alanı semantik olarak değişti (DB sayısı → anlık aktif risk). Tip değişmiyor, sadece yorumu değişti. Tip güncellemesi gerekmiyorsa atla.

- [ ] **Step 6: Testleri güncelle**

`tests/vitest/unit/dashboard/service.test.ts` içindeki `getRiskAlerts` testlerini bul (satır 96-128). `insertRiskSnapshots` mock beklentilerini kaldır. Test sadece dönen `RiskAlert[]` dizisini kontrol etmeli:

```ts
describe('getRiskAlerts', () => {
  it('ödev ve devamsızlık verilerinden risk listesi hesaplar', async () => {
    // DashboardRepository mock'ları: getTeacherHomeworks, getSubmissions,
    // getAttendanceRows, getStudentsByClasses — hepsi mevcut olmalı
    // insertRiskSnapshots mock'unu KALDIR (artık çağrılmıyor)
    const alerts = await TeacherDashboardService.getRiskAlerts(TEACHER_ID)
    expect(alerts).toHaveLength(/* beklenen sayı */)
    // insertRiskSnapshots'ın çağrılmadığını doğrula:
    expect(DashboardRepository.insertRiskSnapshots).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 7: Derle ve testleri çalıştır**

```bash
cd C:\Users\mehme\zumre-takip
npx tsc --noEmit
npx vitest run tests/vitest/unit/dashboard/
```

Beklenen: TS hatası yok, dashboard testleri geçiyor.

- [ ] **Step 8: Commit**

```bash
git add src/domains/dashboard/services/TeacherDashboardService.ts \
        src/domains/dashboard/repositories/DashboardRepository.ts \
        app/(dashboard)/anasayfa/OgretmenDashboard.tsx \
        tests/vitest/unit/dashboard/service.test.ts
git commit -m "perf: dashboard yükleme yolundan DB write kaldırıldı

- insertRiskSnapshots getDashboardMetrics ve getRiskAlerts'tan kaldırıldı
- getWeeklyRiskCount DB sorgusu yerine bellekteki activeRiskCount kullanılıyor
- getCurrentProfile double-call giderildi
- UI etiketi 'Yeni risk' → 'Aktif risk' olarak güncellendi"
```

---

## Task 2: Server-Side UTC Timezone Bug Düzeltme

**Sorun:** Vercel sunucusu UTC'de çalışıyor. `new Date().toISOString().split('T')[0]` UTC tarih döndürüyor. Türkiye (UTC+3) kullanıcısı saat 21:00'dan sonra "bugün" yerine "yarın" görebiliyor. `MYStatsWidget`, `yoklama/page.tsx` ve `TeacherDashboardService` etkileniyor. `YoklamaClient` (client-side) zaten doğru yapıyor — o dokunma.

**Files:**
- Modify: `src/shared/date/index.ts`
- Modify: `app/(dashboard)/anasayfa/MYStatsWidget.tsx`
- Modify: `app/(dashboard)/yoklama/page.tsx`
- Modify: `src/domains/dashboard/services/TeacherDashboardService.ts`

- [ ] **Step 1: `todayLocalISO` fonksiyonunu `src/shared/date/index.ts`'e ekle**

`src/shared/date/index.ts` dosyasının en altına ekle:

```ts
/** Türkiye (Europe/Istanbul) yerel tarihi YYYY-MM-DD döndürür.
 *  Sunucu UTC'de çalışsa bile doğru tarihi verir. */
export function todayLocalISO(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date())
  // sv-SE locale YYYY-MM-DD formatı üretir — parse gerektirmez
}
```

- [ ] **Step 2: MYStatsWidget'i düzelt**

`app/(dashboard)/anasayfa/MYStatsWidget.tsx` dosyasını aç. Import satırına `todayLocalISO` ekle:

```ts
// ESKİ:
import { subDays } from '@/src/shared/date'

// YENİ:
import { subDays, todayLocalISO } from '@/src/shared/date'
```

`todayStr` hesaplamasını değiştir:

```ts
// ESKİ:
const today       = new Date()
const todayStr    = today.toISOString().split('T')[0]

// YENİ:
const today       = new Date()
const todayStr    = todayLocalISO()
```

`twoWeeksAgo` hâlâ `subDays(today, 14).toISOString()` olarak kalabilir — bu sadece göreli bir eşik, timezone hassasiyeti yok.

- [ ] **Step 3: yoklama/page.tsx'i düzelt**

`app/(dashboard)/yoklama/page.tsx` dosyasını aç. `getEgitimYili` import'unun yanına `todayLocalISO` ekle:

```ts
// ESKİ:
import { getEgitimYili, schoolYearStart } from '@/src/shared/utils'

// YENİ:
import { getEgitimYili, schoolYearStart } from '@/src/shared/utils'
import { todayLocalISO } from '@/src/shared/date'
```

Dosyada `schoolYearStart()` çağrısı UTC sorunu taşımıyor (sabit okul başlangıcı). Ama absences sorgusu `getAttendanceTrend` ile alakasız — doğrudan date parsing yapıyor ve zaten hafta sonu kontrolü var. Kaldır, düzelt:

`page.tsx` içinde DATE_STR karşılaştırmaları yoksa (sadece `schoolYearStart()` kullanılıyor) bu dosyada ek değişiklik gerekmeyebilir. Dosyayı kontrol et — eğer `new Date().toISOString().split('T')[0]` kullanımı varsa `todayLocalISO()` ile değiştir.

- [ ] **Step 4: TeacherDashboardService'i düzelt**

`src/domains/dashboard/services/TeacherDashboardService.ts` dosyasını aç. Import ekle:

```ts
import { subDays, todayLocalISO } from '@/src/shared/date'
// (subDays zaten import'ta varsa sadece todayLocalISO'yu ekle)
```

`getDashboardMetrics` içindeki `today` değişkenini güncelle:

```ts
// ESKİ:
const today = new Date().toISOString().split('T')[0]

// YENİ:
const today = todayLocalISO()
```

Dosyadaki diğer tüm `.toISOString().split('T')[0]` kullanımlarını bul (`twoWeeksAgo`, `eightWeeksAgo`). Bunlar göreli eşikler — timezone hassasiyeti düşük. Değiştirmene gerek yok.

`getRiskAlerts` içindeki `toISOString().split('T')[0]` — göreli eşik, değiştirme.

- [ ] **Step 5: Derle**

```bash
cd C:\Users\mehme\zumre-takip
npx tsc --noEmit
```

Beklenen: TS hatası yok.

- [ ] **Step 6: Commit**

```bash
git add src/shared/date/index.ts \
        app/(dashboard)/anasayfa/MYStatsWidget.tsx \
        app/(dashboard)/yoklama/page.tsx \
        src/domains/dashboard/services/TeacherDashboardService.ts
git commit -m "fix: server-side 'bugün' tarihi UTC yerine Türkiye saati kullanıyor

todayLocalISO() (Europe/Istanbul) eklendi; MYStatsWidget, yoklama/page,
TeacherDashboardService güncellendi — saat 21:00+ sonrası yanlış tarih hatası giderildi"
```

---

## Task 3: `getRiskAlerts` Kod Tekrarını Gider

**Sorun:** `getRiskAlerts` `getDashboardMetrics` ile aynı 3 DB sorgusunu (`getTeacherHomeworks`, `getSubmissions`, `getAttendanceRows`, `getStudentsByClasses`) tekrar ediyor ve aynı `computeAlerts()` fonksiyonunu çağırıyor. Task 1'den sonra tek fark kalmadı — `getRiskAlerts` artık bağımsız bir değer üretmiyor.

**Kullanım tespiti:** `getRiskAlerts` sadece test dosyasında çağrılıyor (`app/` altında çağrı yok). Metot public API'de kalmalı ama içi ortak helper'a devredilmeli.

**Fix:** Private bir `fetchRiskInputs` helper extract et. Her iki metod bunu çağırsın.

**Files:**
- Modify: `src/domains/dashboard/services/TeacherDashboardService.ts`
- Modify: `tests/vitest/unit/dashboard/service.test.ts`

- [ ] **Step 1: `fetchRiskInputs` private helper'ı extract et**

`TeacherDashboardService.ts` dosyasında objenin dışına (export'un üstüne) private bir fonksiyon ekle:

```ts
async function fetchRiskInputs(teacherId: string) {
  const twoWeeksAgo = subDays(new Date(), 14).toISOString().split('T')[0]

  const { data: hwData } = await DashboardRepository.getTeacherHomeworks(teacherId)
  const homeworks = (hwData ?? []) as unknown as HwRow[]
  const hwIds = homeworks.map(h => h.id)
  const classIds = [...new Set(homeworks.map(h => h.class_id))]

  const [subsResult, attResult, studentsResult] = await Promise.all([
    DashboardRepository.getSubmissions(hwIds),
    DashboardRepository.getAttendanceRows(classIds, teacherId, twoWeeksAgo),
    DashboardRepository.getStudentsByClasses(classIds),
  ])

  return {
    homeworks,
    hwIds,
    classIds,
    submissions:    (subsResult.data    ?? []) as SubmissionRow[],
    attendanceRows: (attResult.data      ?? []) as { student_id: string; status: string }[],
    students:       (studentsResult.data ?? []) as unknown as StudentRow[],
  }
}
```

- [ ] **Step 2: `getDashboardMetrics` içindeki tekrarlanan kodu `fetchRiskInputs` ile değiştir**

`getDashboardMetrics` metodunun başında homeworks/hwIds/classIds elde etme bloğunu ve submissions/attResult/studentsResult'u `fetchRiskInputs` ile değiştir:

```ts
async getDashboardMetrics(teacherId: string): Promise<DashboardMetrics> {
  const today         = todayLocalISO()
  const twoWeeksAgo   = subDays(new Date(), 14).toISOString().split('T')[0]
  const eightWeeksAgo = subDays(new Date(), 56).toISOString().split('T')[0]
  const weekStart     = getWeekStart()

  // Risk verisini ve geri kalan 3 sorguyu paralel çalıştır
  const [riskInputs, weeklyResult, trendResult, todayAttResult] = await Promise.all([
    fetchRiskInputs(teacherId),
    // weeklyResult için hwIds lazım — önce fetchRiskInputs bitirmeli
    // NOT: hwIds fetchRiskInputs'tan geliyor, bu yüzden paralel yapamayız
    // Aşağıdaki yaklaşımı kullan:
  ])
  // ...
```

**Dikkat:** `weeklyResult`, `trendResult`, `todayAttResult` için `hwIds` ve `classIds` gerekiyor — bunlar `fetchRiskInputs` tamamlanmadan bilinmiyor. Bu yüzden iki aşamalı paralel yapı kullan:

```ts
async getDashboardMetrics(teacherId: string): Promise<DashboardMetrics> {
  const today         = todayLocalISO()
  const eightWeeksAgo = subDays(new Date(), 56).toISOString().split('T')[0]
  const weekStart     = getWeekStart()

  // Aşama 1: Risk verilerini (ve bağımlı hwIds/classIds) al
  const { homeworks, hwIds, classIds, submissions, attendanceRows, students } =
    await fetchRiskInputs(teacherId)

  // Aşama 2: hwIds/classIds gereken sorgular
  const [weeklyResult, trendResult, todayAttResult] = await Promise.all([
    DashboardRepository.getWeeklySubmissionStats(hwIds, weekStart),
    DashboardRepository.getAttendanceTrend(classIds, eightWeeksAgo),
    DashboardRepository.getTodayClassAttendance(classIds, today),
  ])

  const classesWithAttToday = new Set((todayAttResult.data ?? []).map(a => (a as { class_id: string }).class_id))
  const weeklySubmissions   = (weeklyResult.data ?? []) as SubmissionRow[]
  const trendRows           = (trendResult.data  ?? []) as { date: string; status: string }[]

  // Geri kalan hesaplamalar (değişmeden devam eder)...
```

- [ ] **Step 3: `getRiskAlerts` metodunu `fetchRiskInputs` ile yeniden yaz**

```ts
async getRiskAlerts(teacherId: string): Promise<RiskAlert[]> {
  const { homeworks, submissions, attendanceRows, students } =
    await fetchRiskInputs(teacherId)
  return computeAlerts(homeworks, submissions, attendanceRows, students)
},
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

```bash
npx tsc --noEmit && npx vitest run tests/vitest/unit/dashboard/
```

Beklenen: tüm testler geçiyor.

- [ ] **Step 5: Commit**

```bash
git add src/domains/dashboard/services/TeacherDashboardService.ts
git commit -m "refactor: getRiskAlerts ve getDashboardMetrics ortak fetchRiskInputs helper kullanıyor

Tekrarlanan 3 DB sorgusu ve computeAlerts çağrısı extract edildi"
```

---

## Task 4: `fakeHomeworks` Hack'ini Düzelt

**Sorun:** `getClassSummary` içinde `computeAlerts()` çağrısı yapabilmek için gerçek homework objesi olmayan boş string'lerle dolu sahte objeler yaratılıyor. Bu, `computeAlerts`'in gereksiz yere homework verisine bağlı olduğunu gösteriyor.

**Fix:** `getClassSummary` için `computeAlerts` yerine doğrudan işleyen `computeClassRisk` fonksiyonu yaz. `computeAlerts` fonksiyonunu değiştirme (diğer çağrılar bozulur).

**Files:**
- Modify: `src/domains/dashboard/services/TeacherDashboardService.ts`

- [ ] **Step 1: `computeClassRisk` fonksiyonunu ekle**

`TeacherDashboardService.ts` dosyasında `computeAlerts` fonksiyonunun hemen altına private helper ekle:

```ts
function computeClassRisk(
  submissions:    SubmissionRow[],
  attendanceRows: { student_id: string; status: string }[],
  students:       StudentRow[],
): RiskAlert[] {
  // Tüm submission'lar bu sınıfa ait — homework bazında son 5 filtresi yok
  const hwMissMap = new Map<string, number>()
  for (const sub of submissions) {
    if (sub.status === 'eksik' || sub.status === 'yapilmadi' || sub.status === 'gec') {
      hwMissMap.set(sub.student_id, (hwMissMap.get(sub.student_id) ?? 0) + 1)
    }
  }

  const absenceMap = new Map<string, number>()
  for (const att of attendanceRows) {
    if (att.status === 'absent') {
      absenceMap.set(att.student_id, (absenceMap.get(att.student_id) ?? 0) + 1)
    }
  }

  const alerts: RiskAlert[] = []
  for (const student of students) {
    const hwMisses = hwMissMap.get(student.id) ?? 0
    const absences = absenceMap.get(student.id) ?? 0
    if (hwMisses === 0 && absences === 0) continue

    const reasons: string[] = []
    if (hwMisses >= 1) reasons.push(`${hwMisses} eksik ödev`)
    if (absences >= 1) reasons.push(`Son 14 günde ${absences} gün devamsız`)

    alerts.push({
      studentId:   student.id,
      studentName: student.full_name,
      classId:     student.class_id,
      className:   student.classes?.name ?? '—',
      riskLevel:   computeRiskLevel(hwMisses, absences),
      reasons,
      hwMisses,
      absences,
    })
  }

  const order = { high: 0, medium: 1, low: 2 } as const
  return alerts.sort((a, b) => order[a.riskLevel] - order[b.riskLevel])
}
```

- [ ] **Step 2: `getClassSummary` içindeki fake homeworks bloğunu kaldır**

`getClassSummary` içinde şu bloğu:

```ts
// SİL:
const fakeHomeworks = [...new Set(submissions.map(s => s.homework_id))].map(id => ({
  id, title: '', subject: '', due_date: '', class_id: classId, classes: null,
}))
const alerts = computeAlerts(fakeHomeworks, submissions, attendanceRows, students)
```

Şununla değiştir:

```ts
const alerts = computeClassRisk(submissions, attendanceRows, students)
```

- [ ] **Step 3: Derle ve test et**

```bash
npx tsc --noEmit && npx vitest run tests/vitest/unit/dashboard/
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/dashboard/services/TeacherDashboardService.ts
git commit -m "refactor: getClassSummary fakeHomeworks hack kaldırıldı

computeClassRisk helper'ı eklendi — computeAlerts'e gereksiz homework bağımlılığı giderildi"
```

---

## Task 5: Ağır Sorguları Sınırla

**Sorun:**
- `getAbsentYearRows`: Eylül'den bugüne tüm `absent/late` satırlarını belleğe çekiyor. 500 öğrenci × 200 gün = potansiyel 100.000 satır.
- `getSessionRows`: Tüm `user_sessions` satırları, LIMIT yok.

**Fix:** `getAbsentYearRows` için DB'de hesap yap (Supabase `group by` değil — RPC kullan). `getSessionRows` için `DISTINCT ON` veya sadece son 30 gün.

**Files:**
- Modify: `src/domains/dashboard/queries/schoolStats.ts`
- Modify: `app/(dashboard)/anasayfa/MYStatsWidget.tsx`

- [ ] **Step 1: `getAbsentYearRows`'u DB aggregate ile değiştir**

`src/domains/dashboard/queries/schoolStats.ts` dosyasını düzenle. `getAbsentYearRows` metodu tüm satırları çekip JS'te sayıyor. Supabase RPC yoksa şu trick çalışır — sadece ihtiyaç duyulan iki sütun (student_id, status) zaten seçiliyor. Satır sayısını azaltmak için alternatif: öğrenci başına hafta sonu dışı toplam hesaplamayı DB'de yapmak RPC gerektirir. **Kısa vadeli fix:** LIMIT 10000 ekle ve büyük okullarda hata logla.

```ts
export const getAbsentYearRows = cache(async (schoolId: string, yearStart: string) => {
  const db = await createClient()
  const { data, error } = await db
    .from('attendance')
    .select('student_id, status')
    .eq('school_id', schoolId)
    .in('status', ['absent', 'late'])
    .gte('date', yearStart)
    .limit(15000)  // 500 öğrenci × 200 gün × 0.15 devamsızlık oranı ≈ 15.000
  if (error) console.error('[getAbsentYearRows]', error.message)
  return data ?? []
})
```

- [ ] **Step 2: `getSessionRows`'a DISTINCT ON ekle**

Supabase'de `DISTINCT ON` desteklenmez doğrudan. Alternatif: sadece son 30 günün oturumlarını çek (eski oturumlar zaten 2 haftalık aktiflik kontrolünü geçemez):

```ts
export const getSessionRows = cache(async (schoolId: string) => {
  const db = await createClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await db
    .from('user_sessions')
    .select('user_id, last_seen_at')
    .eq('school_id', schoolId)
    .gte('last_seen_at', since)
    .order('last_seen_at', { ascending: false })
    .limit(500)  // Okul başına 500+ aktif kullanıcı olmaz
  if (error) console.error('[getSessionRows]', error.message)
  return data ?? []
})
```

- [ ] **Step 3: Derle**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/domains/dashboard/queries/schoolStats.ts
git commit -m "perf: ağır dashboard sorguları sınırlandırıldı

getAbsentYearRows limit 15000, getSessionRows son 30 gün + limit 500"
```

---

## Task 6: `xlsx` Güvenlik Açığı — ExcelJS ile Değiştir

**Sorun:** `xlsx@0.18.5` (SheetJS community edition) prototype pollution ve ReDoS CVE'lerine sahip. Kullanıcı tarafından yüklenen Excel verisi işlenirse saldırı vektörü oluşur.

**Fix:** `xlsx` paketini kaldır, `exceljs` ile değiştir. EduDesk'te Excel sadece export için kullanılıyor (import yok) — `XlsxBuilder.ts` dosyasını yeniden yaz.

**Files:**
- Modify: `package.json` (komutla)
- Modify: `src/domains/export/services/XlsxBuilder.ts`

- [ ] **Step 1: Mevcut XlsxBuilder'ı oku ve API'yi belgele**

`src/domains/export/services/XlsxBuilder.ts` dosyasını oku. `fetchRows`, `buildXlsx`, `uploadToStorage` fonksiyonlarının dışa aktarılan imzalarını not et — bunlar `exportXlsxFn` tarafından çağrılıyor ve değişmemeli.

- [ ] **Step 2: Paketleri güncelle**

```bash
cd C:\Users\mehme\zumre-takip
npm uninstall xlsx
npm install exceljs
```

- [ ] **Step 3: `XlsxBuilder.ts`'i ExcelJS ile yeniden yaz**

`XlsxBuilder.ts` içindeki `buildXlsx` fonksiyonunu ExcelJS ile değiştir. Dışa aktarılan fonksiyon imzası aynı kalmalı: `buildXlsx(rows: Row[], jobType: JobType): Buffer`.

```ts
import ExcelJS from 'exceljs'

export async function buildXlsx(rows: Record<string, unknown>[], jobType: JobType): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName(jobType))

  if (rows.length === 0) {
    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }

  // Başlık satırı
  const headers = Object.keys(rows[0])
  sheet.addRow(headers)
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: 'FFD9EAD3' },
  }

  // Veri satırları
  for (const row of rows) {
    sheet.addRow(headers.map(h => row[h]))
  }

  // Kolon genişlikleri
  sheet.columns.forEach(col => { col.width = 20 })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
```

**Dikkat:** ExcelJS `buildXlsx` async! Çağıran `exportXlsxFn` içindeki `buildXlsx(rows, jobType)` satırı `await buildXlsx(rows, jobType)` olarak güncellenmeli.

- [ ] **Step 4: `exportXlsxFn`'deki çağrıyı await'e çevir**

`src/domains/export/functions/exportXlsx.ts` dosyasında:

```ts
// ESKİ:
const buffer = buildXlsx(rows, jobType)

// YENİ:
const buffer = await buildXlsx(rows, jobType)
```

- [ ] **Step 5: Derle ve test et**

```bash
npx tsc --noEmit
```

Eğer export için test varsa: `npx vitest run tests/vitest/unit/export/`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json \
        src/domains/export/services/XlsxBuilder.ts \
        src/domains/export/functions/exportXlsx.ts
git commit -m "security: xlsx CVE'li paket ExcelJS ile değiştirildi

xlsx@0.18.5 prototype pollution + ReDoS CVE'leri vardı.
ExcelJS ile yeniden yazıldı, buildXlsx async oldu."
```

---

## Self-Review

| Sorun (Eleştiride) | Task |
|---|---|
| Dashboard her yüklenişte DB'ye yazıyor | ✅ Task 1 |
| weeklyRiskCount race condition | ✅ Task 1 |
| getCurrentProfile double call | ✅ Task 1 |
| getRiskAlerts kod tekrarı | ✅ Task 3 |
| fakeHomeworks hack | ✅ Task 4 |
| UTC timezone bug | ✅ Task 2 |
| getAbsentYearRows/getSessionRows limitsiz | ✅ Task 5 |
| xlsx CVE | ✅ Task 6 |
| `as unknown as X[]` type casting | ❌ Kapsam dışı — Supabase tip üretimi ayrı ve büyük bir refactor; bu plan ile bağımsız |
| Mimari tutarsızlık (bazı widget'lar direkt Supabase çağırıyor) | ❌ Kapsam dışı — UX'i etkilemiyor, ayrı refactor gerektirir |

**Bağımlılık sırası:** Task 1 → Task 3 (Task 1 snapshot kaldırınca Task 3'teki helper içi basitleşir). Task 2, 4, 5, 6 bağımsız — Task 1 bitmeden başlanabilir.
