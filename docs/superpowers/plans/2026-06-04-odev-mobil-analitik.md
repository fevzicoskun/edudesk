# Ödev Mobil UX + Analitik Sayfası — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** StatusBoard'da mobil dokunma hedeflerini WCAG 44px standardına çıkar ve `/odevler/analitik` sayfasıyla öğretmenlere dönemlik KPI özeti, sınıf tamamlanma bar grafiği ve riskli öğrenci listesi ekle.

**Architecture:** Tüm hesaplama mantığı `src/domains/homework/lib/analitik.ts` pure-function kütüphanesine taşınır (TDD ile test edilir). `app/(dashboard)/odevler/analitik/page.tsx` server component olarak Supabase'den parallel sorgu ile veri çeker; üç alt bileşene prop olarak geçirir. StatusBoard'da yalnızca CSS grid düzeni değişir, server action / state mantığına dokunulmaz.

**Tech Stack:** Next.js App Router server components, Supabase SSR, Tailwind CSS (CSS-only bar chart), date-fns `startOfWeek` (zaten `@/src/shared/date`'de mevcut), Vitest (unit + integration).

---

## Dosya Haritası

**Oluşturulacak:**
- `src/domains/homework/lib/analitik.ts` — 4 pure hesaplama fonksiyonu + tipler
- `tests/vitest/unit/homework/analitik.test.ts` — unit testler
- `app/(dashboard)/odevler/analitik/page.tsx` — server component, veri çekme
- `app/(dashboard)/odevler/analitik/AnalitikOzet.tsx` — 4 KPI kartı (server)
- `app/(dashboard)/odevler/analitik/SinifDetay.tsx` — sınıf barları + trend (server)
- `app/(dashboard)/odevler/analitik/OgrenciSicil.tsx` — riskli öğrenci listesi (client)
- `tests/vitest/integration/server-actions/analitik-data.test.ts` — RBAC + edge case

**Değiştirilecek:**
- `app/(dashboard)/odevler/[id]/StatusBoard.tsx` — chip butonlar 3+2 grid, min-h-[44px]
- `app/(dashboard)/odevler/page.tsx` — analitik navigasyon ikonu

---

### Task 1: Analytics lib için başarısız unit testler yaz

**Files:**
- Create: `tests/vitest/unit/homework/analitik.test.ts`

- [ ] **Adım 1: Test dosyasını oluştur**

```ts
import { describe, it, expect } from 'vitest'
import {
  computeClassStats,
  computeRiskyStudents,
  computeWeeklyTrend,
  computeKpiCards,
} from '@/src/domains/homework/lib/analitik'
import type { AnalitikHomework, AnalitikSubmission, AnalitikStudent } from '@/src/domains/homework/lib/analitik'

function hw(id: string, classId: string, dueDate: string | null = '2026-05-01', teacherId = 't1'): AnalitikHomework {
  return { id, class_id: classId, teacher_id: teacherId, due_date: dueDate, title: `Ödev ${id}` }
}
function sub(homeworkId: string, studentId: string, status: AnalitikSubmission['status']): AnalitikSubmission {
  return { homework_id: homeworkId, student_id: studentId, status }
}
function student(id: string, classId: string): AnalitikStudent {
  return { id, class_id: classId, full_name: `Öğrenci ${id}`, student_number: id }
}

// --- computeClassStats ---
describe('computeClassStats()', () => {
  it('ödev yok → sıfır döner', () => {
    expect(computeClassStats('c1', [], [], 5)).toEqual({
      classId: 'c1', completionPct: 0, totalHomeworks: 0, studentCount: 5, pendingReview: 0,
    })
  })

  it('öğrenci yok → completionPct=0, crash yok', () => {
    expect(computeClassStats('c1', [hw('h1', 'c1')], [], 0).completionPct).toBe(0)
  })

  it('tüm yapıldı → 100%', () => {
    const homeworks = [hw('h1', 'c1'), hw('h2', 'c1')]
    const submissions = [
      sub('h1', 's1', 'yapildi'), sub('h1', 's2', 'yapildi'),
      sub('h2', 's1', 'yapildi'), sub('h2', 's2', 'yapildi'),
    ]
    expect(computeClassStats('c1', homeworks, submissions, 2).completionPct).toBe(100)
  })

  it('mazeretli paydadan çıkar: 1 yapıldı + 1 mazeretli / 2 öğrenci 1 ödev → 100%', () => {
    const homeworks = [hw('h1', 'c1')]
    const submissions = [sub('h1', 's1', 'yapildi'), sub('h1', 's2', 'mazeretli')]
    expect(computeClassStats('c1', homeworks, submissions, 2).completionPct).toBe(100)
  })

  it('pendingReview: tarihi geçmiş + submission yok → 1, tarihi gelmemiş → sayılmaz', () => {
    const homeworks = [hw('h1', 'c1', '2020-01-01'), hw('h2', 'c1', '2030-01-01')]
    expect(computeClassStats('c1', homeworks, [], 2).pendingReview).toBe(1)
  })

  it('başka sınıfın ödevleri sayılmaz', () => {
    const homeworks = [hw('h1', 'c1'), hw('h2', 'c2')]
    expect(computeClassStats('c1', homeworks, [], 5).totalHomeworks).toBe(1)
  })
})

// --- computeRiskyStudents ---
describe('computeRiskyStudents()', () => {
  it('2 eksik → listeye girmez (eşik: >= 3)', () => {
    const students = [student('s1', 'c1')]
    const homeworks = [hw('h1', 'c1'), hw('h2', 'c1')]
    const submissions = [sub('h1', 's1', 'yapilmadi'), sub('h2', 's1', 'eksik')]
    expect(computeRiskyStudents(students, homeworks, submissions)).toHaveLength(0)
  })

  it('3 eksik/yapılmadı → listeye girer', () => {
    const students = [student('s1', 'c1')]
    const homeworks = [hw('h1', 'c1'), hw('h2', 'c1'), hw('h3', 'c1')]
    const submissions = [
      sub('h1', 's1', 'yapilmadi'), sub('h2', 's1', 'eksik'), sub('h3', 's1', 'yapilmadi'),
    ]
    const result = computeRiskyStudents(students, homeworks, submissions)
    expect(result).toHaveLength(1)
    expect(result[0].missedCount).toBe(3)
    expect(result[0].totalHomeworks).toBe(3)
  })

  it('azalan missedCount sırası', () => {
    const students = [student('s1', 'c1'), student('s2', 'c1')]
    const homeworks = [hw('h1','c1'), hw('h2','c1'), hw('h3','c1'), hw('h4','c1')]
    const submissions = [
      sub('h1','s1','yapilmadi'), sub('h2','s1','eksik'), sub('h3','s1','yapilmadi'),
      sub('h1','s2','yapilmadi'), sub('h2','s2','eksik'), sub('h3','s2','yapilmadi'), sub('h4','s2','eksik'),
    ]
    const result = computeRiskyStudents(students, homeworks, submissions)
    expect(result[0].student_id).toBe('s2')
    expect(result[1].student_id).toBe('s1')
  })

  it('başka sınıfın ödevleri sayılmaz — missedCount=0 → listeye girmez', () => {
    const students = [student('s1', 'c1')]
    const homeworks = [hw('h1','c2'), hw('h2','c2'), hw('h3','c2')]
    const submissions = [
      sub('h1','s1','yapilmadi'), sub('h2','s1','eksik'), sub('h3','s1','yapilmadi'),
    ]
    expect(computeRiskyStudents(students, homeworks, submissions)).toHaveLength(0)
  })
})

// --- computeWeeklyTrend ---
describe('computeWeeklyTrend()', () => {
  it('ödev yok → boş dizi', () => {
    expect(computeWeeklyTrend([], [], [])).toEqual([])
  })

  it('due_date null → atlanır', () => {
    expect(computeWeeklyTrend([hw('h1', 'c1', null)], [], [student('s1','c1')])).toEqual([])
  })

  it('aynı haftaki iki ödev → tek bucket', () => {
    const homeworks = [hw('h1','c1','2026-06-02'), hw('h2','c1','2026-06-03')]
    expect(computeWeeklyTrend(homeworks, [], [student('s1','c1')])).toHaveLength(1)
  })

  it('tamamlanma oranı doğru: 1/2 yapıldı → pct=50', () => {
    const homeworks = [hw('h1','c1','2026-06-02')]
    const submissions = [sub('h1','s1','yapildi'), sub('h1','s2','yapilmadi')]
    const students = [student('s1','c1'), student('s2','c1')]
    const result = computeWeeklyTrend(homeworks, submissions, students)
    expect(result).toHaveLength(1)
    expect(result[0].pct).toBe(50)
  })

  it('en fazla 8 hafta döner', () => {
    const homeworks = Array.from({ length: 10 }, (_, i) => {
      const d = new Date('2026-01-05')
      d.setDate(d.getDate() + i * 7)
      return hw(`h${i}`, 'c1', d.toISOString().slice(0, 10))
    })
    expect(computeWeeklyTrend(homeworks, [], [student('s1','c1')]).length).toBeLessThanOrEqual(8)
  })
})

// --- computeKpiCards ---
describe('computeKpiCards()', () => {
  it('boş veri → sıfır döner, crash yok', () => {
    expect(computeKpiCards([], [], [])).toEqual({
      totalHomeworks: 0, avgCompletionPct: 0, riskyStudentCount: 0, pendingReviewCount: 0,
    })
  })

  it('toplam ödev sayısı doğru', () => {
    expect(computeKpiCards([hw('h1','c1'), hw('h2','c1')], [], []).totalHomeworks).toBe(2)
  })

  it('pendingReview: tarihi geçmiş + submission yok', () => {
    const homeworks = [hw('h1','c1','2020-01-01'), hw('h2','c1','2030-12-31')]
    expect(computeKpiCards(homeworks, [], [student('s1','c1')]).pendingReviewCount).toBe(1)
  })

  it('riskyStudentCount computeRiskyStudents ile tutarlı', () => {
    const students = [student('s1','c1')]
    const homeworks = [hw('h1','c1'), hw('h2','c1'), hw('h3','c1')]
    const submissions = [
      sub('h1','s1','yapilmadi'), sub('h2','s1','eksik'), sub('h3','s1','yapilmadi'),
    ]
    expect(computeKpiCards(homeworks, submissions, students).riskyStudentCount).toBe(1)
  })
})
```

- [ ] **Adım 2: Testleri çalıştır, FAIL olduklarını doğrula**

```
npx vitest run tests/vitest/unit/homework/analitik.test.ts
```

Beklenen: `Cannot find module '@/src/domains/homework/lib/analitik'`

---

### Task 2: Analytics lib uygula

**Files:**
- Create: `src/domains/homework/lib/analitik.ts`

- [ ] **Adım 1: Kütüphane dosyasını oluştur**

```ts
import { startOfWeek, parseISO } from '@/src/shared/date'
import type { SubmissionStatus } from '@/src/shared/types'

export type AnalitikHomework = {
  id: string
  class_id: string
  teacher_id: string
  due_date: string | null
  title: string
}

export type AnalitikSubmission = {
  homework_id: string
  student_id: string
  status: SubmissionStatus
}

export type AnalitikStudent = {
  id: string
  class_id: string
  full_name: string
  student_number: string | null
}

export type ClassStat = {
  classId: string
  completionPct: number
  totalHomeworks: number
  studentCount: number
  pendingReview: number
}

export type RiskyStudent = {
  student_id: string
  full_name: string
  student_number: string | null
  class_id: string
  missedCount: number
  totalHomeworks: number
}

export type WeekBucket = {
  weekKey: string
  pct: number
}

export type KpiCards = {
  totalHomeworks: number
  avgCompletionPct: number
  riskyStudentCount: number
  pendingReviewCount: number
}

export function computeClassStats(
  classId: string,
  homeworks: AnalitikHomework[],
  submissions: AnalitikSubmission[],
  studentCount: number,
): ClassStat {
  const classHws   = homeworks.filter(h => h.class_id === classId)
  const classHwIds = new Set(classHws.map(h => h.id))
  const classSubs  = submissions.filter(s => classHwIds.has(s.homework_id))

  const totalSlots = classHws.length * studentCount
  const yapildi    = classSubs.filter(s => s.status === 'yapildi').length
  const mazeretli  = classSubs.filter(s => s.status === 'mazeretli').length
  const eligible   = totalSlots - mazeretli
  const completionPct = eligible === 0 ? 0 : Math.round((yapildi / eligible) * 100)

  const today        = new Date().toISOString().slice(0, 10)
  const hwsWithSubs  = new Set(classSubs.map(s => s.homework_id))
  const pendingReview = classHws.filter(
    h => h.due_date !== null && h.due_date < today && !hwsWithSubs.has(h.id),
  ).length

  return { classId, completionPct, totalHomeworks: classHws.length, studentCount, pendingReview }
}

export function computeRiskyStudents(
  students: AnalitikStudent[],
  homeworks: AnalitikHomework[],
  submissions: AnalitikSubmission[],
): RiskyStudent[] {
  return students
    .map(s => {
      const classHwIds   = new Set(homeworks.filter(h => h.class_id === s.class_id).map(h => h.id))
      const totalHomeworks = classHwIds.size
      const missed        = submissions.filter(
        sub => sub.student_id === s.id && classHwIds.has(sub.homework_id) &&
               (sub.status === 'yapilmadi' || sub.status === 'eksik'),
      ).length
      return { student_id: s.id, full_name: s.full_name, student_number: s.student_number, class_id: s.class_id, missedCount: missed, totalHomeworks }
    })
    .filter(s => s.missedCount >= 3)
    .sort((a, b) => b.missedCount - a.missedCount)
}

export function computeWeeklyTrend(
  homeworks: AnalitikHomework[],
  submissions: AnalitikSubmission[],
  students: AnalitikStudent[],
): WeekBucket[] {
  const studentsByClass = new Map<string, number>()
  for (const s of students) {
    studentsByClass.set(s.class_id, (studentsByClass.get(s.class_id) ?? 0) + 1)
  }

  const weekMap = new Map<string, AnalitikHomework[]>()
  for (const hw of homeworks) {
    if (!hw.due_date) continue
    const weekKey = startOfWeek(parseISO(hw.due_date), { weekStartsOn: 1 }).toISOString().slice(0, 10)
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, [])
    weekMap.get(weekKey)!.push(hw)
  }

  return [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([weekKey, weekHws]) => {
      const hwIds    = new Set(weekHws.map(h => h.id))
      const weekSubs = submissions.filter(s => hwIds.has(s.homework_id))

      let totalSlots = 0
      let yapildi    = 0
      let mazeretli  = 0
      for (const hw of weekHws) totalSlots += studentsByClass.get(hw.class_id) ?? 0
      for (const s of weekSubs) {
        if (s.status === 'yapildi')    yapildi++
        else if (s.status === 'mazeretli') mazeretli++
      }

      const eligible = totalSlots - mazeretli
      return { weekKey, pct: eligible === 0 ? 0 : Math.round((yapildi / eligible) * 100) }
    })
}

export function computeKpiCards(
  homeworks: AnalitikHomework[],
  submissions: AnalitikSubmission[],
  students: AnalitikStudent[],
): KpiCards {
  const totalHomeworks = homeworks.length

  const studentsByClass = new Map<string, number>()
  for (const s of students) {
    studentsByClass.set(s.class_id, (studentsByClass.get(s.class_id) ?? 0) + 1)
  }

  let completionSum = 0
  let counted       = 0
  for (const hw of homeworks) {
    const count = studentsByClass.get(hw.class_id) ?? 0
    if (count === 0) continue
    const hwSubs    = submissions.filter(s => s.homework_id === hw.id)
    const yapildi   = hwSubs.filter(s => s.status === 'yapildi').length
    const mazeretli = hwSubs.filter(s => s.status === 'mazeretli').length
    const eligible  = count - mazeretli
    if (eligible > 0) { completionSum += Math.round((yapildi / eligible) * 100); counted++ }
  }
  const avgCompletionPct = counted === 0 ? 0 : Math.round(completionSum / counted)

  const riskyStudentCount  = computeRiskyStudents(students, homeworks, submissions).length
  const today              = new Date().toISOString().slice(0, 10)
  const hwsWithAnySub      = new Set(submissions.map(s => s.homework_id))
  const pendingReviewCount = homeworks.filter(
    h => h.due_date !== null && h.due_date < today && !hwsWithAnySub.has(h.id),
  ).length

  return { totalHomeworks, avgCompletionPct, riskyStudentCount, pendingReviewCount }
}
```

- [ ] **Adım 2: Testleri çalıştır, PASS olduklarını doğrula**

```
npx vitest run tests/vitest/unit/homework/analitik.test.ts
```

Beklenen: tüm testler PASS, sıfır FAIL

- [ ] **Adım 3: Commit**

```
git add src/domains/homework/lib/analitik.ts tests/vitest/unit/homework/analitik.test.ts
git commit -m "feat(analitik): analytics lib pure functions + unit tests"
```

---

### Task 3: AnalitikOzet.tsx

**Files:**
- Create: `app/(dashboard)/odevler/analitik/AnalitikOzet.tsx`

- [ ] **Adım 1: Bileşeni oluştur**

```tsx
import type { KpiCards } from '@/src/domains/homework/lib/analitik'

const KPI_CONFIG: { key: keyof KpiCards; label: string; color: string; dot: string; suffix?: string }[] = [
  { key: 'totalHomeworks',     label: 'Toplam Ödev',      color: 'text-blue-600 dark:text-blue-400',       dot: 'bg-blue-500'    },
  { key: 'avgCompletionPct',   label: 'Ort. Tamamlanma',  color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', suffix: '%' },
  { key: 'riskyStudentCount',  label: 'Riskli Öğrenci',   color: 'text-red-600 dark:text-red-400',         dot: 'bg-red-500'     },
  { key: 'pendingReviewCount', label: 'Bekleyen Kontrol', color: 'text-amber-600 dark:text-amber-400',     dot: 'bg-amber-500'   },
]

export default function AnalitikOzet({ kpi }: { kpi: KpiCards }) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      {KPI_CONFIG.map(({ key, label, color, dot, suffix }) => (
        <div key={key} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 px-4 py-3.5 shadow-sm flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
          <div>
            <p className={`text-2xl font-bold leading-none ${color}`}>
              {kpi[key]}{suffix ?? ''}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

---

### Task 4: SinifDetay.tsx

**Files:**
- Create: `app/(dashboard)/odevler/analitik/SinifDetay.tsx`

- [ ] **Adım 1: Bileşeni oluştur**

```tsx
import Link from 'next/link'
import { format, parseISO } from '@/src/shared/date'
import type { ClassStat, WeekBucket } from '@/src/domains/homework/lib/analitik'

type ClassStatWithMeta = ClassStat & { name: string; grade: number }

function barColor(pct: number) {
  if (pct >= 80) return 'bg-emerald-500'
  if (pct >= 60) return 'bg-amber-400'
  return 'bg-red-400'
}

function pctTextColor(pct: number) {
  if (pct >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-500 dark:text-red-400'
}

export default function SinifDetay({
  classStats,
  weeklyTrend,
}: {
  classStats: ClassStatWithMeta[]
  weeklyTrend: WeekBucket[]
}) {
  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
        Sınıf Bazlı Tamamlanma
      </h2>

      {classStats.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-8 text-center">
          <p className="text-sm text-gray-400 dark:text-slate-500">Henüz ödev atanmamış.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {classStats.map(cls => (
            <Link
              key={cls.classId}
              href={`/odevler/sinif/${cls.classId}`}
              className="block bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{cls.name}</span>
                <span className={`text-sm font-bold ${pctTextColor(cls.completionPct)}`}>%{cls.completionPct}</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor(cls.completionPct)}`} style={{ width: `${cls.completionPct}%` }} />
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">
                {cls.totalHomeworks} ödev · {cls.studentCount} öğrenci
              </p>
            </Link>
          ))}
        </div>
      )}

      {weeklyTrend.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
            Dönemlik Eğilim
          </h2>
          <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-end gap-2">
              {weeklyTrend.map(({ weekKey, pct }) => (
                <div key={weekKey} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">{pct}%</span>
                  <div className="w-full flex items-end" style={{ height: '60px' }}>
                    <div
                      className={`w-full rounded-t ${barColor(pct)}`}
                      style={{ height: `${Math.max(3, (pct / 100) * 60)}px` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 truncate w-full text-center">
                    {format(parseISO(weekKey), 'd MMM')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

### Task 5: OgrenciSicil.tsx

**Files:**
- Create: `app/(dashboard)/odevler/analitik/OgrenciSicil.tsx`

- [ ] **Adım 1: Bileşeni oluştur**

```tsx
'use client'

import { useState } from 'react'
import type { RiskyStudent } from '@/src/domains/homework/lib/analitik'
import StudentHomeworkProfileModal from '../[id]/StudentHomeworkProfileModal'

export default function OgrenciSicil({ riskyStudents }: { riskyStudents: RiskyStudent[] }) {
  const [selectedId, setSelectedId]           = useState<string | null>(null)
  const [selectedClassId, setSelectedClassId] = useState<string>('')

  if (riskyStudents.length === 0) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-6 text-center">
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Tüm öğrenciler düzenli</p>
        <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70 mt-1">
          3 veya daha fazla eksik/yapılmadı olan öğrenci yok.
        </p>
      </div>
    )
  }

  return (
    <>
      <div>
        <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          Riskli Öğrenciler
        </h2>
        <div className="space-y-2">
          {riskyStudents.map(s => (
            <button
              key={s.student_id}
              onClick={() => { setSelectedId(s.student_id); setSelectedClassId(s.class_id) }}
              className="w-full flex items-center justify-between bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 hover:border-red-200 dark:hover:border-red-800 transition-colors text-left"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{s.full_name}</p>
                {s.student_number && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">No: {s.student_number}</p>
                )}
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${
                s.missedCount >= Math.ceil(s.totalHomeworks / 2)
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              }`}>
                {s.missedCount}/{s.totalHomeworks} eksik
              </span>
            </button>
          ))}
        </div>
      </div>

      <StudentHomeworkProfileModal
        studentId={selectedId}
        classId={selectedClassId}
        onClose={() => setSelectedId(null)}
      />
    </>
  )
}
```

---

### Task 6: Analytics page.tsx

**Files:**
- Create: `app/(dashboard)/odevler/analitik/page.tsx`

- [ ] **Adım 1: Server component sayfayı oluştur**

```tsx
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile, getCurrentUser } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isMudurOrAbove, isTeachingRole } from '@/src/shared/types'
import {
  computeKpiCards,
  computeRiskyStudents,
  computeClassStats,
  computeWeeklyTrend,
  type AnalitikHomework,
  type AnalitikSubmission,
  type AnalitikStudent,
} from '@/src/domains/homework/lib/analitik'
import AnalitikOzet from './AnalitikOzet'
import SinifDetay from './SinifDetay'
import OgrenciSicil from './OgrenciSicil'

export const revalidate = 30

export default async function AnalitikPage() {
  const [profile, user] = await Promise.all([getCurrentProfile(), getCurrentUser()])
  if (!profile?.school_id || !user) redirect('/login')

  const canAccess = isTeachingRole(profile.role) || isMudurOrAbove(profile.role)
  if (!canAccess) redirect('/odevler')

  const sid       = profile.school_id
  const isManager = profile.role === 'zumre_baskani' || isMudurOrAbove(profile.role)
  const supabase  = await createClient()

  let hwQuery = supabase
    .from('homeworks')
    .select('id, class_id, teacher_id, due_date, title')
    .eq('school_id', sid)
    .is('deleted_at', null)
    .eq('is_template', false)

  if (!isManager) hwQuery = hwQuery.eq('teacher_id', user.id)

  const [classesRes, homeworksRes] = await Promise.all([
    supabase.from('classes').select('id, name, grade').eq('school_id', sid).order('grade').order('name'),
    hwQuery,
  ])

  const homeworks  = (homeworksRes.data ?? []) as AnalitikHomework[]
  const classIds   = [...new Set(homeworks.map(h => h.class_id))]
  const hwIds      = homeworks.map(h => h.id)

  const [submissionsRes, studentsRes] = await Promise.all([
    hwIds.length > 0
      ? supabase
          .from('homework_submissions')
          .select('homework_id, student_id, status')
          .in('homework_id', hwIds)
          .eq('school_id', sid)
      : Promise.resolve({ data: [] as { homework_id: string; student_id: string; status: string }[] }),
    classIds.length > 0
      ? supabase
          .from('students')
          .select('id, class_id, full_name, student_number')
          .in('class_id', classIds)
          .eq('school_id', sid)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] as { id: string; class_id: string; full_name: string; student_number: string | null }[] }),
  ])

  const submissions   = (submissionsRes.data ?? []) as AnalitikSubmission[]
  const students      = (studentsRes.data  ?? []) as AnalitikStudent[]
  const activeClasses = (classesRes.data   ?? []).filter(c => classIds.includes(c.id))

  const kpi           = computeKpiCards(homeworks, submissions, students)
  const weeklyTrend   = computeWeeklyTrend(homeworks, submissions, students)
  const riskyStudents = computeRiskyStudents(students, homeworks, submissions)

  const classStats = activeClasses.map(c => {
    const studentCount = students.filter(s => s.class_id === c.id).length
    return { name: c.name, grade: c.grade, ...computeClassStats(c.id, homeworks, submissions, studentCount) }
  }).filter(c => c.totalHomeworks > 0)

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-purple-50/10 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Ödev Analitiği</h1>
          <Link
            href="/odevler"
            className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
          >
            ← Ödevler
          </Link>
        </div>
        <AnalitikOzet kpi={kpi} />
        <SinifDetay classStats={classStats} weeklyTrend={weeklyTrend} />
        <OgrenciSicil riskyStudents={riskyStudents} />
      </div>
    </div>
  )
}
```

- [ ] **Adım 2: TypeScript kontrolü yap**

```
npx tsc --noEmit
```

Beklenen: Hata yok

- [ ] **Adım 3: Commit**

```
git add app/(dashboard)/odevler/analitik/
git commit -m "feat(analitik): /odevler/analitik sayfası — KPI, sınıf barları, trend, riskli öğrenciler"
```

---

### Task 7: StatusBoard mobil CSS

**Files:**
- Modify: `app/(dashboard)/odevler/[id]/StatusBoard.tsx`

- [ ] **Adım 1: Durum buton bloğunu bul ve değiştir**

`StatusBoard.tsx`'te şu bloğu bul (`{/* Durum chip butonları */}` yorumu ile başlar):

```tsx
{/* Durum chip butonları */}
<div className="flex flex-wrap gap-1.5">
  {STATUS_OPTIONS.map(option => (
    <button
      key={option}
      disabled={isItemPending}
      onClick={() => setStatus(item.student_id, option)}
      className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors disabled:cursor-not-allowed ${
        status === option
          ? STYLES[option]
          : 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-slate-700/50 dark:text-slate-500 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
      }`}
    >
      {LABELS[option]}
    </button>
  ))}
</div>
```

Şu şekilde değiştir (3+2 grid, min-h-[44px]):

```tsx
{/* Durum butonları — 3+2 grid, min-h-[44px] WCAG dokunma hedefi */}
<div className="grid grid-cols-3 gap-1.5 mb-1.5">
  {(['yapildi', 'eksik', 'yapilmadi'] as SubmissionStatus[]).map(option => (
    <button
      key={option}
      disabled={isItemPending}
      onClick={() => setStatus(item.student_id, option)}
      className={`text-xs px-2 rounded-xl border transition-colors min-h-[44px] flex items-center justify-center disabled:cursor-not-allowed ${
        status === option
          ? `${STYLES[option]} ring-2 ring-current font-bold`
          : 'font-medium bg-gray-50 text-gray-400 border-gray-200 dark:bg-slate-700/50 dark:text-slate-500 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
      }`}
    >
      {LABELS[option]}
    </button>
  ))}
</div>
<div className="grid grid-cols-2 gap-1.5">
  {(['gec', 'mazeretli'] as SubmissionStatus[]).map(option => (
    <button
      key={option}
      disabled={isItemPending}
      onClick={() => setStatus(item.student_id, option)}
      className={`text-xs px-2 rounded-xl border transition-colors min-h-[44px] flex items-center justify-center disabled:cursor-not-allowed ${
        status === option
          ? `${STYLES[option]} ring-2 ring-current font-bold`
          : 'font-medium bg-gray-50 text-gray-400 border-gray-200 dark:bg-slate-700/50 dark:text-slate-500 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
      }`}
    >
      {LABELS[option]}
    </button>
  ))}
</div>
```

- [ ] **Adım 2: Not butonunu bul ve büyüt**

Şu satırı bul:
```tsx
className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
```

Şu şekilde değiştir:
```tsx
className={`shrink-0 text-xs px-2.5 min-h-[44px] min-w-[72px] rounded-lg border transition-colors ${
```

- [ ] **Adım 3: Commit**

```
git add app/(dashboard)/odevler/[id]/StatusBoard.tsx
git commit -m "fix(statusboard): mobil dokunma hedefi min-h-[44px], 3+2 grid layout"
```

---

### Task 8: Navigasyon linki

**Files:**
- Modify: `app/(dashboard)/odevler/page.tsx`

- [ ] **Adım 1: Takvim linkini bul ve öncesine analitik linki ekle**

`page.tsx`'te şu bloğu bul:

```tsx
<Link
  href="/odevler/takvim"
  className="flex items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-gray-800 dark:hover:text-slate-200 shadow-sm hover:shadow transition-all"
  title="Takvim görünümü"
>
```

Öncesine şunu ekle (aralarında boşluk bırak):

```tsx
<Link
  href="/odevler/analitik"
  className="flex items-center justify-center w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-gray-800 dark:hover:text-slate-200 shadow-sm hover:shadow transition-all"
  title="Analitik"
>
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
</Link>
```

- [ ] **Adım 2: Commit**

```
git add app/(dashboard)/odevler/page.tsx
git commit -m "feat(analitik): ödevler sayfasına analitik navigasyon ikonu"
```

---

### Task 9: Integration testler + final koşu

**Files:**
- Create: `tests/vitest/integration/server-actions/analitik-data.test.ts`

- [ ] **Adım 1: Integration test dosyasını oluştur**

```ts
/**
 * Analitik veri katmanı integration testleri.
 * DB gerçek Supabase ile çalışır; lib fonksiyonları edge case'ler için test edilir.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  serviceDb,
  createTestSchool,
  createTestUser,
  cleanupTestData,
  type TestSchool,
  type TestUser,
} from '../../setup/db'
import { computeKpiCards, computeRiskyStudents } from '@/src/domains/homework/lib/analitik'
import type { AnalitikHomework, AnalitikSubmission, AnalitikStudent } from '@/src/domains/homework/lib/analitik'

let schoolA: TestSchool
let schoolB: TestSchool
let teacherA: TestUser
let teacherB: TestUser
let classAId: string
let classBId: string
const hwIds: string[] = []

beforeAll(async () => {
  schoolA  = await createTestSchool('_ANALITIK_A')
  schoolB  = await createTestSchool('_ANALITIK_B')
  teacherA = await createTestUser({ role: 'ogretmen', schoolId: schoolA.id })
  teacherB = await createTestUser({ role: 'ogretmen', schoolId: schoolB.id })

  const { data: clsA } = await serviceDb
    .from('classes')
    .insert({ name: 'Analitik A', grade: 5, academic_year: '2025-2026', school_id: schoolA.id })
    .select('id').single()
  classAId = clsA!.id

  const { data: clsB } = await serviceDb
    .from('classes')
    .insert({ name: 'Analitik B', grade: 5, academic_year: '2025-2026', school_id: schoolB.id })
    .select('id').single()
  classBId = clsB!.id

  const { data: hwsA } = await serviceDb
    .from('homeworks')
    .insert([
      { class_id: classAId, teacher_id: teacherA.id, school_id: schoolA.id, title: 'Ödev A1', subject: 'Mat', due_date: '2020-01-01', is_template: false },
      { class_id: classAId, teacher_id: teacherA.id, school_id: schoolA.id, title: 'Ödev A2', subject: 'Mat', due_date: '2020-01-08', is_template: false },
      { class_id: classAId, teacher_id: teacherA.id, school_id: schoolA.id, title: 'Ödev A3', subject: 'Mat', due_date: '2020-01-15', is_template: false },
    ])
    .select('id')
  hwIds.push(...(hwsA ?? []).map(h => h.id))
})

afterAll(async () => {
  if (hwIds.length) {
    await serviceDb.from('homework_submissions').delete().in('homework_id', hwIds)
    await serviceDb.from('homeworks').delete().in('id', hwIds)
    await serviceDb.from('classes').delete().in('id', [classAId, classBId])
  }
  await cleanupTestData({ userIds: [teacherA.id, teacherB.id], schoolIds: [schoolA.id, schoolB.id] })
})

describe('RBAC: okul izolasyonu', () => {
  it('teacher_id + school_id filtresi → yalnızca kendi ödevler döner', async () => {
    const { data } = await serviceDb
      .from('homeworks')
      .select('id, teacher_id')
      .eq('school_id', schoolA.id)
      .eq('teacher_id', teacherA.id)
      .is('deleted_at', null)
      .eq('is_template', false)

    expect(data).toHaveLength(3)
    expect(data?.every(h => h.teacher_id === teacherA.id)).toBe(true)
  })

  it('Okul B filtresiyle Okul A öğretmeninin verisi dönmez', async () => {
    const { data } = await serviceDb
      .from('homeworks')
      .select('id')
      .eq('school_id', schoolB.id)
      .eq('teacher_id', teacherA.id)

    expect(data).toHaveLength(0)
  })
})

describe('computeKpiCards — sınır durumlar', () => {
  it('boş arrays → sıfır döner, crash yok', () => {
    const result = computeKpiCards([], [], [])
    expect(result).toEqual({ totalHomeworks: 0, avgCompletionPct: 0, riskyStudentCount: 0, pendingReviewCount: 0 })
  })

  it('öğrencisi olmayan sınıfın ödevi → avgCompletionPct=0, crash yok', () => {
    const homeworks: AnalitikHomework[] = [
      { id: 'h-edge', class_id: 'no-students-class', teacher_id: 't1', due_date: '2030-01-01', title: 'Test' },
    ]
    const result = computeKpiCards(homeworks, [], [])
    expect(result.totalHomeworks).toBe(1)
    expect(result.avgCompletionPct).toBe(0)
  })
})

describe('computeRiskyStudents — sınır durumlar', () => {
  it('tam 3 eksik → riskli sayılır', () => {
    const students: AnalitikStudent[] = [{ id: 's1', class_id: 'c1', full_name: 'Test', student_number: null }]
    const homeworks: AnalitikHomework[] = [
      { id: 'h1', class_id: 'c1', teacher_id: 't1', due_date: '2026-01-01', title: 'H1' },
      { id: 'h2', class_id: 'c1', teacher_id: 't1', due_date: '2026-01-08', title: 'H2' },
      { id: 'h3', class_id: 'c1', teacher_id: 't1', due_date: '2026-01-15', title: 'H3' },
    ]
    const submissions: AnalitikSubmission[] = [
      { homework_id: 'h1', student_id: 's1', status: 'yapilmadi' },
      { homework_id: 'h2', student_id: 's1', status: 'eksik' },
      { homework_id: 'h3', student_id: 's1', status: 'yapilmadi' },
    ]
    expect(computeRiskyStudents(students, homeworks, submissions)).toHaveLength(1)
  })

  it('tam 2 eksik → riskli sayılmaz', () => {
    const students: AnalitikStudent[] = [{ id: 's1', class_id: 'c1', full_name: 'Test', student_number: null }]
    const homeworks: AnalitikHomework[] = [
      { id: 'h1', class_id: 'c1', teacher_id: 't1', due_date: '2026-01-01', title: 'H1' },
      { id: 'h2', class_id: 'c1', teacher_id: 't1', due_date: '2026-01-08', title: 'H2' },
    ]
    const submissions: AnalitikSubmission[] = [
      { homework_id: 'h1', student_id: 's1', status: 'yapilmadi' },
      { homework_id: 'h2', student_id: 's1', status: 'eksik' },
    ]
    expect(computeRiskyStudents(students, homeworks, submissions)).toHaveLength(0)
  })
})
```

- [ ] **Adım 2: Tüm testleri çalıştır**

```
npm run test
```

Beklenen: önceki 333 + yeni testler PASS, sıfır FAIL

- [ ] **Adım 3: Commit**

```
git add tests/vitest/integration/server-actions/analitik-data.test.ts
git commit -m "test(analitik): RBAC izolasyon + edge case integration testleri"
```
