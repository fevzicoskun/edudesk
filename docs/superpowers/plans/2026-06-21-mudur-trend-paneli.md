# Müdür Trend Paneli Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Müdür anasayfasına okul-geneli zaman-trend paneli ekle (devamsızlık trendi, öğretmen aktivite trendi, sınıf karşılaştırması); operasyonel öğretmen-detay listesini MY anasayfasına taşı.

**Architecture:** Saf hesap mantığı (`trendMath.ts`, DB'siz, unit test edilir) + ham veri çeken `react.cache`'li query'ler (`schoolTrends.ts`, mevcut `schoolStats.ts` pattern'i) + server component widget + `'use client'` recharts grafiği. RPC/migration yok — bir okul-yıl ≈ 8K attendance satırı, JS bucketing yeterli.

**Tech Stack:** Next.js App Router (React 19 server components), Supabase SSR, recharts ^3.8.1 (kurulu), date-fns (`startOfWeek`/`addDays` `src/shared/date`'ten), Vitest.

## Global Constraints

- Her DB sorgusu `.eq('school_id', school_id)` ile filtrelenir — asla atlanmaz.
- Soft-delete: `classes`/`homeworks` sorgularında `.is('deleted_at', null)`. (`attendance`'ta `deleted_at` yok.)
- Hafta başlangıcı **Pazartesi**: `startOfWeek(date, { weekStartsOn: 1 })`.
- Tarihler TR yerel: ISO `YYYY-MM-DD` string'lerle çalış, `parseISO` ile Date'e çevir.
- "Tam devamsızlık" = yalnızca `status === 'absent'`. `late`/`excused`/`present` devamsızlık sayılmaz ama paydada (toplam kayıt) kalır.
- `AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'`.
- Öğretmen kümesi: `getSchoolTeachers` (roller `ogretmen`, `zumre_baskani`).

---

### Task 1: Saf trend hesap mantığı (`trendMath.ts`)

**Files:**
- Create: `src/domains/dashboard/lib/trendMath.ts`
- Test: `tests/vitest/unit/domains/dashboard/trendMath.test.ts`

**Interfaces:**
- Consumes: `startOfWeek`, `addDays`, `parseISO`, `format` from `@/src/shared/date`.
- Produces:
  - `type AbsenceTrendPoint = { weekStart: string; label: string; rate: number; absent: number; total: number }`
  - `type ActivityTrendPoint = { weekStart: string; label: string; rate: number; active: number; total: number }`
  - `type ClassAbsence = { classId: string; name: string; grade: number; rate: number; absent: number; total: number }`
  - `weekKeysBetween(startISO: string, end: Date): string[]` — Pzt-başı ISO hafta anahtarları (dahil).
  - `computeAbsenceTrend(rows: { date: string; status: string }[], startISO: string, end: Date): AbsenceTrendPoint[]`
  - `computeActivityTrend(att: { date: string; teacher_id: string | null }[], hw: { assigned_date: string; teacher_id: string | null }[], totalTeachers: number, startISO: string, end: Date): ActivityTrendPoint[]`
  - `computeClassAbsence(rows: { class_id: string; status: string }[], classes: { id: string; name: string; grade: number }[]): ClassAbsence[]`
  - `filledWeekCount(points: { total: number }[]): number` — `total > 0` olan hafta sayısı.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/vitest/unit/domains/dashboard/trendMath.test.ts
import { describe, it, expect } from 'vitest'
import {
  weekKeysBetween, computeAbsenceTrend, computeActivityTrend,
  computeClassAbsence, filledWeekCount,
} from '@/src/domains/dashboard/lib/trendMath'

describe('weekKeysBetween', () => {
  it('returns Monday-anchored weeks inclusive of start and end', () => {
    // 2026-05-05 is a Tuesday -> week of Mon 2026-05-04
    const keys = weekKeysBetween('2026-05-05', new Date('2026-05-20T12:00:00'))
    expect(keys).toEqual(['2026-05-04', '2026-05-11', '2026-05-18'])
  })
})

describe('computeAbsenceTrend', () => {
  const rows = [
    { date: '2026-05-04', status: 'absent' },
    { date: '2026-05-05', status: 'present' },
    { date: '2026-05-06', status: 'late' },     // pay'a girmez
    { date: '2026-05-07', status: 'excused' },  // pay'a girmez
    { date: '2026-05-11', status: 'absent' },
    { date: '2026-05-12', status: 'absent' },
  ]
  const points = computeAbsenceTrend(rows, '2026-05-04', new Date('2026-05-12T12:00:00'))

  it('produces one point per calendar week', () => {
    expect(points.map(p => p.weekStart)).toEqual(['2026-05-04', '2026-05-11'])
  })
  it('counts only absent in numerator, all rows in denominator', () => {
    // hafta1: 1 absent / 4 toplam = 0.25 ; hafta2: 2 absent / 2 = 1.0
    expect(points[0]).toMatchObject({ absent: 1, total: 4, rate: 0.25 })
    expect(points[1]).toMatchObject({ absent: 2, total: 2, rate: 1 })
  })
  it('emits rate 0 for a week with no attendance rows (gap week)', () => {
    const gap = computeAbsenceTrend(
      [{ date: '2026-05-04', status: 'absent' }],
      '2026-05-04', new Date('2026-05-18T12:00:00'),
    )
    expect(gap.map(p => p.total)).toEqual([1, 0, 0])
    expect(gap[1].rate).toBe(0)
  })
})

describe('computeActivityTrend', () => {
  it('counts a teacher once per week across attendance and homework', () => {
    const att = [
      { date: '2026-05-04', teacher_id: 't1' },
      { date: '2026-05-05', teacher_id: 't1' }, // aynı öğretmen, bir kez sayılır
    ]
    const hw = [{ assigned_date: '2026-05-06', teacher_id: 't2' }]
    const pts = computeActivityTrend(att, hw, 4, '2026-05-04', new Date('2026-05-04T12:00:00'))
    // hafta1: t1+t2 aktif = 2 / 4 = 0.5
    expect(pts[0]).toMatchObject({ active: 2, total: 4, rate: 0.5 })
  })
  it('rate is 0 when there are no teachers', () => {
    const pts = computeActivityTrend([], [], 0, '2026-05-04', new Date('2026-05-04T12:00:00'))
    expect(pts[0].rate).toBe(0)
  })
})

describe('computeClassAbsence', () => {
  it('computes per-class absent rate sorted worst-first', () => {
    const rows = [
      { class_id: 'c1', status: 'absent' }, { class_id: 'c1', status: 'present' },
      { class_id: 'c2', status: 'absent' }, { class_id: 'c2', status: 'absent' },
    ]
    const classes = [
      { id: 'c1', name: '9-A', grade: 9 }, { id: 'c2', name: '10-B', grade: 10 },
    ]
    const out = computeClassAbsence(rows, classes)
    expect(out[0]).toMatchObject({ classId: 'c2', rate: 1 })
    expect(out[1]).toMatchObject({ classId: 'c1', rate: 0.5 })
  })
  it('omits classes with no attendance rows', () => {
    const out = computeClassAbsence([], [{ id: 'c1', name: '9-A', grade: 9 }])
    expect(out).toEqual([])
  })
})

describe('filledWeekCount', () => {
  it('counts weeks with at least one record', () => {
    expect(filledWeekCount([{ total: 3 }, { total: 0 }, { total: 1 }])).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/vitest/unit/domains/dashboard/trendMath.test.ts`
Expected: FAIL — `Cannot find module '.../trendMath'`

- [ ] **Step 3: Implement `trendMath.ts`**

```ts
// src/domains/dashboard/lib/trendMath.ts
import { startOfWeek, addDays, parseISO, format } from '@/src/shared/date'

export type AbsenceTrendPoint = { weekStart: string; label: string; rate: number; absent: number; total: number }
export type ActivityTrendPoint = { weekStart: string; label: string; rate: number; active: number; total: number }
export type ClassAbsence = { classId: string; name: string; grade: number; rate: number; absent: number; total: number }

function isoWeekStart(dateStr: string): string {
  return format(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

/** Pazartesi-başlı hafta anahtarları; start ve end'in haftaları dahil. */
export function weekKeysBetween(startISO: string, end: Date): string[] {
  let cur = startOfWeek(parseISO(startISO), { weekStartsOn: 1 })
  const last = startOfWeek(end, { weekStartsOn: 1 })
  const out: string[] = []
  while (cur <= last) {
    out.push(format(cur, 'yyyy-MM-dd'))
    cur = addDays(cur, 7)
  }
  return out
}

function weekLabel(weekStartISO: string): string {
  return format(parseISO(weekStartISO), 'd MMM')
}

export function computeAbsenceTrend(
  rows: { date: string; status: string }[], startISO: string, end: Date,
): AbsenceTrendPoint[] {
  const absent = new Map<string, number>()
  const total = new Map<string, number>()
  for (const r of rows) {
    const wk = isoWeekStart(r.date)
    total.set(wk, (total.get(wk) ?? 0) + 1)
    if (r.status === 'absent') absent.set(wk, (absent.get(wk) ?? 0) + 1)
  }
  return weekKeysBetween(startISO, end).map(wk => {
    const t = total.get(wk) ?? 0
    const a = absent.get(wk) ?? 0
    return { weekStart: wk, label: weekLabel(wk), absent: a, total: t, rate: t === 0 ? 0 : a / t }
  })
}

export function computeActivityTrend(
  att: { date: string; teacher_id: string | null }[],
  hw: { assigned_date: string; teacher_id: string | null }[],
  totalTeachers: number, startISO: string, end: Date,
): ActivityTrendPoint[] {
  const byWeek = new Map<string, Set<string>>()
  const add = (dateStr: string, tid: string | null) => {
    if (!tid) return
    const wk = isoWeekStart(dateStr)
    if (!byWeek.has(wk)) byWeek.set(wk, new Set())
    byWeek.get(wk)!.add(tid)
  }
  for (const r of att) add(r.date, r.teacher_id)
  for (const r of hw) add(r.assigned_date, r.teacher_id)
  return weekKeysBetween(startISO, end).map(wk => {
    const active = byWeek.get(wk)?.size ?? 0
    return {
      weekStart: wk, label: weekLabel(wk), active, total: totalTeachers,
      rate: totalTeachers === 0 ? 0 : active / totalTeachers,
    }
  })
}

export function computeClassAbsence(
  rows: { class_id: string; status: string }[],
  classes: { id: string; name: string; grade: number }[],
): ClassAbsence[] {
  const absent = new Map<string, number>()
  const total = new Map<string, number>()
  for (const r of rows) {
    total.set(r.class_id, (total.get(r.class_id) ?? 0) + 1)
    if (r.status === 'absent') absent.set(r.class_id, (absent.get(r.class_id) ?? 0) + 1)
  }
  return classes
    .filter(c => (total.get(c.id) ?? 0) > 0)
    .map(c => {
      const t = total.get(c.id)!
      const a = absent.get(c.id) ?? 0
      return { classId: c.id, name: c.name, grade: c.grade, absent: a, total: t, rate: a / t }
    })
    .sort((x, y) => y.rate - x.rate)
}

export function filledWeekCount(points: { total: number }[]): number {
  return points.filter(p => p.total > 0).length
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/vitest/unit/domains/dashboard/trendMath.test.ts`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/domains/dashboard/lib/trendMath.ts tests/vitest/unit/domains/dashboard/trendMath.test.ts
git commit -m "feat: müdür trend paneli saf hesap mantığı + testler"
```

---

### Task 2: Ham veri çeken query'ler (`schoolTrends.ts`)

**Files:**
- Create: `src/domains/dashboard/queries/schoolTrends.ts`

**Interfaces:**
- Consumes: `createClient` from `@/src/infrastructure/supabase/server`, `logger` from `@/src/infrastructure/observability/logger`, `cache` from `react`.
- Produces (all `react.cache`-wrapped, return `[] ` on error):
  - `getAttendanceTrendRows(schoolId: string, yearStart: string): Promise<{ date: string; status: string; class_id: string; teacher_id: string | null }[]>`
  - `getHomeworkTrendRows(schoolId: string, yearStart: string): Promise<{ assigned_date: string; teacher_id: string | null }[]>`
  - `getTrendClasses(schoolId: string): Promise<{ id: string; name: string; grade: number }[]>`

- [ ] **Step 1: Implement `schoolTrends.ts`** (no unit test — thin Supabase wrappers, mirror existing `schoolStats.ts` style)

```ts
// src/domains/dashboard/queries/schoolTrends.ts
import { cache } from 'react'
import { createClient } from '@/src/infrastructure/supabase/server'
import { logger } from '@/src/infrastructure/observability/logger'

export const getAttendanceTrendRows = cache(async (schoolId: string, yearStart: string) => {
  const db = await createClient()
  const { data, error } = await db
    .from('attendance')
    .select('date, status, class_id, teacher_id')
    .eq('school_id', schoolId)
    .gte('date', yearStart)
    .limit(15000)
  if (error) logger.error({ event: 'db_query_failed', query: 'getAttendanceTrendRows', school_id: schoolId, message: error.message }, 'Trend yoklama sorgusu başarısız')
  return data ?? []
})

export const getHomeworkTrendRows = cache(async (schoolId: string, yearStart: string) => {
  const db = await createClient()
  const { data, error } = await db
    .from('homeworks')
    .select('assigned_date, teacher_id')
    .eq('school_id', schoolId)
    .gte('assigned_date', yearStart)
    .is('deleted_at', null)
    .limit(15000)
  if (error) logger.error({ event: 'db_query_failed', query: 'getHomeworkTrendRows', school_id: schoolId, message: error.message }, 'Trend ödev sorgusu başarısız')
  return data ?? []
})

export const getTrendClasses = cache(async (schoolId: string) => {
  const db = await createClient()
  const { data, error } = await db
    .from('classes')
    .select('id, name, grade')
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .order('grade').order('name')
  if (error) logger.error({ event: 'db_query_failed', query: 'getTrendClasses', school_id: schoolId, message: error.message }, 'Trend sınıf sorgusu başarısız')
  return data ?? []
})
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors in `schoolTrends.ts`

- [ ] **Step 3: Commit**

```bash
git add src/domains/dashboard/queries/schoolTrends.ts
git commit -m "feat: müdür trend paneli veri sorguları"
```

---

### Task 3: Grafik client component (`TrendChart.tsx`)

**Files:**
- Create: `app/(dashboard)/anasayfa/charts/TrendChart.tsx`

**Interfaces:**
- Consumes: `recharts` (`LineChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`).
- Produces:
  - `type TrendChartPoint = { label: string; rate: number }`
  - `default function TrendChart(props: { data: TrendChartPoint[]; color: string; format: 'percent' }): JSX.Element`
  - Y eksenini `0–1` aralığında, etiketleri `%` olarak gösterir.

- [ ] **Step 1: Implement `TrendChart.tsx`**

```tsx
'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export type TrendChartPoint = { label: string; rate: number }

export default function TrendChart({ data, color }: { data: TrendChartPoint[]; color: string; format: 'percent' }) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            domain={[0, 1]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
            tickFormatter={(v: number) => `%${Math.round(v * 100)}`}
          />
          <Tooltip
            formatter={(v: number) => [`%${Math.round(v * 100)}`, 'Oran']}
            labelClassName="text-xs"
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Line type="monotone" dataKey="rate" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/anasayfa/charts/TrendChart.tsx"
git commit -m "feat: trend çizgi grafiği (recharts client component)"
```

---

### Task 4: Müdür trend widget'ı (`MudurTrendWidget.tsx`)

**Files:**
- Create: `app/(dashboard)/anasayfa/MudurTrendWidget.tsx`

**Interfaces:**
- Consumes: `requireSchoolId` from `@/src/shared/auth`; `schoolYearStart` from `@/src/shared/utils`; `getSchoolTeachers` from `@/src/domains/dashboard/queries/schoolStats`; `getAttendanceTrendRows`, `getHomeworkTrendRows`, `getTrendClasses` (Task 2); `computeAbsenceTrend`, `computeActivityTrend`, `computeClassAbsence`, `filledWeekCount` (Task 1); `TrendChart` (Task 3); `Link` from `next/link`.
- Produces: `default async function MudurTrendWidget(): Promise<JSX.Element>` — used by Task 5.

- [ ] **Step 1: Implement `MudurTrendWidget.tsx`**

```tsx
// app/(dashboard)/anasayfa/MudurTrendWidget.tsx
import Link from 'next/link'
import { requireSchoolId } from '@/src/shared/auth'
import { schoolYearStart } from '@/src/shared/utils'
import { getSchoolTeachers } from '@/src/domains/dashboard/queries/schoolStats'
import { getAttendanceTrendRows, getHomeworkTrendRows, getTrendClasses } from '@/src/domains/dashboard/queries/schoolTrends'
import { computeAbsenceTrend, computeActivityTrend, computeClassAbsence, filledWeekCount } from '@/src/domains/dashboard/lib/trendMath'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import TrendChart from './charts/TrendChart'

const MIN_WEEKS = 2

function BirikiyorCard({ title, weeks }: { title: string; weeks: number }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Trend için veri birikiyor — şu ana kadar {weeks} hafta. En az {MIN_WEEKS} hafta gerekiyor.
        </p>
      </CardContent>
    </Card>
  )
}

export default async function MudurTrendWidget() {
  const school_id = await requireSchoolId()
  const yearStart = schoolYearStart()
  const now = new Date()

  const [attRows, hwRows, classes, teachers] = await Promise.all([
    getAttendanceTrendRows(school_id, yearStart),
    getHomeworkTrendRows(school_id, yearStart),
    getTrendClasses(school_id),
    getSchoolTeachers(school_id),
  ])

  const absenceTrend = computeAbsenceTrend(attRows, yearStart, now)
  const activityTrend = computeActivityTrend(attRows, hwRows, teachers.length, yearStart, now)
  const classAbsence = computeClassAbsence(attRows, classes)
  const enoughAbsence = filledWeekCount(absenceTrend) >= MIN_WEEKS
  const enoughActivity = filledWeekCount(activityTrend) >= MIN_WEEKS

  const maxClassRate = classAbsence[0]?.rate ?? 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Devamsızlık trendi */}
      {enoughAbsence ? (
        <Card>
          <CardHeader><CardTitle className="text-sm">Devamsızlık oranı (haftalık)</CardTitle></CardHeader>
          <CardContent>
            <TrendChart data={absenceTrend} color="#ef4444" format="percent" />
          </CardContent>
        </Card>
      ) : (
        <BirikiyorCard title="Devamsızlık oranı (haftalık)" weeks={filledWeekCount(absenceTrend)} />
      )}

      {/* Öğretmen aktivite trendi */}
      {enoughActivity ? (
        <Card>
          <CardHeader><CardTitle className="text-sm">Öğretmen aktivite oranı (haftalık)</CardTitle></CardHeader>
          <CardContent>
            <TrendChart data={activityTrend} color="#10b981" format="percent" />
          </CardContent>
        </Card>
      ) : (
        <BirikiyorCard title="Öğretmen aktivite oranı (haftalık)" weeks={filledWeekCount(activityTrend)} />
      )}

      {/* Sınıf karşılaştırması */}
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-sm">Sınıf karşılaştırması — devamsızlık</CardTitle></CardHeader>
        <CardContent>
          {classAbsence.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400">Henüz yoklama girilmemiş.</p>
          ) : (
            <ul className="space-y-2">
              {classAbsence.map(c => (
                <li key={c.classId}>
                  <Link href={`/siniflar/${c.classId}`} className="flex items-center gap-3 group">
                    <span className="w-16 shrink-0 text-sm text-gray-700 dark:text-slate-300 group-hover:underline">{c.name}</span>
                    <span className="flex-1 h-3 rounded bg-gray-100 dark:bg-slate-800 overflow-hidden">
                      <span
                        className="block h-full bg-red-400"
                        style={{ width: `${maxClassRate === 0 ? 0 : Math.round((c.rate / maxClassRate) * 100)}%` }}
                      />
                    </span>
                    <span className="w-12 shrink-0 text-right text-sm tabular-nums text-gray-600 dark:text-slate-400">%{Math.round(c.rate * 100)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (If `@/components/ui/card` import path differs, copy the exact import used in `app/(dashboard)/anasayfa/MudurOgretmenAktivite.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/anasayfa/MudurTrendWidget.tsx"
git commit -m "feat: müdür trend widget'ı (3 metrik + empty-state)"
```

---

### Task 5: Anasayfaya bağla, öğretmen listesini MY'ye taşı (`page.tsx`)

**Files:**
- Modify: `app/(dashboard)/anasayfa/page.tsx`

**Interfaces:**
- Consumes: `MudurTrendWidget` (Task 4); existing `MudurOgretmenAktivite`, `WidgetErrorBoundary`, `MYStatsWidget`, `MYSolSutunWidget`.

- [ ] **Step 1: Add import**

In `app/(dashboard)/anasayfa/page.tsx`, after the existing widget imports (around line 13), add:

```tsx
import MudurTrendWidget from './MudurTrendWidget'
```

- [ ] **Step 2: Rewrite `MudurWidgets`** — trend in, detail list out

Replace the entire `MudurWidgets` function body's stat+grid section (current lines 56-69) so the two-column grid containing `MYSolSutunWidget` + `MudurOgretmenAktivite` becomes `MYSolSutunWidget` only, and add the trend widget below the stats. Final `MudurWidgets` return:

```tsx
async function MudurWidgets({ fullName, classCount }: { fullName: string; classCount: number }) {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">
          {getGreeting(fullName)}
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {format(new Date(), 'd MMMM yyyy, EEEE')}
        </p>
      </div>

      {firstRunState('mudur', classCount) === 'setup' && <KurulumWidget />}

      <Suspense fallback={<><WidgetSkeleton /><WidgetSkeleton /></>}>
        <MYStatsWidget />
      </Suspense>

      <Suspense fallback={<WidgetSkeleton tall />}>
        <MYSolSutunWidget />
      </Suspense>

      <Suspense fallback={<><WidgetSkeleton tall /><WidgetSkeleton tall /></>}>
        <WidgetErrorBoundary label="Okul trendleri">
          <MudurTrendWidget />
        </WidgetErrorBoundary>
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 3: Rewrite `MYWidgets`** — add detail list here

Replace `MYWidgets` so the operational teacher-activity detail list lives on the MY home:

```tsx
async function MYWidgets({ fullName, classCount }: { fullName: string; classCount: number }) {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{getGreeting(fullName)}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {format(new Date(), 'd MMMM yyyy, EEEE')}
        </p>
      </div>

      {firstRunState('mudur_yardimcisi', classCount) === 'setup' && <KurulumWidget />}

      <Suspense fallback={<><WidgetSkeleton /><WidgetSkeleton /></>}>
        <MYStatsWidget />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Suspense fallback={<WidgetSkeleton tall />}>
          <MYSolSutunWidget />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton tall />}>
          <WidgetErrorBoundary label="Öğretmen aktivitesi">
            <MudurOgretmenAktivite />
          </WidgetErrorBoundary>
        </Suspense>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean typecheck; build succeeds. (`MudurOgretmenAktivite` import at top of file is now used by `MYWidgets` — no unused-import error.)

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, log in as a `mudur` user → `/anasayfa` shows the trend panel (or "veri birikiyor" cards) and no longer shows the per-teacher detail list. Log in as `mudur_yardimcisi` → detail list now appears on their home.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/anasayfa/page.tsx"
git commit -m "feat: müdür anasayfasına trend paneli; öğretmen detay listesi MY'ye taşındı"
```

---

## Self-Review Notları

- **Spec kapsamı:** 3 metrik (Task 1+4), empty-state `<2 hafta` (Task 4 `MIN_WEEKS`), detay listesi MY'ye taşıma (Task 5), saf-fonksiyon testleri (Task 1) — hepsi karşılandı.
- **RPC sapması:** Spec `school_weekly_metrics` RPC öngörüyordu; plan ham satır + JS bucketing kullanıyor (veri hacmi küçük, migration'sız, test edilebilir). Spec'e not eklenecek.
- **Devamsızlık tanımı:** yalnız `absent` pay'da; `late`/`excused`/`present` paydada — Task 1 testleriyle sabitlendi.
- **Tip tutarlılığı:** `AbsenceTrendPoint`/`ActivityTrendPoint` `rate`/`total` alanları `TrendChart` (`rate`) ve `filledWeekCount` (`total`) ile uyumlu.
