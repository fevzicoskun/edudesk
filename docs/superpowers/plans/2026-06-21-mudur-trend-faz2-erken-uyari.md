# MY Erken Uyarı (Faz 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Müdür yardımcısı anasayfasına, okul-geneli trendler dönem ortalamasına göre bozulduğunda uyaran "Erken Uyarılar" kartı eklemek.

**Architecture:** Faz 1'in zaten hesapladığı haftalık trend dizilerini (`computeAbsenceTrend/ActivityTrend/CoverageTrend/ClassAbsence`) tüketen saf bir `computeEarlyWarnings` fonksiyonu. Server widget mevcut `schoolTrends` sorgularını yeniden kullanır. Yeni sorgu/migration YOK.

**Tech Stack:** Next.js App Router (React 19 server component), TypeScript, Vitest, `@/src/shared/date` (date-fns sarmalayıcı).

## Global Constraints

- `rate` alanları **kesir** (0–1), yüzde değil. Eşikler "puan" = kesir farkı: +3 puan = `0.03`.
- Hafta = Pazartesi başlı; trend dizileri `weekStart` ('yyyy-MM-dd') artan sırada gelir (Faz 1 `weekKeysBetween` çıktısı).
- "Real (oturumda) hafta" göstergesi: o haftanın `absence` noktasında `total > 0` (yoklama girilmiş). Tatil haftaları bu sayede tüm metriklerden elenir.
- Pencere `donemBasi()` (Faz 1 ile aynı). Tüm metrik dizileri aynı hafta kümesine sahip.
- Dosya başında adlandırılmış sabitler; kör sayı yok.
- Test komutu: `npm run test:unit -- <dosya>`.
- Commit mesajları Türkçe, sonuna `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

- Create: `src/domains/dashboard/lib/earlyWarning.ts` — saf hesap (tipler, sabitler, `selectTrendWindow`, `computeEarlyWarnings`).
- Create: `tests/vitest/unit/dashboard/early-warning.test.ts` — saf testler.
- Create: `app/(dashboard)/anasayfa/ErkenUyarilarWidget.tsx` — server widget (veri çek → trend hesapla → uyarı → kart).
- Modify: `app/(dashboard)/anasayfa/page.tsx` — `MYWidgets` içine widget'ı ekle.

Tüketilen mevcut tipler (`src/domains/dashboard/lib/trendMath.ts`):
- `AbsenceTrendPoint = { weekStart, label, rate, absent, total }`
- `ActivityTrendPoint = { weekStart, label, rate, active, total }`
- `CoverageTrendPoint = { weekStart, label, rate, recorded, expected }`
- `ClassAbsence = { classId, name, grade, rate, absent, total }`

---

### Task 1: Pencere seçimi + tipler/sabitler

**Files:**
- Create: `src/domains/dashboard/lib/earlyWarning.ts`
- Test: `tests/vitest/unit/dashboard/early-warning.test.ts`

**Interfaces:**
- Consumes: `startOfWeek`, `format` from `@/src/shared/date`.
- Produces:
  - `type EarlyWarning = { id: string; severity: 'dikkat'|'yuksek'; metric: 'devamsizlik'|'kapsama'|'aktivite'|'sinif'; title: string; detail: string; classId?: string }`
  - `selectTrendWindow(points: {weekStart:string;rate:number}[], realWeeks: Set<string>, now: Date): { last: number; baselineMean: number; baselineCount: number } | null`

- [ ] **Step 1: Write the failing test**

`tests/vitest/unit/dashboard/early-warning.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { selectTrendWindow } from '@/src/domains/dashboard/lib/earlyWarning'

const real = new Set(['2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25'])
const NOW = new Date('2026-06-01T12:00:00') // hafta başı 2026-06-01 → 05-25 tam hafta

const pts = (vals: [string, number][]) => vals.map(([weekStart, rate]) => ({ weekStart, rate }))

describe('selectTrendWindow', () => {
  it('son tam haftayı ve baz ortalamasını döndürür', () => {
    const w = selectTrendWindow(
      pts([['2026-05-04', 0.1], ['2026-05-11', 0.1], ['2026-05-18', 0.1], ['2026-05-25', 0.2]]),
      real, NOW,
    )
    expect(w).not.toBeNull()
    expect(w!.last).toBe(0.2)
    expect(w!.baselineMean).toBeCloseTo(0.1)
    expect(w!.baselineCount).toBe(3)
  })

  it('içinde bulunulan (yarım) haftayı son/baz olarak kullanmaz', () => {
    const withCurrent = pts([
      ['2026-05-04', 0.1], ['2026-05-11', 0.1], ['2026-05-18', 0.1],
      ['2026-05-25', 0.2], ['2026-06-01', 0.9], // 06-01 = bu hafta, atlanmalı
    ])
    const realPlus = new Set([...real, '2026-06-01'])
    const w = selectTrendWindow(withCurrent, realPlus, NOW)
    expect(w!.last).toBe(0.2) // 0.9 değil
  })

  it('tatil (real olmayan) haftaları eler', () => {
    const w = selectTrendWindow(
      pts([['2026-05-04', 0.1], ['2026-05-11', 0.0], ['2026-05-18', 0.1], ['2026-05-25', 0.2]]),
      new Set(['2026-05-04', '2026-05-18', '2026-05-25']), // 05-11 tatil
      NOW,
    )
    expect(w!.baselineCount).toBe(2) // 05-04, 05-18
  })

  it('<2 baz hafta → null (veri birikiyor)', () => {
    const w = selectTrendWindow(
      pts([['2026-05-18', 0.1], ['2026-05-25', 0.2]]),
      new Set(['2026-05-18', '2026-05-25']),
      NOW,
    )
    expect(w).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/vitest/unit/dashboard/early-warning.test.ts`
Expected: FAIL — `selectTrendWindow is not a function` / module yok.

- [ ] **Step 3: Write minimal implementation**

`src/domains/dashboard/lib/earlyWarning.ts`:
```ts
import { startOfWeek, format } from '@/src/shared/date'

export type EarlyWarning = {
  id: string
  severity: 'dikkat' | 'yuksek'
  metric: 'devamsizlik' | 'kapsama' | 'aktivite' | 'sinif'
  title: string
  detail: string
  classId?: string
}

const MIN_BASELINE_WEEKS = 2

function currentWeekStart(now: Date): string {
  return format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

// Son tam (oturumda) hafta + ondan önceki baz haftaların ortalaması.
// Yetersiz baz (<2) ya da son tam hafta yoksa null.
export function selectTrendWindow(
  points: { weekStart: string; rate: number }[],
  realWeeks: Set<string>,
  now: Date,
): { last: number; baselineMean: number; baselineCount: number } | null {
  const cw = currentWeekStart(now)
  const usable = points.filter(p => realWeeks.has(p.weekStart) && p.weekStart < cw)
  if (usable.length < MIN_BASELINE_WEEKS + 1) return null
  const last = usable[usable.length - 1]
  const baseline = usable.slice(0, -1)
  const baselineMean = baseline.reduce((s, p) => s + p.rate, 0) / baseline.length
  return { last: last.rate, baselineMean, baselineCount: baseline.length }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/vitest/unit/dashboard/early-warning.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
git add src/domains/dashboard/lib/earlyWarning.ts tests/vitest/unit/dashboard/early-warning.test.ts
git commit -m "feat: erken uyarı pencere seçimi (son tam hafta vs baz ort.)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Zaman-sapması kuralları (devamsızlık / kapsama / aktivite) + şiddet

**Files:**
- Modify: `src/domains/dashboard/lib/earlyWarning.ts`
- Test: `tests/vitest/unit/dashboard/early-warning.test.ts`

**Interfaces:**
- Consumes: `selectTrendWindow` (Task 1); `AbsenceTrendPoint`, `ActivityTrendPoint`, `CoverageTrendPoint`, `ClassAbsence` from `./trendMath`.
- Produces: `computeEarlyWarnings(absence, activity, coverage, classAbsence, now?): EarlyWarning[]` (bu task'ta sınıf kuralı henüz boş; Task 3 ekler).

- [ ] **Step 1: Write the failing test**

`early-warning.test.ts` dosyasının sonuna ekle:
```ts
import { computeEarlyWarnings } from '@/src/domains/dashboard/lib/earlyWarning'
import type { AbsenceTrendPoint, ActivityTrendPoint, CoverageTrendPoint } from '@/src/domains/dashboard/lib/trendMath'

const WS = ['2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25']
const NOW2 = new Date('2026-06-01T12:00:00')

function abs(rates: number[]): AbsenceTrendPoint[] {
  return WS.map((weekStart, i) => ({ weekStart, label: weekStart, rate: rates[i], absent: 1, total: 10 }))
}
function act(rates: number[]): ActivityTrendPoint[] {
  return WS.map((weekStart, i) => ({ weekStart, label: weekStart, rate: rates[i], active: 1, total: 4 }))
}
function cov(rates: number[]): CoverageTrendPoint[] {
  return WS.map((weekStart, i) => ({ weekStart, label: weekStart, rate: rates[i], recorded: 1, expected: 10 }))
}

const flatAct = act([1, 1, 1, 1])
const flatCov = cov([0.9, 0.9, 0.9, 0.9])
const flatAbs = abs([0.05, 0.05, 0.05, 0.05])

describe('computeEarlyWarnings — zaman sapması', () => {
  it('devamsızlık baz+3 puanı aşınca uyarır', () => {
    const ws = computeEarlyWarnings(abs([0.05, 0.05, 0.05, 0.09]), flatAct, flatCov, [], NOW2)
    const a = ws.find(w => w.metric === 'devamsizlik')
    expect(a).toBeDefined()
    expect(a!.severity).toBe('dikkat')
  })

  it('devamsızlık küçük artışta (+1 puan) uyarmaz', () => {
    const ws = computeEarlyWarnings(abs([0.05, 0.05, 0.05, 0.06]), flatAct, flatCov, [], NOW2)
    expect(ws.find(w => w.metric === 'devamsizlik')).toBeUndefined()
  })

  it('devamsızlık baz+6 puan (2× eşik) → yuksek', () => {
    const ws = computeEarlyWarnings(abs([0.05, 0.05, 0.05, 0.12]), flatAct, flatCov, [], NOW2)
    expect(ws.find(w => w.metric === 'devamsizlik')!.severity).toBe('yuksek')
  })

  it('kapsama baz−10 puan düşünce uyarır', () => {
    const ws = computeEarlyWarnings(flatAbs, flatAct, cov([0.9, 0.9, 0.9, 0.78]), [], NOW2)
    expect(ws.find(w => w.metric === 'kapsama')).toBeDefined()
  })

  it('aktivite baz−15 puan düşünce uyarır', () => {
    const ws = computeEarlyWarnings(flatAbs, act([1, 1, 1, 0.8]), flatCov, [], NOW2)
    expect(ws.find(w => w.metric === 'aktivite')).toBeDefined()
  })

  it('her şey stabilse boş döner', () => {
    expect(computeEarlyWarnings(flatAbs, flatAct, flatCov, [], NOW2)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/vitest/unit/dashboard/early-warning.test.ts`
Expected: FAIL — `computeEarlyWarnings is not a function`.

- [ ] **Step 3: Write minimal implementation**

`earlyWarning.ts`'e ekle (import satırını dosya başına, fonksiyonu sona):
```ts
import type {
  AbsenceTrendPoint, ActivityTrendPoint, CoverageTrendPoint, ClassAbsence,
} from './trendMath'

const ABSENCE_RISE  = 0.03 // +3 puan
const COVERAGE_DROP = 0.10 // -10 puan
const ACTIVITY_DROP = 0.15 // -15 puan
const SEVERITY_X    = 2     // eşiğin bu katı → 'yuksek'

const pct = (x: number) => Math.round(x * 100)

function severityFor(delta: number, threshold: number): 'dikkat' | 'yuksek' {
  return Math.abs(delta) >= threshold * SEVERITY_X ? 'yuksek' : 'dikkat'
}

export function computeEarlyWarnings(
  absence: AbsenceTrendPoint[],
  activity: ActivityTrendPoint[],
  coverage: CoverageTrendPoint[],
  classAbsence: ClassAbsence[],
  now: Date = new Date(),
): EarlyWarning[] {
  const out: EarlyWarning[] = []
  const realWeeks = new Set(absence.filter(p => p.total > 0).map(p => p.weekStart))

  // 1) Devamsızlık artışı (yüksek = kötü)
  const a = selectTrendWindow(absence, realWeeks, now)
  if (a && a.last >= a.baselineMean + ABSENCE_RISE) {
    const d = a.last - a.baselineMean
    out.push({
      id: 'absence-rise', metric: 'devamsizlik', severity: severityFor(d, ABSENCE_RISE),
      title: 'Devamsızlık yükseliyor',
      detail: `Son hafta %${pct(a.last)} · dönem ort. %${pct(a.baselineMean)} (+${pct(d)} puan)`,
    })
  }

  // 2) Kapsama düşüşü (düşük = kötü)
  const c = selectTrendWindow(coverage, realWeeks, now)
  if (c && c.last <= c.baselineMean - COVERAGE_DROP) {
    const d = c.baselineMean - c.last
    out.push({
      id: 'coverage-drop', metric: 'kapsama', severity: severityFor(d, COVERAGE_DROP),
      title: 'Yoklama kapsama düşüyor',
      detail: `Son hafta %${pct(c.last)} · dönem ort. %${pct(c.baselineMean)} (−${pct(d)} puan)`,
    })
  }

  // 3) Öğretmen aktivite düşüşü (düşük = kötü)
  const t = selectTrendWindow(activity, realWeeks, now)
  if (t && t.last <= t.baselineMean - ACTIVITY_DROP) {
    const d = t.baselineMean - t.last
    out.push({
      id: 'activity-drop', metric: 'aktivite', severity: severityFor(d, ACTIVITY_DROP),
      title: 'Öğretmen aktivitesi düşüyor',
      detail: `Son hafta %${pct(t.last)} · dönem ort. %${pct(t.baselineMean)} (−${pct(d)} puan)`,
    })
  }

  const order = { yuksek: 0, dikkat: 1 } as const
  return out.sort((x, y) => order[x.severity] - order[y.severity])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/vitest/unit/dashboard/early-warning.test.ts`
Expected: PASS (önceki 4 + yeni 6 = 10 test).

- [ ] **Step 5: Commit**

```bash
git add src/domains/dashboard/lib/earlyWarning.ts tests/vitest/unit/dashboard/early-warning.test.ts
git commit -m "feat: erken uyarı zaman-sapması kuralları (devamsızlık/kapsama/aktivite)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Sınıf-bazlı bozulma kuralı

**Files:**
- Modify: `src/domains/dashboard/lib/earlyWarning.ts`
- Test: `tests/vitest/unit/dashboard/early-warning.test.ts`

**Interfaces:**
- Consumes: `ClassAbsence` (`{ classId, name, grade, rate, absent, total }`), `computeEarlyWarnings` (Task 2).
- Produces: `computeEarlyWarnings` artık `metric==='sinif'` uyarıları da üretir (`classId` dolu).

- [ ] **Step 1: Write the failing test**

`early-warning.test.ts` sonuna ekle:
```ts
import type { ClassAbsence } from '@/src/domains/dashboard/lib/trendMath'

const cls = (classId: string, rate: number, total = 100): ClassAbsence =>
  ({ classId, name: classId, grade: 9, rate, absent: Math.round(rate * total), total })

describe('computeEarlyWarnings — sınıf bozulması', () => {
  it('okul ort.×1.5 üstü ve ≥%10 sınıfı işaretler', () => {
    // okul oranı = toplam absent / toplam total = (10+10+30)/300 = ~%16.7; eşik ×1.5 = %25
    const classes = [cls('9-A', 0.10), cls('9-B', 0.10), cls('9-C', 0.30)]
    const ws = computeEarlyWarnings(flatAbs, flatAct, flatCov, classes, NOW2)
    const s = ws.filter(w => w.metric === 'sinif')
    expect(s.map(w => w.classId)).toContain('9-C')
    expect(s.map(w => w.classId)).not.toContain('9-A')
  })

  it('%10 mutlak tabanın altı küçük örneklemi işaretlemez', () => {
    // okul oranı çok düşük; bir sınıf 1.5× üstü ama mutlak %10 altında
    const classes = [cls('9-A', 0.02), cls('9-B', 0.02), cls('9-C', 0.06)]
    const ws = computeEarlyWarnings(flatAbs, flatAct, flatCov, classes, NOW2)
    expect(ws.filter(w => w.metric === 'sinif')).toHaveLength(0)
  })

  it('en kötü 3 sınıfla sınırlar', () => {
    const classes = [cls('A', 0.5), cls('B', 0.5), cls('C', 0.5), cls('D', 0.5), cls('E', 0.01)]
    const ws = computeEarlyWarnings(flatAbs, flatAct, flatCov, classes, NOW2)
    expect(ws.filter(w => w.metric === 'sinif').length).toBeLessThanOrEqual(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/vitest/unit/dashboard/early-warning.test.ts`
Expected: FAIL — sınıf uyarıları üretilmiyor (`9-C` bulunamaz).

- [ ] **Step 3: Write minimal implementation**

`earlyWarning.ts`: sabitleri ekle ve `computeEarlyWarnings` içinde `return out.sort(...)`'tan ÖNCE sınıf bloğunu ekle.

Sabitler (diğer sabitlerin yanına):
```ts
const CLASS_MULTIPLIER = 1.5
const CLASS_FLOOR      = 0.10 // %10
const CLASS_MAX        = 3
```

`return out.sort(...)`'tan önce:
```ts
  // 4) Sınıf-bazlı bozulma (sınıf vs okul ortalaması, anlık)
  const totAbsent = classAbsence.reduce((s, c) => s + c.absent, 0)
  const totRows   = classAbsence.reduce((s, c) => s + c.total, 0)
  const schoolRate = totRows > 0 ? totAbsent / totRows : 0
  if (schoolRate > 0) {
    classAbsence
      .filter(c => c.rate >= schoolRate * CLASS_MULTIPLIER && c.rate >= CLASS_FLOOR)
      .sort((x, y) => y.rate - x.rate)
      .slice(0, CLASS_MAX)
      .forEach(c => out.push({
        id: `class-${c.classId}`, metric: 'sinif', classId: c.classId,
        severity: c.rate >= schoolRate * CLASS_MULTIPLIER * SEVERITY_X ? 'yuksek' : 'dikkat',
        title: `${c.name} devamsızlığı yüksek`,
        detail: `Sınıf %${pct(c.rate)} · okul ort. %${pct(schoolRate)}`,
      }))
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/vitest/unit/dashboard/early-warning.test.ts`
Expected: PASS (10 + 3 = 13 test).

- [ ] **Step 5: Commit**

```bash
git add src/domains/dashboard/lib/earlyWarning.ts tests/vitest/unit/dashboard/early-warning.test.ts
git commit -m "feat: erken uyarı sınıf-bazlı bozulma kuralı

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: ErkenUyarilarWidget + MY anasayfaya bağla

**Files:**
- Create: `app/(dashboard)/anasayfa/ErkenUyarilarWidget.tsx`
- Modify: `app/(dashboard)/anasayfa/page.tsx`

**Interfaces:**
- Consumes: `computeEarlyWarnings` (Task 3); `getAttendanceTrendRows/getHomeworkTrendRows/getTrendClasses/getSchoolTeachers` (`src/domains/dashboard/queries/schoolTrends.ts` + `schoolStats.ts`); `computeAbsenceTrend/computeActivityTrend/computeCoverageTrend/computeClassAbsence` (`./lib/trendMath`); `donemBasi` (`@/src/shared/utils`); `Card*` (`@/components/ui/card`); `requireSchoolId` (`@/src/shared/auth`).
- Produces: default export server component `ErkenUyarilarWidget`.

> Not: `MudurTrendWidget.tsx`'i veri çekme/trend hesaplama deseni için referans al (aynı sorgular, aynı `donemBasi()` penceresi).

- [ ] **Step 1: Widget'ı yaz**

`app/(dashboard)/anasayfa/ErkenUyarilarWidget.tsx`:
```tsx
import Link from 'next/link'
import { requireSchoolId } from '@/src/shared/auth'
import { donemBasi } from '@/src/shared/utils'
import { getSchoolTeachers } from '@/src/domains/dashboard/queries/schoolStats'
import { getAttendanceTrendRows, getHomeworkTrendRows, getTrendClasses } from '@/src/domains/dashboard/queries/schoolTrends'
import {
  computeAbsenceTrend, computeActivityTrend, computeCoverageTrend, computeClassAbsence,
} from '@/src/domains/dashboard/lib/trendMath'
import { computeEarlyWarnings } from '@/src/domains/dashboard/lib/earlyWarning'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ErkenUyarilarWidget() {
  const school_id = await requireSchoolId()
  const donemStart = donemBasi()
  const now = new Date()

  const [attRows, hwRows, classes, teachers] = await Promise.all([
    getAttendanceTrendRows(school_id, donemStart),
    getHomeworkTrendRows(school_id, donemStart),
    getTrendClasses(school_id),
    getSchoolTeachers(school_id),
  ])

  const absence  = computeAbsenceTrend(attRows, donemStart, now)
  const activity = computeActivityTrend(attRows, hwRows, teachers.length, donemStart, now)
  const coverage = computeCoverageTrend(attRows, classes.length, donemStart, now)
  const classAbs = computeClassAbsence(attRows, classes)

  const warnings = computeEarlyWarnings(absence, activity, coverage, classAbs, now)

  // Yeterli baz hafta yoksa: zaman-sapması hesaplanamaz (sınıf kuralı anlık çalışır).
  // absence.total>0 olan tam hafta sayısı < 3 ise "veri birikiyor".
  const cw = absence.filter(p => p.total > 0)
  const yetersiz = cw.length < 3

  return (
    <Card className="border-gray-200 dark:border-slate-700 shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          Erken Uyarılar
        </CardTitle>
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Son tamamlanan hafta · dönem ortalamasına göre
        </p>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        {warnings.length === 0 ? (
          yetersiz ? (
            <p className="text-sm text-gray-400 dark:text-slate-500 py-2">
              Trend uyarıları için veri birikiyor.
            </p>
          ) : (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium py-2">
              Tüm trendler stabil ✓
            </p>
          )
        ) : (
          <ul className="space-y-2.5">
            {warnings.map(w => {
              const dot = w.severity === 'yuksek' ? 'bg-red-500' : 'bg-amber-400'
              const row = (
                <div className="flex items-start gap-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${dot}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{w.title}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{w.detail}</p>
                  </div>
                </div>
              )
              return (
                <li key={w.id}>
                  {w.classId
                    ? <Link href={`/siniflar/${w.classId}`} className="block hover:opacity-80">{row}</Link>
                    : row}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: MY anasayfaya bağla**

`app/(dashboard)/anasayfa/page.tsx`:

Import ekle (diğer widget importlarının yanına):
```tsx
import ErkenUyarilarWidget from './ErkenUyarilarWidget'
```

`MYWidgets` içinde, `MYStatsWidget` Suspense bloğunun HEMEN ALTINA ekle (var olan `WidgetSkeleton`/`WidgetErrorBoundary` desenini kullan; dosyadaki mevcut import adlarını koru):
```tsx
      <Suspense fallback={<WidgetSkeleton tall />}>
        <WidgetErrorBoundary label="Erken uyarılar">
          <ErkenUyarilarWidget />
        </WidgetErrorBoundary>
      </Suspense>
```
> Doğrulama: `page.tsx`'te `WidgetSkeleton` ve `WidgetErrorBoundary` zaten import/tanımlı (MY bölümü `MudurOgretmenAktivite`'yi bu desenle sarıyor). Değilse o satırdaki mevcut fallback/desenle eşle.

- [ ] **Step 3: Tip kontrolü + ilgili testler**

Run: `npx --no-install tsc --noEmit 2>&1 | grep -iE "ErkenUyarilar|earlyWarning|anasayfa/page" | grep -v "EduDesk-Architecture\|migration-cleanup"`
Expected: çıktı YOK (temiz).

Run: `npm run test:unit -- tests/vitest/unit/dashboard/early-warning.test.ts`
Expected: PASS (13 test).

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/anasayfa/ErkenUyarilarWidget.tsx" "app/(dashboard)/anasayfa/page.tsx"
git commit -m "feat: MY anasayfasına Erken Uyarılar kartı (Faz 2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- Tespit yöntemi (son tam hafta vs baz ort.) → Task 1 (`selectTrendWindow`). ✓
- Kural 1–3 + şiddet → Task 2. ✓
- Kural 4 (sınıf, ×1.5 + %10 taban + en kötü 3) → Task 3. ✓
- MIN 2 baz hafta / "veri birikiyor" → Task 1 (null) + Task 4 (yetersiz mesajı). ✓
- "Tüm trendler stabil" / şiddet sıralı kart → Task 4. ✓
- MY anasayfa yerleşimi, sınıf linki → Task 4. ✓
- Yeni sorgu/migration yok (mevcut `schoolTrends` yeniden kullanımı) → Task 4. ✓

**2. Placeholder scan:** Kod blokları tam, "TBD"/"benzer şekilde" yok. ✓

**3. Type consistency:** `rate` her yerde 0–1 kesir; eşikler kesir (0.03/0.10/0.15); `EarlyWarning` alanları Task 2-3-4 boyunca tutarlı (`id/severity/metric/title/detail/classId`); `selectTrendWindow` dönüş tipi (`last/baselineMean/baselineCount`) Task 2'de doğru kullanılıyor. ✓

> Not (bilinen tavan, Faz 1 ile aynı): akademik takvim olmadığından, oturumda olmasına rağmen yoklama alınmamış bir hafta kapsama/aktivitede düşük görünüp uyarı tetikleyebilir. `realWeeks = absence.total>0` filtresi tatil haftalarını eler ama "okul açıktı, kimse girmedi" haftası gerçek bir kötüleşme sayılır (kasıtlı).
