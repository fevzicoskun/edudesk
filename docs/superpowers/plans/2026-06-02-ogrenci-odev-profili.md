# Öğrenci Ödev Profili Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Her öğrenci için dönem boyunca atanan tüm ödevlerin durumunu gösteren bir modal dialog — StatusBoard'dan ve öğrenci yönetim sayfasından erişilebilir.

**Architecture:** Server action lazy-fetch: modal açılınca `getStudentHomeworkProfile(studentId, classId)` çağrılır. Stats hesabı saf fonksiyon olarak ayrılmıştır (test kolaylığı). Modal state parent component'te tutulur.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest (unit), Supabase SSR

---

## Dosya Haritası

| Dosya | İşlem | Ne yapıyor |
|-------|-------|-----------|
| `src/domains/homework/lib/stats.ts` | Yeni | `computeStudentHomeworkStats` pure function |
| `src/domains/homework/repositories/HomeworkRepository.ts` | Değiştir | `findStudentHomeworkProfile` metodu eklenir |
| `src/domains/homework/services/HomeworkService.ts` | Değiştir | `getStudentHomeworkProfile` metodu eklenir |
| `app/actions/homework.ts` | Değiştir | `getStudentHomeworkProfile` server action eklenir |
| `app/(dashboard)/odevler/[id]/StudentHomeworkProfileModal.tsx` | Yeni | Modal client bileşeni |
| `app/(dashboard)/odevler/[id]/StatusBoard.tsx` | Değiştir | `classId` prop + öğrenci adına tıklanabilirlik |
| `app/(dashboard)/odevler/[id]/page.tsx` | Değiştir | `classId` prop'u StatusBoard'a iletilir |
| `app/(dashboard)/yonetim/ogrenciler/OgrencilerClient.tsx` | Değiştir | "Ödev Sicili" butonu + modal |
| `tests/vitest/unit/homework/student-profile-stats.test.ts` | Yeni | Stats pure function unit testleri |
| `tests/vitest/unit/homework/homework-service.test.ts` | Değiştir | `getStudentHomeworkProfile` service testleri eklenir |

---

## Task 1: Stats Pure Function + Unit Testleri

**Files:**
- Create: `src/domains/homework/lib/stats.ts`
- Create: `tests/vitest/unit/homework/student-profile-stats.test.ts`

- [ ] **Step 1.1: Failing testi yaz**

```ts
// tests/vitest/unit/homework/student-profile-stats.test.ts
import { describe, it, expect } from 'vitest'
import { computeStudentHomeworkStats } from '@/src/domains/homework/lib/stats'
import type { SubmissionStatus } from '@/src/shared/types'

type Record = { id: string; title: string; subject: string; due_date: string; status: SubmissionStatus; note: string | null }

const hw = (id: string, status: SubmissionStatus): Record =>
  ({ id, title: `Ödev ${id}`, subject: 'Mat', due_date: '2026-06-01', status, note: null })

describe('computeStudentHomeworkStats()', () => {
  it('boş liste → sıfır istatistik, rate=0', () => {
    const s = computeStudentHomeworkStats([])
    expect(s).toEqual({ total: 0, yapildi: 0, eksik: 0, yapilmadi: 0, gec: 0, mazeretli: 0, completionRate: 0 })
  })

  it('tüm yapıldı → rate=100', () => {
    const s = computeStudentHomeworkStats([hw('1','yapildi'), hw('2','yapildi')])
    expect(s.completionRate).toBe(100)
    expect(s.yapildi).toBe(2)
  })

  it('mazeretli hariç tutulur: 2 yapıldı + 1 mazeretli → rate=100', () => {
    const s = computeStudentHomeworkStats([hw('1','yapildi'), hw('2','yapildi'), hw('3','mazeretli')])
    expect(s.completionRate).toBe(100)
    expect(s.total).toBe(3)
    expect(s.mazeretli).toBe(1)
  })

  it('tümü mazeretli → eligible=0 → rate=0', () => {
    const s = computeStudentHomeworkStats([hw('1','mazeretli'), hw('2','mazeretli')])
    expect(s.completionRate).toBe(0)
  })

  it('3 yapıldı / 4 eligible → rate=75', () => {
    const list = [hw('1','yapildi'), hw('2','yapildi'), hw('3','yapildi'), hw('4','yapilmadi')]
    const s = computeStudentHomeworkStats(list)
    expect(s.completionRate).toBe(75)
  })

  it('karışık durumlar — sayılar doğru', () => {
    const list = [
      hw('1','yapildi'), hw('2','eksik'), hw('3','yapilmadi'),
      hw('4','gec'), hw('5','mazeretli'),
    ]
    const s = computeStudentHomeworkStats(list)
    expect(s).toMatchObject({ total: 5, yapildi: 1, eksik: 1, yapilmadi: 1, gec: 1, mazeretli: 1 })
  })
})
```

- [ ] **Step 1.2: Testin başarısız olduğunu doğrula**

```
npx vitest run tests/vitest/unit/homework/student-profile-stats.test.ts
```
Beklenen: FAIL — "Cannot find module '@/src/domains/homework/lib/stats'"

- [ ] **Step 1.3: Pure function'ı implement et**

```ts
// src/domains/homework/lib/stats.ts
import type { SubmissionStatus } from '@/src/shared/types'

export type HomeworkRecord = {
  id: string
  title: string
  subject: string
  due_date: string
  status: SubmissionStatus
  note: string | null
}

export type StudentHomeworkStats = {
  total: number
  yapildi: number
  eksik: number
  yapilmadi: number
  gec: number
  mazeretli: number
  completionRate: number
}

export function computeStudentHomeworkStats(homeworks: HomeworkRecord[]): StudentHomeworkStats {
  const counts = { yapildi: 0, eksik: 0, yapilmadi: 0, gec: 0, mazeretli: 0 }
  for (const hw of homeworks) {
    counts[hw.status]++
  }
  const eligible = homeworks.length - counts.mazeretli
  const completionRate = eligible === 0 ? 0 : Math.round((counts.yapildi / eligible) * 100)
  return { total: homeworks.length, ...counts, completionRate }
}
```

- [ ] **Step 1.4: Testlerin geçtiğini doğrula**

```
npx vitest run tests/vitest/unit/homework/student-profile-stats.test.ts
```
Beklenen: 6/6 PASS

- [ ] **Step 1.5: Commit**

```
git add src/domains/homework/lib/stats.ts tests/vitest/unit/homework/student-profile-stats.test.ts
git commit -m "feat(homework): computeStudentHomeworkStats pure function + unit testleri"
```

---

## Task 2: Repository Metodu

**Files:**
- Modify: `src/domains/homework/repositories/HomeworkRepository.ts`

- [ ] **Step 2.1: `findStudentHomeworkProfile` metodunu repository'ye ekle**

`HomeworkRepository` nesnesinin sonuna (son metodun kapanış `,`'sundan sonra) şunu ekle:

```ts
  async findStudentHomeworkProfile(studentId: string, classId: string, schoolId: string) {
    const supabase = await createClient()
    const [studentRes, homeworksRes] = await Promise.all([
      supabase
        .from('students')
        .select('full_name, student_number, veli_ad, veli_telefon')
        .eq('id', studentId)
        .eq('school_id', schoolId)
        .single(),
      supabase
        .from('homeworks')
        .select('id, title, subject, due_date')
        .eq('class_id', classId)
        .eq('school_id', schoolId)
        .eq('is_template', false)
        .is('deleted_at', null)
        .order('due_date', { ascending: false }),
    ])

    const homeworkIds = (homeworksRes.data ?? []).map(h => h.id)
    const subsRes = homeworkIds.length > 0
      ? await supabase
          .from('homework_submissions')
          .select('homework_id, status, note')
          .in('homework_id', homeworkIds)
          .eq('student_id', studentId)
      : { data: [] as { homework_id: string; status: string; note: string | null }[] }

    return {
      student: studentRes.data as { full_name: string; student_number: string | null; veli_ad: string | null; veli_telefon: string | null } | null,
      homeworks: homeworksRes.data ?? [],
      submissions: subsRes.data ?? [],
    }
  },
```

- [ ] **Step 2.2: TypeScript derleme kontrolü**

```
npx tsc --noEmit
```
Beklenen: 0 hata.

- [ ] **Step 2.3: Commit**

```
git add src/domains/homework/repositories/HomeworkRepository.ts
git commit -m "feat(homework): HomeworkRepository.findStudentHomeworkProfile eklendi"
```

---

## Task 3: Service Metodu + Unit Testleri

**Files:**
- Modify: `src/domains/homework/services/HomeworkService.ts`
- Modify: `tests/vitest/unit/homework/homework-service.test.ts`

- [ ] **Step 3.1: Mevcut test dosyasındaki `vi.mock` bloğuna yeni metodu ekle**

`homework-service.test.ts`'de `HomeworkRepository` mock'una `findStudentHomeworkProfile: vi.fn()` ekle:

```ts
vi.mock('@/src/domains/homework/repositories/HomeworkRepository', () => ({
  HomeworkRepository: {
    insertHomework:                vi.fn(),
    findHomeworkTeacher:           vi.fn(),
    upsertSubmissionStatus:        vi.fn(),
    upsertSubmissionsStatus:       vi.fn(),
    upsertSubmissionNote:          vi.fn(),
    softDeleteHomework:            vi.fn(),
    softDeleteHomeworkAsManager:   vi.fn(),
    restoreHomework:               vi.fn(),
    findStudentHomeworkProfile:    vi.fn(),  // ← ekle
  },
}))
```

- [ ] **Step 3.2: `getStudentHomeworkProfile` için failing testleri yaz**

Dosyanın sonuna ekle:

```ts
// ─────────────────────────────────────────────────────────────
describe('HomeworkService.getStudentHomeworkProfile()', () => {
  const STU_ID = 'student-1'
  const CLS_ID = 'class-1'

  it('giriş yapılmamış → { error: "Giriş gerekli" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const result = await HomeworkService.getStudentHomeworkProfile(STU_ID, CLS_ID)
    expect(result).toMatchObject({ error: 'Giriş gerekli' })
  })

  it('homework:read izni yoksa hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    const result = await HomeworkService.getStudentHomeworkProfile(STU_ID, CLS_ID)
    expect(result).toMatchObject({ error: 'Bu işlem için yetkiniz yok.' })
  })

  it('öğrenci bulunamazsa hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findStudentHomeworkProfile).mockResolvedValue({
      student: null, homeworks: [], submissions: [],
    } as never)
    const result = await HomeworkService.getStudentHomeworkProfile(STU_ID, CLS_ID)
    expect(result).toMatchObject({ error: 'Öğrenci bulunamadı' })
  })

  it('ödev yoksa boş liste + stats döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findStudentHomeworkProfile).mockResolvedValue({
      student: { full_name: 'Ayşe', student_number: '5', veli_ad: 'Anne', veli_telefon: '05001234567' },
      homeworks: [],
      submissions: [],
    } as never)
    const result = await HomeworkService.getStudentHomeworkProfile(STU_ID, CLS_ID)
    if ('error' in result) throw new Error(result.error)
    expect(result.homeworks).toHaveLength(0)
    expect(result.stats.total).toBe(0)
    expect(result.stats.completionRate).toBe(0)
  })

  it('submission yoksa tümü yapilmadi sayılır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findStudentHomeworkProfile).mockResolvedValue({
      student: { full_name: 'Ali', student_number: null, veli_ad: null, veli_telefon: null },
      homeworks: [
        { id: 'hw-1', title: 'Ödev A', subject: 'Matematik', due_date: '2026-05-01' },
        { id: 'hw-2', title: 'Ödev B', subject: 'Fen', due_date: '2026-05-10' },
      ],
      submissions: [],
    } as never)
    const result = await HomeworkService.getStudentHomeworkProfile(STU_ID, CLS_ID)
    if ('error' in result) throw new Error(result.error)
    expect(result.homeworks).toHaveLength(2)
    expect(result.homeworks.every(h => h.status === 'yapilmadi')).toBe(true)
    expect(result.stats.yapilmadi).toBe(2)
    expect(result.stats.completionRate).toBe(0)
  })

  it('submission varsa doğru statüsü kullanır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(HomeworkRepository.findStudentHomeworkProfile).mockResolvedValue({
      student: { full_name: 'Ali', student_number: null, veli_ad: null, veli_telefon: null },
      homeworks: [
        { id: 'hw-1', title: 'Ödev A', subject: 'Matematik', due_date: '2026-05-01' },
        { id: 'hw-2', title: 'Ödev B', subject: 'Fen', due_date: '2026-05-10' },
      ],
      submissions: [
        { homework_id: 'hw-1', status: 'yapildi', note: null },
        { homework_id: 'hw-2', status: 'eksik', note: 'Yarısı eksik' },
      ],
    } as never)
    const result = await HomeworkService.getStudentHomeworkProfile(STU_ID, CLS_ID)
    if ('error' in result) throw new Error(result.error)
    const hw1 = result.homeworks.find(h => h.id === 'hw-1')!
    const hw2 = result.homeworks.find(h => h.id === 'hw-2')!
    expect(hw1.status).toBe('yapildi')
    expect(hw2.status).toBe('eksik')
    expect(hw2.note).toBe('Yarısı eksik')
    expect(result.stats.yapildi).toBe(1)
    expect(result.stats.completionRate).toBe(50)
  })
})
```

- [ ] **Step 3.3: Testlerin başarısız olduğunu doğrula**

```
npx vitest run tests/vitest/unit/homework/homework-service.test.ts
```
Beklenen: "HomeworkService.getStudentHomeworkProfile is not a function" veya benzeri hata.

- [ ] **Step 3.4: Service metodunu implement et**

`HomeworkService.ts`'e şu import'ları ekle (dosyanın üstüne):

```ts
import { computeStudentHomeworkStats, type HomeworkRecord } from '@/src/domains/homework/lib/stats'
```

`HomeworkService` nesnesinin sonuna metodu ekle:

```ts
  async getStudentHomeworkProfile(
    studentId: string,
    classId: string,
  ): Promise<
    | { error: string }
    | { student: { full_name: string; student_number: string | null; veli_ad: string | null; veli_telefon: string | null }; homeworks: HomeworkRecord[]; stats: ReturnType<typeof computeStudentHomeworkStats> }
  > {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.HOMEWORK.READ)) return { error: 'Bu işlem için yetkiniz yok.' }

    const { student, homeworks, submissions } = await HomeworkRepository.findStudentHomeworkProfile(
      studentId, classId, ability.schoolId,
    )

    if (!student) return { error: 'Öğrenci bulunamadı' }

    const subMap = new Map(submissions.map(s => [s.homework_id, s]))
    const records: HomeworkRecord[] = homeworks.map(hw => {
      const sub = subMap.get(hw.id)
      return {
        id: hw.id,
        title: hw.title,
        subject: hw.subject,
        due_date: hw.due_date,
        status: ((sub?.status ?? 'yapilmadi') as HomeworkRecord['status']),
        note: sub?.note ?? null,
      }
    })

    return { student, homeworks: records, stats: computeStudentHomeworkStats(records) }
  },
```

- [ ] **Step 3.5: Testlerin geçtiğini doğrula**

```
npx vitest run tests/vitest/unit/homework/homework-service.test.ts
```
Beklenen: tüm testler PASS (mevcut + yeni 6 test dahil).

- [ ] **Step 3.6: Commit**

```
git add src/domains/homework/services/HomeworkService.ts tests/vitest/unit/homework/homework-service.test.ts
git commit -m "feat(homework): HomeworkService.getStudentHomeworkProfile + unit testleri"
```

---

## Task 4: Server Action

**Files:**
- Modify: `app/actions/homework.ts`

- [ ] **Step 4.1: Action'ı ekle**

`app/actions/homework.ts` dosyasındaki `export async function restoreHomework` bloğunun hemen altına ekle:

```ts
export async function getStudentHomeworkProfile(studentId: string, classId: string) {
  UUID.parse(studentId)
  UUID.parse(classId)
  return HomeworkService.getStudentHomeworkProfile(studentId, classId)
}
```

- [ ] **Step 4.2: TypeScript derleme kontrolü**

```
npx tsc --noEmit
```
Beklenen: 0 hata.

- [ ] **Step 4.3: Commit**

```
git add app/actions/homework.ts
git commit -m "feat(homework): getStudentHomeworkProfile server action eklendi"
```

---

## Task 5: Modal Bileşeni

**Files:**
- Create: `app/(dashboard)/odevler/[id]/StudentHomeworkProfileModal.tsx`

- [ ] **Step 5.1: Modal bileşenini yaz**

```tsx
// app/(dashboard)/odevler/[id]/StudentHomeworkProfileModal.tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { getStudentHomeworkProfile } from '@/src/domains/homework/actions'

type ProfileData = Awaited<ReturnType<typeof getStudentHomeworkProfile>>

const STATUS_LABEL: Record<string, string> = {
  yapildi: 'Yapıldı', eksik: 'Eksik', yapilmadi: 'Yapılmadı',
  gec: 'Geç', mazeretli: 'Mazeretli',
}
const STATUS_COLOR: Record<string, string> = {
  yapildi:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  eksik:     'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  yapilmadi: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  gec:       'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  mazeretli: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
}

function makeWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^0/, '')
  return `https://wa.me/90${digits}`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

export default function StudentHomeworkProfileModal({
  studentId,
  classId,
  onClose,
}: {
  studentId: string | null
  classId: string
  onClose: () => void
}) {
  const [data, setData] = useState<ProfileData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!studentId) { setData(null); setError(null); return }
    setData(null)
    setError(null)
    startTransition(async () => {
      const result = await getStudentHomeworkProfile(studentId, classId)
      if ('error' in result) setError(result.error)
      else setData(result)
    })
  }, [studentId, classId])

  if (!studentId) return null

  const profile = data && !('error' in data) ? data : null
  const stats = profile?.stats

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">

        {/* Başlık */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-slate-700">
          <div className="min-w-0">
            {profile ? (
              <>
                <p className="font-semibold text-gray-900 dark:text-slate-100 text-base leading-tight">
                  {profile.student.full_name}
                  {profile.student.student_number && (
                    <span className="ml-2 text-xs font-normal text-gray-400 dark:text-slate-500">
                      No: {profile.student.student_number}
                    </span>
                  )}
                </p>
                {(profile.student.veli_ad || profile.student.veli_telefon) && (
                  <div className="flex items-center gap-2 mt-1">
                    {profile.student.veli_ad && (
                      <span className="text-xs text-gray-500 dark:text-slate-400">
                        Veli: {profile.student.veli_ad}
                      </span>
                    )}
                    {profile.student.veli_telefon && (
                      <a
                        href={makeWhatsAppUrl(profile.student.veli_telefon)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        WhatsApp
                      </a>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="h-5 w-32 bg-gray-100 dark:bg-slate-700 rounded animate-pulse" />
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* İçerik */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {isPending && !profile && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {[0,1,2,3].map(i => (
                  <div key={i} className="h-14 bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                ))}
              </div>
              {[0,1,2,3].map(i => (
                <div key={i} className="h-10 bg-gray-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center py-4">{error}</p>
          )}

          {stats && (
            <>
              {/* İstatistik kartları */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Toplam', value: stats.total, cls: 'text-gray-700 dark:text-slate-300' },
                  { label: 'Yapıldı', value: stats.yapildi, cls: 'text-green-600 dark:text-green-400' },
                  { label: 'Eksik/Yok', value: stats.eksik + stats.yapilmadi + stats.gec, cls: 'text-red-600 dark:text-red-400' },
                  { label: 'Mazeretli', value: stats.mazeretli, cls: 'text-slate-500 dark:text-slate-400' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 text-center border border-gray-100 dark:border-slate-700">
                    <p className={`text-2xl font-bold leading-none ${cls}`}>{value}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{label}</p>
                  </div>
                ))}
              </div>

              {/* Tamamlanma oranı */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 dark:text-slate-400">Tamamlanma oranı</span>
                  <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">%{stats.completionRate}</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${stats.completionRate}%` }}
                  />
                </div>
              </div>

              {/* Ödev listesi */}
              {profile.homeworks.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">
                  Bu sınıfa henüz ödev atanmamış.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Tüm dönem ödevleri
                  </p>
                  {profile.homeworks.map(hw => (
                    <div
                      key={hw.id}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[hw.status]}`}>
                        {STATUS_LABEL[hw.status]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-slate-200 truncate">{hw.title}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{hw.subject}</p>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">
                        {formatDate(hw.due_date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5.2: TypeScript derleme kontrolü**

```
npx tsc --noEmit
```
Beklenen: 0 hata.

- [ ] **Step 5.3: Commit**

```
git add "app/(dashboard)/odevler/[id]/StudentHomeworkProfileModal.tsx"
git commit -m "feat(homework): StudentHomeworkProfileModal bileşeni eklendi"
```

---

## Task 6: StatusBoard'a Bağla

**Files:**
- Modify: `app/(dashboard)/odevler/[id]/StatusBoard.tsx`
- Modify: `app/(dashboard)/odevler/[id]/page.tsx`

- [ ] **Step 6.1: StatusBoard'a `classId` prop ekle ve import ekle**

`StatusBoard.tsx` dosyasının en üstüne (mevcut import'ların altına) ekle:

```ts
import StudentHomeworkProfileModal from './StudentHomeworkProfileModal'
```

`StatusBoard` component props tipini genişlet:

```ts
export default function StatusBoard({
  homeworkId,
  items,
  homeworkTitle,
  totalHomeworks,
  initialRecordCount,
  classId,                         // ← ekle
}: {
  homeworkId: string
  items: StatusItem[]
  homeworkTitle?: string
  totalHomeworks: number
  initialRecordCount: number
  classId: string                  // ← ekle
}) {
```

- [ ] **Step 6.2: State ekle ve öğrenci adını tıklanabilir yap**

`StatusBoard` fonksiyon gövdesindeki state tanımlarının altına ekle:

```ts
const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
```

Öğrenci adını (şu an bir `<p>` etiketi) bir `<button>`'a çevir. Mevcut:

```tsx
<p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{item.full_name}</p>
```

Yeni:

```tsx
<button
  onClick={() => setSelectedStudentId(item.student_id)}
  className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
>
  {item.full_name}
</button>
```

- [ ] **Step 6.3: Modal'ı StatusBoard return içine ekle**

`StatusBoard` return'ünün `<div>` kapanışından (`</div>`) hemen önce:

```tsx
      <StudentHomeworkProfileModal
        studentId={selectedStudentId}
        classId={classId}
        onClose={() => setSelectedStudentId(null)}
      />
```

- [ ] **Step 6.4: `page.tsx`'e `classId` prop'unu ilet**

`app/(dashboard)/odevler/[id]/page.tsx`'de `<StatusBoard .../>` çağrısına `classId={hw.class_id}` ekle:

```tsx
<StatusBoard
  homeworkId={id}
  items={items}
  homeworkTitle={hw.title}
  totalHomeworks={totalHomeworkCount}
  initialRecordCount={subs.length}
  classId={hw.class_id}
/>
```

- [ ] **Step 6.5: TypeScript derleme kontrolü**

```
npx tsc --noEmit
```
Beklenen: 0 hata.

- [ ] **Step 6.6: Commit**

```
git add "app/(dashboard)/odevler/[id]/StatusBoard.tsx" "app/(dashboard)/odevler/[id]/page.tsx"
git commit -m "feat(homework): StatusBoard'dan ogrenci odev profili modalı"
```

---

## Task 7: Öğrenci Yönetim Sayfasına Bağla

**Files:**
- Modify: `app/(dashboard)/yonetim/ogrenciler/OgrencilerClient.tsx`

- [ ] **Step 7.1: Import ve state ekle**

`OgrencilerClient.tsx` dosyasının üstüne import ekle:

```ts
import StudentHomeworkProfileModal from '@/app/(dashboard)/odevler/[id]/StudentHomeworkProfileModal'
```

`OgrencilerClient` fonksiyonu içindeki `const [query, setQuery] = useState('')` satırından sonra ekle:

```ts
const [selected, setSelected] = useState<{ studentId: string; classId: string } | null>(null)
```

- [ ] **Step 7.2: Öğrenci satırına "Ödev Sicili" butonu ekle**

Her `<li>` içindeki `<Link>` bileşeninin hemen altına (Link kapandıktan sonra) "Ödev Sicili" butonu ekle:

```tsx
<li key={s.id} className="flex items-center">
  <Link
    href={`/siniflar/${cls.id}/ogrenciler/${s.id}`}
    className="flex-1 flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
  >
    <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
        {s.full_name.charAt(0)}
      </span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{s.full_name}</p>
    </div>
    {s.student_number && (
      <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">#{s.student_number}</span>
    )}
    <svg className="w-4 h-4 text-gray-300 dark:text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  </Link>
  <button
    onClick={() => setSelected({ studentId: s.id, classId: cls.id })}
    className="shrink-0 px-3 py-2.5 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors border-l border-gray-100 dark:border-slate-800"
  >
    Ödev Sicili
  </button>
</li>
```

**Not:** Mevcut `<li>` üzerindeki `key={s.id}` kullanımı korunur; `<li>` artık `flex` container olur.

- [ ] **Step 7.3: Modal'ı bileşen return'üne ekle**

`OgrencilerClient` return'ünün son `</div>` kapanışından önce:

```tsx
      <StudentHomeworkProfileModal
        studentId={selected?.studentId ?? null}
        classId={selected?.classId ?? ''}
        onClose={() => setSelected(null)}
      />
```

- [ ] **Step 7.4: TypeScript derleme kontrolü**

```
npx tsc --noEmit
```
Beklenen: 0 hata.

- [ ] **Step 7.5: Tüm testleri çalıştır**

```
npx vitest run --project unit
```
Beklenen: tüm unit testler PASS.

- [ ] **Step 7.6: Commit**

```
git add "app/(dashboard)/yonetim/ogrenciler/OgrencilerClient.tsx"
git commit -m "feat(homework): ogrenci yonetim sayfasina odev sicili butonu eklendi"
```

---

## Self-Review

**Spec karşılaştırması:**
- ✅ Erişim noktaları: StatusBoard (Task 6) + öğrenci yönetim (Task 7)
- ✅ Modal dialog (Task 5)
- ✅ Ödev listesi tüm dönem (Task 2 repository, Task 3 service)
- ✅ Özet istatistikler (Task 1 stats, Task 5 UI)
- ✅ Veli bilgisi + WhatsApp linki (Task 5 modal başlığı)
- ✅ completionRate = yapildi / (total - mazeretli) (Task 1, test 3)
- ✅ WhatsApp telefon normalizasyonu (Task 5 `makeWhatsAppUrl`)
- ✅ RBAC school_id izolasyonu (Task 3 service)
- ✅ Unit testler (Task 1 + Task 3)
