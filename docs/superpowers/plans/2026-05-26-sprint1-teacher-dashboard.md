# Sprint 1: Teacher Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mevcut inline dashboard kodunu `TeacherDashboardService`'e taşı, 3 kart + haftalık şerit layoutuna geç, sınıf detay sayfasına performans widget'ı ekle, iki DB tablosu migrate et.

**Architecture:** `src/domains/dashboard/` altında `Repository → Service → UI` katmanı. Risk hesaplama saf fonksiyonlarda (`risk.ts`) izole edilir. DB yan etkileri (history snapshot, activity log) service katmanında yönetilir.

**Tech Stack:** Next.js 16 App Router (Server Components), Supabase SSR, TypeScript, Vitest (unit), Tailwind v4

---

## Dosya Haritası

| İşlem | Dosya | Sorumluluk |
|---|---|---|
| Oluştur | `src/domains/dashboard/types.ts` | DashboardMetrics, RiskAlert, ClassSummary, HomeworkLite tipleri |
| Oluştur | `src/domains/dashboard/risk.ts` | computeRiskLevel, computeRiskScore (saf fonksiyonlar) |
| Oluştur | `src/domains/dashboard/repositories/DashboardRepository.ts` | Tüm DB sorguları |
| Oluştur | `src/domains/dashboard/services/TeacherDashboardService.ts` | getDashboardMetrics, getRiskAlerts, getClassSummary, logActivity |
| Oluştur | `supabase/migrations/20260526000000_teacher_activity_log.sql` | teacher_activity_log tablosu |
| Oluştur | `supabase/migrations/20260526000001_student_risk_history.sql` | student_risk_history tablosu |
| Oluştur | `tests/vitest/unit/dashboard/risk.test.ts` | risk.ts unit testleri |
| Oluştur | `tests/vitest/unit/dashboard/service.test.ts` | TeacherDashboardService unit testleri |
| Oluştur | `app/(dashboard)/siniflar/[id]/PerformansWidget.tsx` | Sınıf özeti + riskli öğrenciler widget'ı |
| Güncelle | `app/(dashboard)/anasayfa/OgretmenDashboard.tsx` | Service kullan, yeni layout |
| Güncelle | `app/(dashboard)/anasayfa/RiskUyarilariWidget.tsx` | DB sorgularını service'e taşı |
| Güncelle | `app/(dashboard)/siniflar/[id]/page.tsx` | PerformansWidget ekle |
| Sil | `app/(dashboard)/anasayfa/SubmissionsPanel.tsx` | Yeni layout'ta kullanılmıyor |

---

## Task 1: Tipler ve Risk Saf Fonksiyonları (TDD)

**Files:**
- Create: `src/domains/dashboard/types.ts`
- Create: `src/domains/dashboard/risk.ts`
- Create: `tests/vitest/unit/dashboard/risk.test.ts`

- [ ] **Adım 1: types.ts dosyasını oluştur**

```typescript
// src/domains/dashboard/types.ts
import type { RiskLevel } from './risk'

export type HomeworkLite = {
  id: string
  title: string
  subject: string
  due_date: string
  class_id: string
  classes: { name: string; grade: number } | null
}

export type WeeklyStats = {
  submittedCount: number
  avgCompletionPct: number
  newRiskCount: number
}

export type DashboardMetrics = {
  todayHomeworkCount: number
  totalMissingCount: number
  activeRiskCount: number
  weekly: WeeklyStats
  homeworks: HomeworkLite[]
}

export type RiskAlert = {
  studentId: string
  studentName: string
  classId: string
  className: string
  riskLevel: RiskLevel
  reasons: string[]
  hwMisses: number
  absences: number
}

export type ClassSummary = {
  avgCompletionPct: number
  highRiskCount: number
  totalMissingCount: number
  riskyStudents: RiskAlert[]
}
```

- [ ] **Adım 2: Failing testleri yaz**

```typescript
// tests/vitest/unit/dashboard/risk.test.ts
import { describe, it, expect } from 'vitest'
import { computeRiskLevel, computeRiskScore } from '@/src/domains/dashboard/risk'

describe('computeRiskLevel', () => {
  it('3+ ödev miss → high', () => {
    expect(computeRiskLevel(3, 0)).toBe('high')
  })
  it('3+ devamsızlık → high', () => {
    expect(computeRiskLevel(0, 3)).toBe('high')
  })
  it('2 ödev miss → medium', () => {
    expect(computeRiskLevel(2, 0)).toBe('medium')
  })
  it('2 devamsızlık → medium', () => {
    expect(computeRiskLevel(0, 2)).toBe('medium')
  })
  it('1 ödev miss → low', () => {
    expect(computeRiskLevel(1, 0)).toBe('low')
  })
  it('0 miss 0 devamsız → low', () => {
    expect(computeRiskLevel(0, 0)).toBe('low')
  })
  it('hw high devamsız medium → high', () => {
    expect(computeRiskLevel(3, 2)).toBe('high')
  })
})

describe('computeRiskScore', () => {
  it('5 miss 5 devamsız → 100', () => {
    expect(computeRiskScore(5, 5)).toBe(100)
  })
  it('0 miss 0 devamsız → 0', () => {
    expect(computeRiskScore(0, 0)).toBe(0)
  })
  it('3 miss 0 devamsız → 36', () => {
    // (3/5)*60 = 36
    expect(computeRiskScore(3, 0)).toBe(36)
  })
  it('0 miss 3 devamsız → 24', () => {
    // (3/5)*40 = 24
    expect(computeRiskScore(0, 3)).toBe(24)
  })
})
```

- [ ] **Adım 3: Testleri çalıştır — FAIL bekleniyor**

```bash
npx vitest run tests/vitest/unit/dashboard/risk.test.ts
```
Beklenen: `Cannot find module '@/src/domains/dashboard/risk'`

- [ ] **Adım 4: risk.ts implementasyonunu yaz**

```typescript
// src/domains/dashboard/risk.ts

export type RiskLevel = 'high' | 'medium' | 'low'

export function computeRiskLevel(hwMisses: number, absences: number): RiskLevel {
  if (hwMisses >= 3 || absences >= 3) return 'high'
  if (hwMisses >= 2 || absences >= 2) return 'medium'
  return 'low'
}

export function computeRiskScore(hwMisses: number, absences: number): number {
  const hwScore = Math.min(hwMisses / 5, 1) * 60
  const attScore = Math.min(absences / 5, 1) * 40
  return Math.round(hwScore + attScore)
}
```

- [ ] **Adım 5: Testleri çalıştır — PASS bekleniyor**

```bash
npx vitest run tests/vitest/unit/dashboard/risk.test.ts
```
Beklenen: `11 tests passed`

- [ ] **Adım 6: Commit**

```bash
git add src/domains/dashboard/types.ts src/domains/dashboard/risk.ts tests/vitest/unit/dashboard/risk.test.ts
git commit -m "feat(dashboard): risk saf fonksiyonları ve tip tanımları"
```

---

## Task 2: DashboardRepository

**Files:**
- Create: `src/domains/dashboard/repositories/DashboardRepository.ts`

- [ ] **Adım 1: Repository dosyasını oluştur**

```typescript
// src/domains/dashboard/repositories/DashboardRepository.ts
import { createClient } from '@/src/infrastructure/supabase/server'

export const DashboardRepository = {
  async getTeacherHomeworks(teacherId: string) {
    const supabase = await createClient()
    return supabase
      .from('homeworks')
      .select('id, title, subject, due_date, class_id, classes(name, grade)')
      .eq('teacher_id', teacherId)
      .is('deleted_at', null)
      .order('due_date', { ascending: false })
  },

  async getSubmissions(hwIds: string[]) {
    if (hwIds.length === 0) return { data: [] }
    const supabase = await createClient()
    return supabase
      .from('homework_submissions')
      .select('homework_id, student_id, status')
      .in('homework_id', hwIds)
  },

  async getAttendanceRows(classIds: string[], teacherId: string, sinceDate: string) {
    if (classIds.length === 0) return { data: [] }
    const supabase = await createClient()
    return supabase
      .from('attendance')
      .select('student_id, status')
      .in('class_id', classIds)
      .eq('teacher_id', teacherId)
      .gte('date', sinceDate)
  },

  async getStudentsByClasses(classIds: string[]) {
    if (classIds.length === 0) return { data: [] }
    const supabase = await createClient()
    return supabase
      .from('students')
      .select('id, full_name, class_id, classes(name)')
      .in('class_id', classIds)
      .is('deleted_at', null)
  },

  async getWeeklySubmissionStats(hwIds: string[], weekStart: string) {
    if (hwIds.length === 0) return { data: [] }
    const supabase = await createClient()
    return supabase
      .from('homework_submissions')
      .select('homework_id, status')
      .in('homework_id', hwIds)
      .gte('updated_at', weekStart)
  },

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

  async insertRiskSnapshots(rows: {
    student_id: string
    school_id: string
    teacher_id: string
    risk_level: string
    risk_score: number
    hw_misses: number
    absences: number
  }[]) {
    if (rows.length === 0) return
    const supabase = await createClient()
    await supabase.from('student_risk_history').insert(rows)
  },

  async insertActivityLog(row: {
    teacher_id: string
    school_id: string
    action: string
    meta?: object
  }) {
    const supabase = await createClient()
    await supabase.from('teacher_activity_log').insert(row)
  },

  async getClassSubmissions(classId: string, teacherId: string) {
    const supabase = await createClient()
    const { data: homeworks } = await supabase
      .from('homeworks')
      .select('id')
      .eq('class_id', classId)
      .eq('teacher_id', teacherId)
      .is('deleted_at', null)
    const hwIds = (homeworks ?? []).map((h: { id: string }) => h.id)
    if (hwIds.length === 0) return { data: [] }
    return supabase
      .from('homework_submissions')
      .select('homework_id, student_id, status')
      .in('homework_id', hwIds)
  },
}
```

- [ ] **Adım 2: Commit**

```bash
git add src/domains/dashboard/repositories/DashboardRepository.ts
git commit -m "feat(dashboard): DashboardRepository DB sorgu katmanı"
```

---

## Task 3: TeacherDashboardService (TDD)

**Files:**
- Create: `src/domains/dashboard/services/TeacherDashboardService.ts`
- Create: `tests/vitest/unit/dashboard/service.test.ts`

- [ ] **Adım 1: Failing service testlerini yaz**

```typescript
// tests/vitest/unit/dashboard/service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/dashboard/repositories/DashboardRepository', () => ({
  DashboardRepository: {
    getTeacherHomeworks:      vi.fn(),
    getSubmissions:           vi.fn(),
    getAttendanceRows:        vi.fn(),
    getStudentsByClasses:     vi.fn(),
    getWeeklySubmissionStats: vi.fn(),
    getWeeklyRiskCount:       vi.fn(),
    insertRiskSnapshots:      vi.fn(),
    insertActivityLog:        vi.fn(),
    getClassSubmissions:      vi.fn(),
  },
}))

vi.mock('@/src/shared/auth', () => ({
  getCurrentProfile: vi.fn(),
}))

const { DashboardRepository } = await import('@/src/domains/dashboard/repositories/DashboardRepository')
const { getCurrentProfile }   = await import('@/src/shared/auth')
const { TeacherDashboardService } = await import('@/src/domains/dashboard/services/TeacherDashboardService')

const TEACHER_ID = 'teacher-1'
const SCHOOL_ID  = 'school-1'
const HW_ID      = 'hw-1'
const CLASS_ID   = 'class-1'
const STUDENT_ID = 'student-1'

beforeEach(() => {
  vi.clearAllMocks()
  ;(getCurrentProfile as ReturnType<typeof vi.fn>).mockResolvedValue({ school_id: SCHOOL_ID })
})

describe('getDashboardMetrics', () => {
  it('bugün teslim ödev sayısını doğru sayar', async () => {
    const today = new Date().toISOString().split('T')[0]
    ;(DashboardRepository.getTeacherHomeworks as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: HW_ID, title: 'Test', subject: 'Mat', due_date: today, class_id: CLASS_ID, classes: { name: '10-A', grade: 10 } }],
    })
    ;(DashboardRepository.getSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getAttendanceRows as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getStudentsByClasses as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getWeeklySubmissionStats as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getWeeklyRiskCount as ReturnType<typeof vi.fn>).mockResolvedValue(0)

    const metrics = await TeacherDashboardService.getDashboardMetrics(TEACHER_ID)
    expect(metrics.todayHomeworkCount).toBe(1)
  })

  it('eksik submission toplamını doğru sayar', async () => {
    const pastDate = '2020-01-01'
    ;(DashboardRepository.getTeacherHomeworks as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: HW_ID, title: 'Test', subject: 'Mat', due_date: pastDate, class_id: CLASS_ID, classes: null }],
    })
    ;(DashboardRepository.getSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        { homework_id: HW_ID, student_id: STUDENT_ID, status: 'eksik' },
        { homework_id: HW_ID, student_id: 'student-2', status: 'yapildi' },
      ],
    })
    ;(DashboardRepository.getAttendanceRows as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getStudentsByClasses as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getWeeklySubmissionStats as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getWeeklyRiskCount as ReturnType<typeof vi.fn>).mockResolvedValue(0)

    const metrics = await TeacherDashboardService.getDashboardMetrics(TEACHER_ID)
    expect(metrics.totalMissingCount).toBe(1)
  })

  it('aktif risk sayısını doğru hesaplar (3 miss → high risk)', async () => {
    const pastDate = '2020-01-01'
    ;(DashboardRepository.getTeacherHomeworks as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: Array.from({ length: 5 }, (_, i) => ({
        id: `hw-${i}`, title: 'T', subject: 'Mat', due_date: pastDate, class_id: CLASS_ID, classes: null,
      })),
    })
    ;(DashboardRepository.getSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: Array.from({ length: 3 }, (_, i) => ({
        homework_id: `hw-${i}`, student_id: STUDENT_ID, status: 'eksik',
      })),
    })
    ;(DashboardRepository.getAttendanceRows as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getStudentsByClasses as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: STUDENT_ID, full_name: 'Ahmet', class_id: CLASS_ID, classes: { name: '10-A' } }],
    })
    ;(DashboardRepository.getWeeklySubmissionStats as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getWeeklyRiskCount as ReturnType<typeof vi.fn>).mockResolvedValue(0)

    const metrics = await TeacherDashboardService.getDashboardMetrics(TEACHER_ID)
    expect(metrics.activeRiskCount).toBe(1)
  })
})

describe('getRiskAlerts', () => {
  it('risk olan öğrencileri döner ve history snapshot yazar', async () => {
    const pastDate = '2020-01-01'
    ;(DashboardRepository.getTeacherHomeworks as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: Array.from({ length: 5 }, (_, i) => ({
        id: `hw-${i}`, title: 'T', subject: 'Mat', due_date: pastDate, class_id: CLASS_ID, classes: null,
      })),
    })
    ;(DashboardRepository.getSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: Array.from({ length: 3 }, (_, i) => ({
        homework_id: `hw-${i}`, student_id: STUDENT_ID, status: 'eksik',
      })),
    })
    ;(DashboardRepository.getAttendanceRows as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getStudentsByClasses as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: STUDENT_ID, full_name: 'Ahmet', class_id: CLASS_ID, classes: { name: '10-A' } }],
    })
    ;(DashboardRepository.insertRiskSnapshots as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const alerts = await TeacherDashboardService.getRiskAlerts(TEACHER_ID)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].riskLevel).toBe('high')
    expect(DashboardRepository.insertRiskSnapshots).toHaveBeenCalledOnce()
  })

  it('risk olmayan öğrencileri döndürmez', async () => {
    ;(DashboardRepository.getTeacherHomeworks as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getAttendanceRows as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getStudentsByClasses as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.insertRiskSnapshots as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const alerts = await TeacherDashboardService.getRiskAlerts(TEACHER_ID)
    expect(alerts).toHaveLength(0)
  })
})

describe('logActivity', () => {
  it('hata fırlatmaz — repo hatası sessiz geçer', async () => {
    ;(DashboardRepository.insertActivityLog as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('DB error')
    )
    await expect(
      TeacherDashboardService.logActivity(TEACHER_ID, 'dashboard_view')
    ).resolves.toBeUndefined()
  })
})

describe('getClassSummary', () => {
  it('sınıfta öğrenci yoksa null döner', async () => {
    ;(DashboardRepository.getClassSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getAttendanceRows as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
    ;(DashboardRepository.getStudentsByClasses as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })

    const result = await TeacherDashboardService.getClassSummary(CLASS_ID, TEACHER_ID)
    expect(result).toBeNull()
  })
})
```

- [ ] **Adım 2: Testleri çalıştır — FAIL bekleniyor**

```bash
npx vitest run tests/vitest/unit/dashboard/service.test.ts
```
Beklenen: `Cannot find module '@/src/domains/dashboard/services/TeacherDashboardService'`

- [ ] **Adım 3: TeacherDashboardService implementasyonunu yaz**

```typescript
// src/domains/dashboard/services/TeacherDashboardService.ts
import { DashboardRepository } from '../repositories/DashboardRepository'
import { computeRiskLevel, computeRiskScore } from '../risk'
import { getCurrentProfile } from '@/src/shared/auth'
import { subDays } from '@/src/shared/date'
import type { DashboardMetrics, RiskAlert, ClassSummary, HomeworkLite } from '../types'

type StudentRow = { id: string; full_name: string; class_id: string; classes: { name: string } | null }
type SubmissionRow = { homework_id: string; student_id: string; status: string }
type HwRow = { id: string; title: string; subject: string; due_date: string; class_id: string; classes: { name: string; grade: number } | null }

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function computeAlerts(
  homeworks: HwRow[],
  submissions: SubmissionRow[],
  attendanceRows: { student_id: string; status: string }[],
  students: StudentRow[],
): RiskAlert[] {
  const lastHwByClass = new Map<string, string[]>()
  for (const hw of homeworks) {
    const arr = lastHwByClass.get(hw.class_id) ?? []
    if (arr.length < 5) arr.push(hw.id)
    lastHwByClass.set(hw.class_id, arr)
  }
  const hwToClass = new Map(homeworks.map(h => [h.id, h.class_id]))

  const hwMissMap = new Map<string, number>()
  for (const sub of submissions) {
    const cid = hwToClass.get(sub.homework_id)
    if (!cid) continue
    if (!lastHwByClass.get(cid)?.includes(sub.homework_id)) continue
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
    if (hwMisses >= 1) reasons.push(`Son 5 ödevde ${hwMisses} eksik`)
    if (absences >= 1) reasons.push(`Son 14 günde ${absences} gün devamsız`)

    alerts.push({
      studentId: student.id,
      studentName: student.full_name,
      classId: student.class_id,
      className: student.classes?.name ?? '—',
      riskLevel: computeRiskLevel(hwMisses, absences),
      reasons,
      hwMisses,
      absences,
    })
  }

  const order = { high: 0, medium: 1, low: 2 } as const
  return alerts.sort((a, b) => order[a.riskLevel] - order[b.riskLevel])
}

export const TeacherDashboardService = {
  async getDashboardMetrics(teacherId: string): Promise<DashboardMetrics> {
    const today = new Date().toISOString().split('T')[0]
    const twoWeeksAgo = subDays(new Date(), 14).toISOString().split('T')[0]
    const weekStart = getWeekStart()

    const { data: hwData } = await DashboardRepository.getTeacherHomeworks(teacherId)
    const homeworks = (hwData ?? []) as unknown as HwRow[]
    const hwIds = homeworks.map(h => h.id)
    const classIds = [...new Set(homeworks.map(h => h.class_id))]

    const [subsResult, attResult, studentsResult, weeklyResult, weeklyRiskCount] = await Promise.all([
      DashboardRepository.getSubmissions(hwIds),
      DashboardRepository.getAttendanceRows(classIds, teacherId, twoWeeksAgo),
      DashboardRepository.getStudentsByClasses(classIds),
      DashboardRepository.getWeeklySubmissionStats(hwIds, weekStart),
      DashboardRepository.getWeeklyRiskCount(teacherId, weekStart),
    ])

    const submissions = ((subsResult.data ?? []) as unknown) as SubmissionRow[]
    const attendanceRows = ((attResult.data ?? []) as unknown) as { student_id: string; status: string }[]
    const students = ((studentsResult.data ?? []) as unknown) as StudentRow[]
    const weeklySubmissions = ((weeklyResult.data ?? []) as unknown) as SubmissionRow[]

    const todayHomeworkCount = homeworks.filter(h => h.due_date === today).length
    const totalMissingCount = submissions.filter(s => s.status === 'eksik').length

    const alerts = computeAlerts(homeworks, submissions, attendanceRows, students)
    const activeRiskCount = alerts.filter(a => a.riskLevel !== 'low').length

    const weeklyDoneCount = weeklySubmissions.filter(s => s.status === 'yapildi').length
    const avgCompletionPct = weeklySubmissions.length > 0
      ? Math.round((weeklyDoneCount / weeklySubmissions.length) * 100)
      : 0

    return {
      todayHomeworkCount,
      totalMissingCount,
      activeRiskCount,
      weekly: {
        submittedCount: weeklyDoneCount,
        avgCompletionPct,
        newRiskCount: weeklyRiskCount,
      },
      homeworks: homeworks as unknown as HomeworkLite[],
    }
  },

  async getRiskAlerts(teacherId: string): Promise<RiskAlert[]> {
    const profile = await getCurrentProfile()
    const schoolId = profile?.school_id ?? ''
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

    const submissions = ((subsResult.data ?? []) as unknown) as SubmissionRow[]
    const attendanceRows = ((attResult.data ?? []) as unknown) as { student_id: string; status: string }[]
    const students = ((studentsResult.data ?? []) as unknown) as StudentRow[]

    const alerts = computeAlerts(homeworks, submissions, attendanceRows, students)

    if (alerts.length > 0 && schoolId) {
      await DashboardRepository.insertRiskSnapshots(
        alerts.map(a => ({
          student_id: a.studentId,
          school_id: schoolId,
          teacher_id: teacherId,
          risk_level: a.riskLevel,
          risk_score: computeRiskScore(a.hwMisses, a.absences),
          hw_misses: a.hwMisses,
          absences: a.absences,
        }))
      )
    }

    return alerts
  },

  async getClassSummary(classId: string, teacherId: string): Promise<ClassSummary | null> {
    const twoWeeksAgo = subDays(new Date(), 14).toISOString().split('T')[0]

    const [subsResult, studentsResult, attResult] = await Promise.all([
      DashboardRepository.getClassSubmissions(classId, teacherId),
      DashboardRepository.getStudentsByClasses([classId]),
      DashboardRepository.getAttendanceRows([classId], teacherId, twoWeeksAgo),
    ])

    const submissions = ((subsResult.data ?? []) as unknown) as SubmissionRow[]
    const students = ((studentsResult.data ?? []) as unknown) as StudentRow[]
    const attendanceRows = ((attResult.data ?? []) as unknown) as { student_id: string; status: string }[]

    if (students.length === 0) return null

    const doneCount = submissions.filter(s => s.status === 'yapildi').length
    const avgCompletionPct = submissions.length > 0
      ? Math.round((doneCount / submissions.length) * 100)
      : 0
    const totalMissingCount = submissions.filter(s => s.status === 'eksik').length

    const fakeHomeworks = [...new Set(submissions.map(s => s.homework_id))].map(id => ({
      id, title: '', subject: '', due_date: '', class_id: classId, classes: null,
    }))

    const alerts = computeAlerts(fakeHomeworks, submissions, attendanceRows, students)
    const riskyStudents = alerts.filter(a => a.riskLevel !== 'low')
    const highRiskCount = alerts.filter(a => a.riskLevel === 'high').length

    return { avgCompletionPct, highRiskCount, totalMissingCount, riskyStudents }
  },

  async logActivity(teacherId: string, action: string, meta?: object): Promise<void> {
    try {
      const profile = await getCurrentProfile()
      const schoolId = profile?.school_id ?? ''
      if (!schoolId) return
      await DashboardRepository.insertActivityLog({ teacher_id: teacherId, school_id: schoolId, action, meta })
    } catch {
      // fire-and-forget — hata dashboard'u bloke etmez
    }
  },
}
```

- [ ] **Adım 4: Testleri çalıştır — PASS bekleniyor**

```bash
npx vitest run tests/vitest/unit/dashboard/service.test.ts
```
Beklenen: `7 tests passed`

- [ ] **Adım 5: Commit**

```bash
git add src/domains/dashboard/ tests/vitest/unit/dashboard/
git commit -m "feat(dashboard): TeacherDashboardService + DashboardRepository"
```

---

## Task 4: DB Migrations

**Files:**
- Create: `supabase/migrations/20260526000000_teacher_activity_log.sql`
- Create: `supabase/migrations/20260526000001_student_risk_history.sql`

- [ ] **Adım 1: teacher_activity_log migration yaz**

```sql
-- supabase/migrations/20260526000000_teacher_activity_log.sql
CREATE TABLE teacher_activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id   uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  action      text NOT NULL,
  meta        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON teacher_activity_log (teacher_id, created_at DESC);

ALTER TABLE teacher_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_activity_log_own_read" ON teacher_activity_log
  FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "teacher_activity_log_own_insert" ON teacher_activity_log
  FOR INSERT WITH CHECK (teacher_id = auth.uid());
```

- [ ] **Adım 2: student_risk_history migration yaz**

```sql
-- supabase/migrations/20260526000001_student_risk_history.sql
CREATE TABLE student_risk_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id    uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  risk_level   text NOT NULL CHECK (risk_level IN ('high', 'medium', 'low')),
  risk_score   smallint NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  hw_misses    smallint NOT NULL DEFAULT 0,
  absences     smallint NOT NULL DEFAULT 0,
  snapshot_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON student_risk_history (student_id, snapshot_at DESC);
CREATE INDEX ON student_risk_history (teacher_id, snapshot_at DESC);

ALTER TABLE student_risk_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_risk_history_teacher_read" ON student_risk_history
  FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "student_risk_history_teacher_insert" ON student_risk_history
  FOR INSERT WITH CHECK (teacher_id = auth.uid());
```

- [ ] **Adım 3: Migration'ları Supabase'e uygula (Supabase MCP tool ile)**

`mcp__plugin_supabase_supabase__apply_migration` tool'unu kullan:
- Migration 1: `20260526000000_teacher_activity_log.sql` içeriğini uygula
- Migration 2: `20260526000001_student_risk_history.sql` içeriğini uygula

- [ ] **Adım 4: Commit**

```bash
git add supabase/migrations/20260526000000_teacher_activity_log.sql supabase/migrations/20260526000001_student_risk_history.sql
git commit -m "feat(db): teacher_activity_log ve student_risk_history tabloları"
```

---

## Task 5: Dashboard UI Refactor

**Files:**
- Modify: `app/(dashboard)/anasayfa/OgretmenDashboard.tsx`
- Modify: `app/(dashboard)/anasayfa/RiskUyarilariWidget.tsx`
- Delete: `app/(dashboard)/anasayfa/SubmissionsPanel.tsx`

- [ ] **Adım 1: OgretmenDashboard.tsx'i yeniden yaz**

```tsx
// app/(dashboard)/anasayfa/OgretmenDashboard.tsx
import { Suspense } from 'react'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { addDays, format, parseISO } from '@/src/shared/date'
import CalendarWidget from './CalendarWidget'
import RiskUyarilariWidget from './RiskUyarilariWidget'
import { TeacherDashboardService } from '@/src/domains/dashboard/services/TeacherDashboardService'

type Tone = 'blue' | 'orange' | 'rose'
const TONE: Record<Tone, string> = {
  blue:   'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
  orange: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800',
  rose:   'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800',
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  return (
    <div className={`border rounded-xl p-4 ${TONE[tone]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs mt-1 opacity-90">{label}</p>
    </div>
  )
}

function RiskSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3 animate-pulse">
      <div className="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
      {[0, 1, 2].map(i => <div key={i} className="h-12 bg-gray-100 dark:bg-slate-700/50 rounded-lg" />)}
    </div>
  )
}

export default async function OgretmenDashboard() {
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile) redirect('/login')

  const metrics = await TeacherDashboardService.getDashboardMetrics(user.id)

  // fire-and-forget: hata dashboard'u bloke etmez
  void TeacherDashboardService.logActivity(user.id, 'dashboard_view').catch(() => {})

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const next7Str = addDays(today, 7).toISOString().split('T')[0]

  const todayHws = metrics.homeworks.filter(h => h.due_date === todayStr)
  const upcomingHws = metrics.homeworks
    .filter(h => h.due_date > todayStr && h.due_date <= next7Str)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Anasayfa</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Merhaba {profile.full_name ?? ''} · hızlı özet aşağıda.
        </p>
      </div>

      {/* 3 Ana Kart */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <SummaryCard label="Bugünkü ödev"   value={metrics.todayHomeworkCount} tone="blue" />
        <SummaryCard label="Toplam eksik"   value={metrics.totalMissingCount}  tone="orange" />
        <SummaryCard label="Aktif risk"     value={metrics.activeRiskCount}    tone="rose" />
      </div>

      {/* Haftalık Özet Şeridi */}
      <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Bu Hafta</span>
        <div className="flex gap-6">
          <div className="text-center">
            <p className="text-sm font-bold text-gray-800 dark:text-slate-200">{metrics.weekly.submittedCount}</p>
            <p className="text-[10px] text-gray-400">Teslim edilen</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-800 dark:text-slate-200">%{metrics.weekly.avgCompletionPct}</p>
            <p className="text-[10px] text-gray-400">Ort. tamamlanma</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-rose-600">{metrics.weekly.newRiskCount}</p>
            <p className="text-[10px] text-gray-400">Yeni risk</p>
          </div>
        </div>
      </div>

      {/* Alt Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 space-y-4">
          {/* Bugün ve Yaklaşan */}
          <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
            <header className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Bugün ve Yaklaşan</h2>
              <Link href="/odevler" className="text-xs text-blue-600 font-medium hover:underline">Tümü →</Link>
            </header>
            {todayHws.length + upcomingHws.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">
                Bugün veya önümüzdeki 7 gün için ödev yok.
              </p>
            ) : (
              <ul className="space-y-2">
                {[
                  ...todayHws.map(h => ({ ...h, isToday: true })),
                  ...upcomingHws.map(h => ({ ...h, isToday: false })),
                ].map(hw => (
                  <li key={hw.id}>
                    <Link
                      href={`/odevler/${hw.id}`}
                      className="block rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{hw.title}</span>
                        {hw.isToday && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">BUGÜN</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                        {hw.classes?.name ?? '—'} · {hw.subject} ·{' '}
                        {(() => {
                          try { return format(parseISO(hw.due_date), 'd MMM') }
                          catch { return hw.due_date }
                        })()}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Risk Uyarıları */}
          <Suspense fallback={<RiskSkeleton />}>
            <RiskUyarilariWidget />
          </Suspense>
        </section>

        {/* Takvim */}
        <div className="space-y-4">
          <CalendarWidget homeworks={metrics.homeworks} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Adım 2: RiskUyarilariWidget.tsx'i service kullanacak şekilde güncelle**

`RiskUyarilariWidget.tsx` dosyasının tamamını aşağıdaki ile değiştir:

```tsx
// app/(dashboard)/anasayfa/RiskUyarilariWidget.tsx
import Link from 'next/link'
import { getCurrentUser } from '@/src/shared/auth'
import { TeacherDashboardService } from '@/src/domains/dashboard/services/TeacherDashboardService'
import type { RiskAlert } from '@/src/domains/dashboard/types'

type RiskLevel = RiskAlert['riskLevel']

function RiskBadge({ level }: { level: RiskLevel }) {
  const config = {
    high: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-400',
      label: 'Yüksek Risk',
    },
    medium: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-400',
      label: 'Orta Risk',
    },
    low: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-400',
      label: 'Dikkat',
    },
  }
  const { bg, text, label } = config[level]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${bg} ${text}`}>
      {label}
    </span>
  )
}

export default async function RiskUyarilariWidget() {
  const user = await getCurrentUser()
  if (!user) return null

  const alerts = await TeacherDashboardService.getRiskAlerts(user.id)
  const displayed = alerts.slice(0, 5)
  const highCount = alerts.filter(a => a.riskLevel === 'high').length

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Risk Uyarıları</h2>
          {highCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
              {highCount} yüksek risk
            </span>
          )}
        </div>
        {alerts.length > 5 && (
          <span className="text-xs text-gray-400">{alerts.length} öğrenci</span>
        )}
      </header>

      {displayed.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-6">
          Riskli öğrenci yok. Her şey yolunda!
        </p>
      ) : (
        <ul className="space-y-2">
          {displayed.map(alert => (
            <li key={alert.studentId}>
              <Link
                href={`/siniflar/${alert.classId}/ogrenciler/${alert.studentId}`}
                className="flex items-start gap-2 p-2 rounded-lg border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                      {alert.studentName}
                    </span>
                    <RiskBadge level={alert.riskLevel} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    {alert.className} · {alert.reasons.join(' · ')}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Adım 3: SubmissionsPanel.tsx'i sil**

```bash
rm "app/(dashboard)/anasayfa/SubmissionsPanel.tsx"
```

- [ ] **Adım 4: Commit**

```bash
git add "app/(dashboard)/anasayfa/OgretmenDashboard.tsx" "app/(dashboard)/anasayfa/RiskUyarilariWidget.tsx"
git rm "app/(dashboard)/anasayfa/SubmissionsPanel.tsx"
git commit -m "feat(dashboard): yeni layout (3 kart + haftalık şerit) ve service entegrasyonu"
```

---

## Task 6: PerformansWidget (Sınıf Detay)

**Files:**
- Create: `app/(dashboard)/siniflar/[id]/PerformansWidget.tsx`
- Modify: `app/(dashboard)/siniflar/[id]/page.tsx`

- [ ] **Adım 1: PerformansWidget.tsx oluştur**

```tsx
// app/(dashboard)/siniflar/[id]/PerformansWidget.tsx
import { getCurrentUser } from '@/src/shared/auth'
import { TeacherDashboardService } from '@/src/domains/dashboard/services/TeacherDashboardService'
import type { RiskAlert } from '@/src/domains/dashboard/types'
import Link from 'next/link'

type RiskLevel = RiskAlert['riskLevel']

function RiskBadge({ level }: { level: RiskLevel }) {
  const config = {
    high:   { bg: 'bg-red-100 dark:bg-red-900/30',    text: 'text-red-700 dark:text-red-400',    label: 'Yüksek Risk' },
    medium: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Orta Risk'   },
    low:    { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-400',   label: 'Dikkat'      },
  }
  const { bg, text, label } = config[level]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${bg} ${text}`}>
      {label}
    </span>
  )
}

export default async function PerformansWidget({ classId }: { classId: string }) {
  const user = await getCurrentUser()
  if (!user) return null

  const summary = await TeacherDashboardService.getClassSummary(classId, user.id)
  if (!summary || summary.riskyStudents.length === 0 && summary.highRiskCount === 0) return null

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 mb-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">Sınıf Performansı</h2>

      {/* 3 Metrik */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">%{summary.avgCompletionPct}</p>
          <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">Ort. tamamlanma</p>
        </div>
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">{summary.highRiskCount}</p>
          <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">Yüksek risk</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{summary.totalMissingCount}</p>
          <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-1">Toplam eksik</p>
        </div>
      </div>

      {/* Riskli Öğrenciler */}
      {summary.riskyStudents.length > 0 && (
        <>
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-3">
            ⚠ Dikkat Gerektiren Öğrenciler
          </p>
          <ul className="space-y-2">
            {summary.riskyStudents.map(alert => (
              <li key={alert.studentId}>
                <Link
                  href={`/siniflar/${classId}/ogrenciler/${alert.studentId}`}
                  className="block border border-gray-200 dark:border-slate-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                      {alert.studentName}
                    </span>
                    <RiskBadge level={alert.riskLevel} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {alert.reasons.join(' · ')}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
```

- [ ] **Adım 2: page.tsx'e PerformansWidget ekle**

`app/(dashboard)/siniflar/[id]/page.tsx` dosyasında şu değişikliği yap:

`import OgrenciListesi from './OgrenciListesi'` satırının altına ekle:
```tsx
import { Suspense } from 'react'
import PerformansWidget from './PerformansWidget'
```

`return` içindeki `{students.length === 0 ? (` bloğunun hemen üstüne ekle:
```tsx
<Suspense fallback={null}>
  <PerformansWidget classId={id} />
</Suspense>
```

- [ ] **Adım 3: Commit**

```bash
git add "app/(dashboard)/siniflar/[id]/PerformansWidget.tsx" "app/(dashboard)/siniflar/[id]/page.tsx"
git commit -m "feat(siniflar): sınıf detay sayfasına performans widget'ı eklendi"
```

---

## Task 7: Tüm Testleri Çalıştır

- [ ] **Adım 1: Tüm unit testleri çalıştır**

```bash
npx vitest run --project unit
```
Beklenen: Tüm testler PASS (önceki 70+ test + yeni dashboard testleri)

- [ ] **Adım 2: Tür kontrolü yap**

```bash
npx tsc --noEmit
```
Beklenen: Hata yok

- [ ] **Adım 3: Dev sunucuyu çalıştır ve manuel kontrol et**

```bash
npm run dev
```
Kontrol et:
- `http://localhost:3000/anasayfa` → 3 kart + haftalık şerit görünüyor
- `http://localhost:3000/siniflar/[herhangi-bir-id]` → PerformansWidget görünüyor (veri varsa)
- RiskUyarilariWidget çalışıyor

- [ ] **Adım 4: Final commit**

```bash
git add -A
git commit -m "chore(dashboard): Sprint 1 tamamlandı — TeacherDashboardService, DB tabloları, UI refactor"
```
