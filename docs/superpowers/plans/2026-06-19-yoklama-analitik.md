# Yoklama Analitik Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yoklama verisine ödev analitiğinin akranı olan bir analitik sayfası eklemek (`/yoklama/analitik`): KPI özet, sınıf karşılaştırma + trend, kronik devamsızlar sicili, sınıf yoklama kapsaması.

**Architecture:** Saf compute fonksiyonları (`attendance/lib/analitik.ts`, test edilebilir) + sunum bileşenleri; devamsızlık verisi TS'de işlenir; kapsama için SECURITY INVOKER RPC. Ödev analitiği (`/odevler/analitik`) desenini birebir aynalıyor.

**Tech Stack:** Next.js 16 App Router server components, React 19, Tailwind v4, Supabase SSR, Vitest, Supabase MCP (migration + tip üretimi).

## Global Constraints

- Roller: `ogretmen`, `zumre_baskani`, `mudur_yardimcisi`, `mudur`, `admin`.
- Erişim: `isTeachingRole(role) || isMudurOrAbove(role)` değilse `/yoklama`'ya redirect. Öğretmen yalnız kendi sınıfları (`teacher_classes`, `teacher_id = user.id`); `isManager` (`zumre_baskani || isMudurOrAbove`) tüm okul.
- **④ Kapsama bölümü yalnız `isMudurOrAbove`** (zümre başkanı görmez).
- Her sorgu `school_id` filtreli + `.is('deleted_at', null)` (öğrenci/sınıf).
- Eşikler: `ATTENDANCE_WARN_DAYS = 15`, `ATTENDANCE_LIMIT_DAYS = 20` (`@/src/shared/constants/attendance`).
- Özürsüz = absent×1 + late×0.5, hafta sonu hariç (`countAbsences` zaten böyle).
- Türkçe metin, tam diakritik. Dark mode her görsel öğede.
- Supabase project id: `agijvfrcudpzsofgfogu`.
- Test komutu: `npx vitest run --project unit <dosya>`.

---

### Task 1: `analitik.ts` saf compute lib + testler (TDD)

**Files:**
- Create: `src/domains/attendance/lib/analitik.ts`
- Test: `tests/vitest/unit/domains/attendance/analitik.test.ts`

**Interfaces:**
- Consumes: `countAbsences`, `isWeekendISO` from `../lib/attendanceMath`; `ATTENDANCE_WARN_DAYS`, `ATTENDANCE_LIMIT_DAYS` from `@/src/shared/constants/attendance`.
- Produces: tipler `AbsenceRowA`, `StudentA`, `ClassA`, `CoverageRpcRow`, `AttendanceKpi`, `ClassAbsenceStat`, `WeeklyAbsencePoint`, `ChronicAbsentee`, `CoverageStat`; fonksiyonlar `computeAttendanceKpi`, `computeClassAbsence`, `computeWeeklyAbsenceTrend`, `computeChronicAbsentees`, `computeCoverage`.

- [ ] **Step 1: Failing test yaz**

`tests/vitest/unit/domains/attendance/analitik.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  computeAttendanceKpi,
  computeClassAbsence,
  computeWeeklyAbsenceTrend,
  computeChronicAbsentees,
  computeCoverage,
  type AbsenceRowA,
  type StudentA,
  type ClassA,
} from '@/src/domains/attendance/lib/analitik'

const students: StudentA[] = [
  { id: 's1', class_id: 'c1', full_name: 'Ali Veli', student_number: '1' },
  { id: 's2', class_id: 'c1', full_name: 'Ayşe Can', student_number: '2' },
  { id: 's3', class_id: 'c2', full_name: 'Mert Su', student_number: '3' },
]
const classes: ClassA[] = [
  { id: 'c1', name: '9-A', grade: 9 },
  { id: 'c2', name: '10-B', grade: 10 },
]

// 'c3' öğrencisiz sınıf testleri için
const classesWithEmpty: ClassA[] = [...classes, { id: 'c3', name: '11-C', grade: 11 }]

function absences(studentId: string, status: string, n: number, startDay = 1): AbsenceRowA[] {
  // Ocak 2025 ardışık hafta içi günleri (hafta sonu atlanır)
  const out: AbsenceRowA[] = []
  let d = startDay
  while (out.length < n) {
    const dow = new Date(2025, 0, d).getDay()
    if (dow !== 0 && dow !== 6) out.push({ student_id: studentId, status, date: `2025-01-${String(d).padStart(2, '0')}` })
    d++
  }
  return out
}

describe('computeAttendanceKpi', () => {
  it('boş veri → hepsi 0, takenToday/totalClasses aynen yansır', () => {
    const k = computeAttendanceKpi([], students, 5, 8)
    expect(k).toEqual({ totalUnexcused: 0, overLimit: 0, inWarn: 0, takenToday: 5, totalClasses: 8 })
  })

  it('eşik sınırları: 14 uyarı değil, 15 uyarı, 19 uyarı, 20 sınır', () => {
    const rows = [
      ...absences('s1', 'absent', 14),
      ...absences('s2', 'absent', 15),
      ...absences('s3', 'absent', 20),
    ]
    const k = computeAttendanceKpi(rows, students, 0, 2)
    expect(k.inWarn).toBe(1)      // s2 (15)
    expect(k.overLimit).toBe(1)   // s3 (20); s1 (14) hiçbiri
    expect(k.totalUnexcused).toBe(14 + 15 + 20)
  })

  it('late 0.5 katkısı', () => {
    const rows = absences('s1', 'late', 4) // 4×0.5 = 2
    expect(computeAttendanceKpi(rows, students, 0, 2).totalUnexcused).toBe(2)
  })
})

describe('computeClassAbsence', () => {
  it('sınıf başına ortalama özürsüz, öğrencisiz sınıf düşer, azalan sıralı', () => {
    const rows = [
      ...absences('s1', 'absent', 4), // c1
      ...absences('s3', 'absent', 6), // c2
    ]
    const stats = computeClassAbsence(rows, students, classesWithEmpty)
    expect(stats.map(s => s.name)).toEqual(['10-B', '9-A']) // c2 ort 6, c1 ort 2 (4/2)
    expect(stats.find(s => s.name === '11-C')).toBeUndefined()
    expect(stats[1].avgUnexcused).toBe(2)
  })
})

describe('computeWeeklyAbsenceTrend', () => {
  it('8 nokta döner, oran 0–100, studentCount 0 → rate 0', () => {
    const pts = computeWeeklyAbsenceTrend([], 0, 8)
    expect(pts).toHaveLength(8)
    expect(pts.every(p => p.rate === 0)).toBe(true)
  })

  it('hafta içi devamsızlık orana yansır, hafta sonu sayılmaz', () => {
    // 2025-01-04 Cumartesi (sayılmaz) + 2025-01-06 Pazartesi (sayılır)
    const rows: AbsenceRowA[] = [
      { student_id: 's1', status: 'absent', date: '2025-01-04' },
      { student_id: 's1', status: 'absent', date: '2025-01-06' },
    ]
    const pts = computeWeeklyAbsenceTrend(rows, 10, 520) // geniş pencere → 2025-01-06 dahil
    const wk = pts.find(p => p.weekStart === '2025-01-06')
    expect(wk).toBeDefined()
    expect(wk!.rate).toBe(2) // 1 / (10×5) = %2
  })
})

describe('computeChronicAbsentees', () => {
  it('yalnız ≥ warnDays, level eşiği, azalan, className eşleşir', () => {
    const rows = [
      ...absences('s1', 'absent', 16), // warn
      ...absences('s2', 'absent', 22), // danger
      ...absences('s3', 'absent', 10), // listede yok
    ]
    const list = computeChronicAbsentees(rows, students, classes, 15)
    expect(list.map(c => c.studentId)).toEqual(['s2', 's1'])
    expect(list[0].level).toBe('danger')
    expect(list[1].level).toBe('warn')
    expect(list[1].className).toBe('9-A')
  })
})

describe('computeCoverage', () => {
  it('boş rpc → [], yüzde max(covered)e göre, artan, bilinmeyen class atlanır', () => {
    expect(computeCoverage([], classes)).toEqual([])
    const cov = computeCoverage(
      [
        { class_id: 'c1', covered_days: 10 },
        { class_id: 'c2', covered_days: 20 },
        { class_id: 'cX', covered_days: 5 },
      ],
      classes,
    )
    expect(cov.map(c => c.name)).toEqual(['9-A', '10-B']) // 50, 100; cX atlandı
    expect(cov[0].coveragePct).toBe(50)
    expect(cov[1].coveragePct).toBe(100)
  })
})
```

- [ ] **Step 2: Testi çalıştır, fail ettiğini doğrula**

Run: `npx vitest run --project unit tests/vitest/unit/domains/attendance/analitik.test.ts`
Expected: FAIL — "Cannot find module '.../analitik'".

- [ ] **Step 3: Implementasyonu yaz**

`src/domains/attendance/lib/analitik.ts`:

```ts
import { countAbsences, isWeekendISO } from './attendanceMath'
import type { AttendanceRow } from '../types'
import { ATTENDANCE_WARN_DAYS, ATTENDANCE_LIMIT_DAYS } from '@/src/shared/constants/attendance'

export interface AbsenceRowA { student_id: string; status: string; date: string }
export interface StudentA { id: string; class_id: string; full_name: string; student_number: string | null }
export interface ClassA { id: string; name: string; grade: number }
export interface CoverageRpcRow { class_id: string; covered_days: number }

export interface AttendanceKpi {
  totalUnexcused: number
  overLimit:      number
  inWarn:         number
  takenToday:     number
  totalClasses:   number
}

export function computeAttendanceKpi(
  rows: AbsenceRowA[], students: StudentA[], takenToday: number, totalClasses: number,
): AttendanceKpi {
  const counts = countAbsences(rows as AttendanceRow[])
  let totalUnexcused = 0, overLimit = 0, inWarn = 0
  for (const s of students) {
    const u = counts[s.id]?.unexcused ?? 0
    totalUnexcused += u
    if (u >= ATTENDANCE_LIMIT_DAYS) overLimit++
    else if (u >= ATTENDANCE_WARN_DAYS) inWarn++
  }
  return { totalUnexcused, overLimit, inWarn, takenToday, totalClasses }
}

export interface ClassAbsenceStat {
  classId: string; name: string; grade: number; studentCount: number; avgUnexcused: number
}

export function computeClassAbsence(
  rows: AbsenceRowA[], students: StudentA[], classes: ClassA[],
): ClassAbsenceStat[] {
  const counts = countAbsences(rows as AttendanceRow[])
  return classes
    .map(c => {
      const cls = students.filter(s => s.class_id === c.id)
      const total = cls.reduce((sum, s) => sum + (counts[s.id]?.unexcused ?? 0), 0)
      const studentCount = cls.length
      return {
        classId: c.id, name: c.name, grade: c.grade, studentCount,
        avgUnexcused: studentCount > 0 ? total / studentCount : 0,
      }
    })
    .filter(c => c.studentCount > 0)
    .sort((a, b) => b.avgUnexcused - a.avgUnexcused)
}

export interface WeeklyAbsencePoint { weekStart: string; rate: number }

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function mondayISO(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = (dt.getDay() + 6) % 7 // Pzt=0 .. Paz=6
  dt.setDate(dt.getDate() - dow)
  return fmtDate(dt)
}

export function computeWeeklyAbsenceTrend(
  rows: AbsenceRowA[], studentCount: number, weeks = 8,
): WeeklyAbsencePoint[] {
  const today = new Date()
  const todayDow = (today.getDay() + 6) % 7
  const thisMon = new Date(today)
  thisMon.setDate(today.getDate() - todayDow)

  const buckets: { weekStart: string; unexcused: number }[] = []
  const index = new Map<string, number>()
  for (let i = weeks - 1; i >= 0; i--) {
    const m = new Date(thisMon)
    m.setDate(thisMon.getDate() - i * 7)
    const ws = fmtDate(m)
    index.set(ws, buckets.length)
    buckets.push({ weekStart: ws, unexcused: 0 })
  }

  for (const r of rows) {
    if (isWeekendISO(r.date)) continue
    if (r.status !== 'absent' && r.status !== 'late') continue // yalnız özürsüz
    const idx = index.get(mondayISO(r.date))
    if (idx === undefined) continue
    buckets[idx].unexcused += r.status === 'absent' ? 1 : 0.5
  }

  // ponytail: haftalık payda = studentCount × 5 okul günü (tatiller yok sayılır);
  // trend yönü için yeterli, gerçek okul-günü gerekirse pencere başına hesaplanır.
  const denomPerWeek = studentCount * 5
  return buckets.map(b => ({
    weekStart: b.weekStart,
    rate: denomPerWeek > 0 ? Math.round((b.unexcused / denomPerWeek) * 100) : 0,
  }))
}

export interface ChronicAbsentee {
  studentId: string; name: string; classId: string; className: string; unexcused: number; level: 'warn' | 'danger'
}

export function computeChronicAbsentees(
  rows: AbsenceRowA[], students: StudentA[], classes: ClassA[], warnDays: number,
): ChronicAbsentee[] {
  const counts = countAbsences(rows as AttendanceRow[])
  const classMap = new Map(classes.map(c => [c.id, c.name]))
  const out: ChronicAbsentee[] = []
  for (const s of students) {
    const u = counts[s.id]?.unexcused ?? 0
    if (u < warnDays) continue
    out.push({
      studentId: s.id, name: s.full_name, classId: s.class_id,
      className: classMap.get(s.class_id) ?? '—',
      unexcused: u, level: u >= ATTENDANCE_LIMIT_DAYS ? 'danger' : 'warn',
    })
  }
  return out.sort((a, b) => b.unexcused - a.unexcused)
}

export interface CoverageStat { classId: string; name: string; coveragePct: number }

export function computeCoverage(rpcRows: CoverageRpcRow[], classes: ClassA[]): CoverageStat[] {
  if (rpcRows.length === 0) return []
  const schoolDays = Math.max(...rpcRows.map(r => r.covered_days))
  if (schoolDays === 0) return []
  const nameMap = new Map(classes.map(c => [c.id, c.name]))
  const out: CoverageStat[] = []
  for (const r of rpcRows) {
    const name = nameMap.get(r.class_id)
    if (!name) continue // bilinmeyen class atla
    out.push({ classId: r.class_id, name, coveragePct: Math.round((r.covered_days / schoolDays) * 100) })
  }
  return out.sort((a, b) => a.coveragePct - b.coveragePct)
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npx vitest run --project unit tests/vitest/unit/domains/attendance/analitik.test.ts`
Expected: PASS (tüm describe blokları).

- [ ] **Step 5: Commit**

```bash
git add src/domains/attendance/lib/analitik.ts tests/vitest/unit/domains/attendance/analitik.test.ts
git commit -m "feat(attendance): yoklama analitik saf compute lib + testler"
```

---

### Task 2: Kapsama RPC migration + tip yenileme

**Files:**
- Create: `supabase/migrations/<timestamp>_get_class_attendance_coverage.sql`
- Modify: `src/infrastructure/supabase/database.types.ts` (MCP ile yeniden üretilir)

**Interfaces:**
- Consumes: yok
- Produces: Postgres fonksiyonu `get_class_attendance_coverage(p_school_id uuid, p_since date) returns table(class_id uuid, covered_days bigint)`; `database.types.ts` içinde bu fonksiyonun tipi.

- [ ] **Step 1: Migration dosyasını oluştur**

`supabase/migrations/<timestamp>_get_class_attendance_coverage.sql` (timestamp = mevcut migration adlandırma desenine uygun, ör. `20260619HHMMSS`):

```sql
-- Sınıf yoklama kapsaması: son p_since tarihinden bu yana sınıf başına
-- yoklama girilen ayrı gün sayısı. SECURITY INVOKER → attendance RLS okul
-- izolasyonunu zorlar (DEFINER değil; güvenlik turuyla uyumlu).
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

- [ ] **Step 2: Migration'ı uygula (Supabase MCP)**

Supabase MCP `apply_migration` aracını kullan:
- `project_id`: `agijvfrcudpzsofgfogu`
- `name`: `get_class_attendance_coverage`
- `query`: yukarıdaki SQL'in tamamı

Expected: hatasız uygulanır.

- [ ] **Step 3: TypeScript tiplerini yeniden üret**

Supabase MCP `generate_typescript_types` aracını `project_id: agijvfrcudpzsofgfogu` ile çağır. Çıktıyı `src/infrastructure/supabase/database.types.ts`'e yaz. Diff'in yalnızca yeni fonksiyonu (`get_class_attendance_coverage`) içerdiğini doğrula; alakasız büyük drift varsa raporla.

- [ ] **Step 4: Tip kontrolü**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add "supabase/migrations" src/infrastructure/supabase/database.types.ts
git commit -m "feat(attendance): get_class_attendance_coverage RPC + tipler"
```

---

### Task 3: Analitik sayfası + bölüm bileşenleri + link

**Files:**
- Create: `app/(dashboard)/yoklama/analitik/page.tsx`
- Create: `app/(dashboard)/yoklama/analitik/loading.tsx`
- Create: `app/(dashboard)/yoklama/analitik/KpiOzet.tsx`
- Create: `app/(dashboard)/yoklama/analitik/SinifTrend.tsx`
- Create: `app/(dashboard)/yoklama/analitik/KronikSicil.tsx`
- Create: `app/(dashboard)/yoklama/analitik/SinifKapsama.tsx`
- Modify: `app/(dashboard)/yoklama/page.tsx` (başlığa "Analitik →" linki)

**Interfaces:**
- Consumes: Task 1 lib (`computeAttendanceKpi`, `computeClassAbsence`, `computeWeeklyAbsenceTrend`, `computeChronicAbsentees`, `computeCoverage` ve tipleri); Task 2 RPC (`get_class_attendance_coverage`).
- Produces: `/yoklama/analitik` rotası.

- [ ] **Step 1: KpiOzet bileşeni**

`app/(dashboard)/yoklama/analitik/KpiOzet.tsx`:

```tsx
import type { AttendanceKpi } from '@/src/domains/attendance/lib/analitik'

function Card({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className={`border rounded-xl p-4 ${tone}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-1 opacity-90">{label}</p>
    </div>
  )
}

export default function KpiOzet({ kpi }: { kpi: AttendanceKpi }) {
  const totalStr = kpi.totalUnexcused % 1 === 0 ? String(kpi.totalUnexcused) : kpi.totalUnexcused.toFixed(1)
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <Card value={`${totalStr} gün`} label="Toplam özürsüz devamsızlık" tone="bg-gray-50 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" />
      <Card value={String(kpi.overLimit)} label={`Sınırı aşan (≥20 gün)`} tone="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800" />
      <Card value={String(kpi.inWarn)} label={`Uyarı bölgesi (15–20)`} tone="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800" />
      <Card value={`${kpi.takenToday}/${kpi.totalClasses}`} label="Bugün yoklama alınan sınıf" tone="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800" />
    </div>
  )
}
```

- [ ] **Step 2: SinifTrend bileşeni**

`app/(dashboard)/yoklama/analitik/SinifTrend.tsx`:

```tsx
import type { ClassAbsenceStat, WeeklyAbsencePoint } from '@/src/domains/attendance/lib/analitik'

export default function SinifTrend({ classStats, trend }: { classStats: ClassAbsenceStat[]; trend: WeeklyAbsencePoint[] }) {
  const maxAvg = Math.max(1, ...classStats.map(c => c.avgUnexcused))
  const maxRate = Math.max(1, ...trend.map(t => t.rate))
  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Sınıf Karşılaştırma</h2>
      {classStats.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500">Veri yok.</p>
      ) : (
        <ul className="space-y-2 mb-5">
          {classStats.map(c => (
            <li key={c.classId} className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300 w-16 shrink-0">{c.name}</span>
              <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-rose-400" style={{ width: `${Math.round((c.avgUnexcused / maxAvg) * 100)}%` }} />
              </div>
              <span className="text-xs text-gray-500 dark:text-slate-400 w-28 text-right shrink-0">ort. {c.avgUnexcused.toFixed(1)} gün/öğrenci</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Haftalık Devamsızlık Trendi (son 8 hafta)</h2>
      <div className="flex items-end gap-1.5 h-24">
        {trend.map(t => (
          <div key={t.weekStart} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${t.weekStart}: %${t.rate}`}>
            <div className="w-full rounded-t bg-blue-400 dark:bg-blue-500" style={{ height: `${Math.max(4, Math.round((t.rate / maxRate) * 100))}%` }} />
            <span className="text-[10px] text-gray-400 dark:text-slate-500">%{t.rate}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: KronikSicil bileşeni**

`app/(dashboard)/yoklama/analitik/KronikSicil.tsx`:

```tsx
import Link from 'next/link'
import type { ChronicAbsentee } from '@/src/domains/attendance/lib/analitik'

export default function KronikSicil({ items }: { items: ChronicAbsentee[] }) {
  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Kronik Devamsızlar (özürsüz ≥ 15 gün)</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500">Uyarı eşiğini aşan öğrenci yok. 👍</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-slate-700">
          {items.map(s => (
            <li key={s.studentId}>
              <Link
                href={`/siniflar/${s.classId}/ogrenciler/${s.studentId}`}
                className="flex items-center gap-3 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700/50 -mx-2 px-2 rounded-lg transition-colors"
              >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.level === 'danger' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                <span className="text-sm font-medium text-gray-900 dark:text-slate-100 flex-1 truncate">{s.name}</span>
                <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">{s.className}</span>
                <span className={`text-xs font-bold w-16 text-right shrink-0 ${s.level === 'danger' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {s.unexcused % 1 === 0 ? s.unexcused : s.unexcused.toFixed(1)} gün
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 4: SinifKapsama bileşeni**

`app/(dashboard)/yoklama/analitik/SinifKapsama.tsx`:

```tsx
import type { CoverageStat } from '@/src/domains/attendance/lib/analitik'

export default function SinifKapsama({ items }: { items: CoverageStat[] }) {
  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Sınıf Yoklama Kapsaması (son 30 gün)</h2>
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">Okul günlerinin yüzde kaçında yoklama girildi.</p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500">Veri yok.</p>
      ) : (
        <ul className="space-y-2">
          {items.map(c => {
            const tone = c.coveragePct < 60 ? 'bg-rose-500' : c.coveragePct < 85 ? 'bg-amber-400' : 'bg-emerald-400'
            return (
              <li key={c.classId} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300 w-16 shrink-0">{c.name}</span>
                <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${tone}`} style={{ width: `${c.coveragePct}%` }} />
                </div>
                <span className="text-xs font-bold text-gray-600 dark:text-slate-300 w-12 text-right shrink-0">%{c.coveragePct}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 5: loading skeleton**

`app/(dashboard)/yoklama/analitik/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto animate-pulse">
      <div className="h-8 w-48 bg-gray-200 dark:bg-slate-700 rounded-lg mb-6" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 dark:bg-slate-800 rounded-xl" />)}
      </div>
      <div className="h-48 bg-gray-100 dark:bg-slate-800 rounded-xl mb-4" />
      <div className="h-48 bg-gray-100 dark:bg-slate-800 rounded-xl" />
    </div>
  )
}
```

- [ ] **Step 6: page.tsx**

`app/(dashboard)/yoklama/analitik/page.tsx`:

```tsx
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile, getCurrentUser } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isMudurOrAbove, isTeachingRole } from '@/src/shared/types'
import { schoolYearStart } from '@/src/shared/utils'
import { ATTENDANCE_WARN_DAYS } from '@/src/shared/constants/attendance'
import {
  computeAttendanceKpi,
  computeClassAbsence,
  computeWeeklyAbsenceTrend,
  computeChronicAbsentees,
  computeCoverage,
  type AbsenceRowA,
  type StudentA,
  type ClassA,
  type CoverageRpcRow,
} from '@/src/domains/attendance/lib/analitik'
import KpiOzet from './KpiOzet'
import SinifTrend from './SinifTrend'
import KronikSicil from './KronikSicil'
import SinifKapsama from './SinifKapsama'

export const revalidate = 30

const NO_MATCH = '00000000-0000-0000-0000-000000000000'
const istanbulISO = (d: Date) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(d)

export default async function YoklamaAnalitikPage() {
  const [profile, user] = await Promise.all([getCurrentProfile(), getCurrentUser()])
  if (!profile?.school_id || !user) redirect('/login')

  if (!(isTeachingRole(profile.role) || isMudurOrAbove(profile.role))) redirect('/yoklama')

  const sid = profile.school_id
  const isManager = profile.role === 'zumre_baskani' || isMudurOrAbove(profile.role)
  const canSeeCoverage = isMudurOrAbove(profile.role)
  const supabase = await createClient()

  // Öğretmen → yalnız kendi sınıfları
  let myClassIds: string[] | null = null
  if (!isManager) {
    const { data: tc } = await supabase.from('teacher_classes').select('class_id').eq('teacher_id', user.id)
    myClassIds = [...new Set((tc ?? []).map(r => r.class_id))]
  }

  // classes
  let classQuery = supabase
    .from('classes')
    .select('id, name, grade')
    .eq('school_id', sid)
    .is('deleted_at', null)
    .order('grade')
    .order('name')
  if (myClassIds) classQuery = classQuery.in('id', myClassIds.length ? myClassIds : [NO_MATCH])
  const { data: classData } = await classQuery
  const classes = (classData ?? []) as ClassA[]
  const classIds = classes.map(c => c.id)

  const yearStart = schoolYearStart()
  const todayISO = istanbulISO(new Date())

  // students + absence rows + bugün alınan (present filtresiz distinct class_id)
  const [studentRes, absRes, todayRes] = classIds.length
    ? await Promise.all([
        supabase.from('students').select('id, class_id, full_name, student_number').in('class_id', classIds).eq('school_id', sid).is('deleted_at', null),
        supabase.from('attendance').select('student_id, status, date').eq('school_id', sid).in('class_id', classIds).in('status', ['absent', 'late', 'excused']).gte('date', yearStart),
        supabase.from('attendance').select('class_id').eq('school_id', sid).in('class_id', classIds).eq('date', todayISO),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  const students = (studentRes.data ?? []) as StudentA[]
  const rows = (absRes.data ?? []) as AbsenceRowA[]
  const takenToday = new Set((todayRes.data ?? []).map(r => (r as { class_id: string }).class_id)).size

  const kpi = computeAttendanceKpi(rows, students, takenToday, classes.length)
  const classStats = computeClassAbsence(rows, students, classes)
  const trend = computeWeeklyAbsenceTrend(rows, students.length, 8)
  const chronic = computeChronicAbsentees(rows, students, classes, ATTENDANCE_WARN_DAYS)

  let coverage: CoverageRpcRow[] = []
  if (canSeeCoverage) {
    const since = istanbulISO(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    const { data: covData } = await supabase.rpc('get_class_attendance_coverage', { p_school_id: sid, p_since: since })
    coverage = (covData ?? []).map(r => ({ class_id: r.class_id, covered_days: Number(r.covered_days) }))
  }
  const coverageStats = computeCoverage(coverage, classes)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yoklama Analitiği</h1>
        <Link href="/yoklama" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors">
          ← Yoklama
        </Link>
      </div>
      <KpiOzet kpi={kpi} />
      <SinifTrend classStats={classStats} trend={trend} />
      <KronikSicil items={chronic} />
      {canSeeCoverage && <SinifKapsama items={coverageStats} />}
    </div>
  )
}
```

- [ ] **Step 7: /yoklama sayfasına "Analitik →" linki**

`app/(dashboard)/yoklama/page.tsx` — sayfa başlığını içeren `<div className="mb-5">` bloğunu bul (içinde `<h1>...Yoklama...` veya benzeri başlık). Başlığı bir flex satırına alıp sağına link ekle. Dosyayı okuyup mevcut başlık bloğunu şu desenle değiştir (başlık metnini koru):

```tsx
      <div className="mb-5 flex items-center justify-between">
        <div>
          {/* mevcut <h1> ve varsa alt açıklama buraya, AYNEN korunur */}
        </div>
        <Link href="/yoklama/analitik" className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline shrink-0">
          Analitik →
        </Link>
      </div>
```

`import Link from 'next/link'` zaten varsa tekrar ekleme; yoksa ekle. Mevcut `<h1>`/açıklama JSX'ini birebir koru, yalnız sarmalayıcıyı flex yap ve linki ekle.

- [ ] **Step 8: Tip kontrolü + tüm testler + build**

Run: `npx tsc --noEmit && npx vitest run --project unit && npm run build`
Expected: tsc exit 0; tüm testler PASS; build exit 0. Yalnız kendi düzenlerinden kaynaklanan hataları düzelt.

- [ ] **Step 9: Commit**

```bash
git add "app/(dashboard)/yoklama/analitik" "app/(dashboard)/yoklama/page.tsx"
git commit -m "feat(yoklama): yoklama analitik sayfası (KPI, sınıf/trend, kronik, kapsama)"
```

---

## Self-Review Notları

- **Spec kapsamı:** ① KPI (Task 3 Step 1 + Task 1 `computeAttendanceKpi`) ✓; ② sınıf+trend (Step 2 + `computeClassAbsence`/`computeWeeklyAbsenceTrend`) ✓; ③ kronik (Step 3 + `computeChronicAbsentees`) ✓; ④ kapsama (Step 4 + RPC Task 2 + `computeCoverage`, `canSeeCoverage=isMudurOrAbove` ile gate) ✓; erişim/RBAC ✓; "bugün alınan" present-filtresiz sorgu ✓; link ✓; testler ✓.
- **Tip tutarlılığı:** lib export tipleri (Task 1) sayfada (Task 3) aynen tüketiliyor; `CoverageRpcRow.covered_days: number` ↔ sayfada `Number(r.covered_days)`; RPC adı `get_class_attendance_coverage` Task 2 ve Task 3'te aynı.
- **Placeholder taraması:** `<timestamp>` migration adında kasıtlı (uygulama anındaki tarih); `database.types.ts` MCP üretimi (Task 2 Step 3). Diğer tüm adımlar tam kod içeriyor.
