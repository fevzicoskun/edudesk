# EduDesk Mevcut Özellik İyileştirme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 8 mevcut özelliği iyileştir: StatusBoard seçim modu, veli iletişim günlüğü, yoklama uyarısı, inline not ekleme, müdür öğretmen tablosu, takvim tamamlanma oranı, WeekLoadBanner sticky, print görünümü.

**Architecture:** Her özellik bağımsız; tek yeni DB tablosu (`parent_contact_logs`) vardır. Diğerleri mevcut tablo ve bileşenler üzerinde değişiklik. Task 1–5 veli günlüğünü oluşturur (sıralı); Task 6–13 bağımsız (paralel çalıştırılabilir).

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4, Supabase SSR, TypeScript, Vitest, Zod

---

## Dosya Haritası

**Yeni dosyalar:**
- `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/ParentContactLogSection.tsx`
- `app/(dashboard)/odevler/analitik/OgretmenKarsilastirma.tsx`

**Değiştirilen dosyalar:**
- `src/domains/classes/repositories/ClassRepository.ts` — 3 yeni method
- `src/domains/classes/services/ClassService.ts` — 2 yeni method
- `app/actions/classes.ts` — 2 yeni action + schema
- `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx` — ParentContactLogSection eklenir
- `app/(dashboard)/odevler/[id]/StatusBoard.tsx` — seçim modu state
- `app/(dashboard)/odevler/[id]/statusboard/StatusBoardToolbar.tsx` — seçim modu toggle
- `app/(dashboard)/odevler/[id]/statusboard/StudentRow.tsx` — checkbox props
- `app/(dashboard)/yoklama/page.tsx` — takenTodayIds sorgusu
- `app/(dashboard)/yoklama/YoklamaClient.tsx` — badge + banner
- `app/(dashboard)/siniflar/[id]/OgrenciListesi.tsx` — inline not paneli
- `src/domains/homework/lib/analitik.ts` — computeTeacherStats eklenir
- `app/(dashboard)/odevler/analitik/page.tsx` — OgretmenKarsilastirma eklenir
- `app/(dashboard)/odevler/takvim/page.tsx` — completion sorgusu
- `app/(dashboard)/odevler/takvim/HomeworkCalendar.tsx` — completionMap prop
- `app/(dashboard)/odevler/WeekLoadBanner.tsx` — sticky + pulse
- `app/(dashboard)/layout.tsx` — print:hidden Sidebar wrapper
- `app/(dashboard)/odevler/[id]/page.tsx` — print header

**Test dosyaları:**
- `tests/vitest/unit/homework/analitik-teacher.test.ts` — computeTeacherStats unit testler

---

## Task 1: DB Migration — parent_contact_logs

**Files:**
- Modify: `src/infrastructure/supabase/database.types.ts` (tip regenerasyonu)

- [ ] **Step 1: Migration'ı Supabase'e uygula**

Supabase MCP `apply_migration` tool ile şu SQL'i çalıştır:

```sql
CREATE TABLE IF NOT EXISTS parent_contact_logs (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id      UUID NOT NULL,
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note           TEXT NOT NULL,
  contact_method TEXT NOT NULL DEFAULT 'diger',
  contacted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pcl_student ON parent_contact_logs(student_id, contacted_at DESC);
ALTER TABLE parent_contact_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pcl_school_all" ON parent_contact_logs FOR ALL TO authenticated
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
```

- [ ] **Step 2: TypeScript tiplerini yenile**

Supabase MCP `generate_typescript_types` tool'u çalıştır (proje ID: `agijvfrcudpzsofgfogu`). Çıktıyı `src/infrastructure/supabase/database.types.ts` dosyasına yaz (mevcut dosyanın üzerine).

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/supabase/database.types.ts
git commit -m "feat: add parent_contact_logs table and regenerate types"
```

---

## Task 2: ClassRepository — parent_contact_logs metodları

**Files:**
- Modify: `src/domains/classes/repositories/ClassRepository.ts`

- [ ] **Step 1: 3 metod ekle**

`ClassRepository` nesnesinin sonuna (`}` kapanmadan önce) şunu ekle:

```ts
  async insertParentContactLog(data: {
    school_id: string
    student_id: string
    teacher_id: string
    note: string
    contact_method: string
    contacted_at: string
  }) {
    const supabase = await createClient()
    return supabase.from('parent_contact_logs').insert(data)
  },

  async getParentContactLogs(studentId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('parent_contact_logs')
      .select('id, note, contact_method, contacted_at, teacher_id')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .order('contacted_at', { ascending: false })
      .limit(50)
  },

  async deleteParentContactLog(logId: string, teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('parent_contact_logs')
      .delete()
      .eq('id', logId)
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
  },
```

- [ ] **Step 2: Build kontrolü**

```bash
npm run build 2>&1 | tail -20
```

Beklenen: TypeScript hatası yok.

- [ ] **Step 3: Commit**

```bash
git add src/domains/classes/repositories/ClassRepository.ts
git commit -m "feat: add parent_contact_log repository methods"
```

---

## Task 3: ClassService — parent_contact_logs metodları

**Files:**
- Modify: `src/domains/classes/services/ClassService.ts`

- [ ] **Step 1: 2 metod ekle**

`ClassService` nesnesinin sonuna ekle:

```ts
  async addParentContactLog(studentId: string, data: {
    note: string
    contact_method: string
    contacted_at: string
  }) {
    const ability = await requireAbility()
    const { error } = await ClassRepository.insertParentContactLog({
      school_id:      ability.schoolId,
      student_id:     studentId,
      teacher_id:     ability.userId,
      note:           data.note,
      contact_method: data.contact_method,
      contacted_at:   data.contacted_at,
    })
    if (error) throw new Error(error.message)
  },

  async deleteParentContactLog(logId: string) {
    const ability = await requireAbility()
    const { error } = await ClassRepository.deleteParentContactLog(logId, ability.userId, ability.schoolId)
    if (error) throw new Error(error.message)
  },
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/classes/services/ClassService.ts
git commit -m "feat: add parent contact log service methods"
```

---

## Task 4: Actions — addParentContactLog + deleteParentContactLog

**Files:**
- Modify: `app/actions/classes.ts`

- [ ] **Step 1: Zod schema ekle**

`app/actions/classes.ts` dosyasının en üstündeki `import` bloğunun ardına (diğer schema tanımlarının yanına) şunu ekle:

```ts
const parentContactSchema = z.object({
  note:           z.string().min(1, 'Not boş olamaz').max(500),
  contact_method: z.enum(['email', 'telefon', 'whatsapp', 'yuz_yuze', 'diger']),
  contacted_at:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih'),
})
```

- [ ] **Step 2: 2 action ekle**

Dosyanın sonuna ekle:

```ts
export async function addParentContactLog(
  studentId: string,
  classId: string,
  formData: FormData,
): Promise<ActionResult> {
  try { UUID.parse(studentId); UUID.parse(classId) }
  catch { return { error: 'Geçersiz ID' } }

  const parsed = parentContactSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  try {
    await ClassService.addParentContactLog(studentId, {
      note:           parsed.data.note,
      contact_method: parsed.data.contact_method,
      contacted_at:   new Date(parsed.data.contacted_at + 'T00:00:00').toISOString(),
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Kayıt eklenemedi.' }
  }

  revalidatePath(`/siniflar/${classId}/ogrenciler/${studentId}`)
  return {}
}

export async function deleteParentContactLog(
  logId: string,
  studentId: string,
  classId: string,
): Promise<ActionResult> {
  try { UUID.parse(logId); UUID.parse(studentId); UUID.parse(classId) }
  catch { return { error: 'Geçersiz ID' } }

  try {
    await ClassService.deleteParentContactLog(logId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Kayıt silinemedi.' }
  }

  revalidatePath(`/siniflar/${classId}/ogrenciler/${studentId}`)
  return {}
}
```

- [ ] **Step 3: Build kontrolü**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add app/actions/classes.ts
git commit -m "feat: add parent contact log server actions"
```

---

## Task 5: ParentContactLogSection UI + Sayfa Entegrasyonu

**Files:**
- Create: `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/ParentContactLogSection.tsx`
- Modify: `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx`

- [ ] **Step 1: ParentContactLogSection.tsx oluştur**

```tsx
'use client'

import { useState, useTransition, useActionState } from 'react'
import { format, parseISO } from '@/src/shared/date'
import { addParentContactLog, deleteParentContactLog } from '@/app/actions/classes'
import type { ActionResult } from '@/src/shared/types'

const METHOD_LABELS: Record<string, string> = {
  email:     'E-posta',
  telefon:   'Telefon',
  whatsapp:  'WhatsApp',
  yuz_yuze:  'Yüz Yüze',
  diger:     'Diğer',
}
const METHOD_COLORS: Record<string, string> = {
  email:     'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  telefon:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  whatsapp:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  yuz_yuze:  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  diger:     'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400',
}

type LogEntry = {
  id: string
  note: string
  contact_method: string
  contacted_at: string
  teacher_id: string
}

function todayISO() {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
}

function AddLogForm({ studentId, classId }: { studentId: string; classId: string }) {
  const [open, setOpen] = useState(false)

  const [state, action, pending] = useActionState(
    async (_: ActionResult | null, formData: FormData): Promise<ActionResult> => {
      const result = await addParentContactLog(studentId, classId, formData)
      if (!result.error) setOpen(false)
      return result ?? {}
    },
    null,
  )

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
      >
        + Yeni İletişim Kaydı
      </button>
    )
  }

  return (
    <form action={action} className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 bg-gray-50 dark:bg-slate-900/50 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Yöntem</label>
          <select
            name="contact_method"
            defaultValue="telefon"
            className="px-2.5 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="telefon">Telefon</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">E-posta</option>
            <option value="yuz_yuze">Yüz Yüze</option>
            <option value="diger">Diğer</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Tarih</label>
          <input
            name="contacted_at"
            type="date"
            defaultValue={todayISO()}
            max={todayISO()}
            className="px-2.5 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 dark:text-slate-400">Not (zorunlu)</label>
        <textarea
          name="note"
          required
          maxLength={500}
          placeholder="Ne görüşüldü?"
          className="w-full min-h-20 px-2.5 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
        />
      </div>
      {state?.error && (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {pending ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 text-gray-500 dark:text-slate-400 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
        >
          İptal
        </button>
      </div>
    </form>
  )
}

export default function ParentContactLogSection({
  logs,
  studentId,
  classId,
  currentUserId,
}: {
  logs: LogEntry[]
  studentId: string
  classId: string
  currentUserId: string
}) {
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function handleDelete(logId: string) {
    if (!confirm('Bu kayıt silinecek. Emin misiniz?')) return
    setDeletingId(logId)
    startTransition(async () => {
      await deleteParentContactLog(logId, studentId, classId)
      setDeletingId(null)
    })
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Veli İletişim Günlüğü</h2>
        <AddLogForm studentId={studentId} classId={classId} />
      </div>

      {logs.length === 0 ? (
        <p className="text-center text-gray-400 dark:text-slate-500 text-sm py-6">Henüz kayıt yok.</p>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div key={log.id} className="border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${METHOD_COLORS[log.contact_method] ?? METHOD_COLORS.diger}`}>
                    {METHOD_LABELS[log.contact_method] ?? log.contact_method}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {format(parseISO(log.contacted_at), 'd MMM yyyy')}
                  </span>
                  {log.teacher_id === currentUserId && (
                    <span className="text-[10px] text-gray-400 dark:text-slate-500">Sen</span>
                  )}
                </div>
                {log.teacher_id === currentUserId && (
                  <button
                    onClick={() => handleDelete(log.id)}
                    disabled={isPending && deletingId === log.id}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 shrink-0"
                  >
                    Sil
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-700 dark:text-slate-300 mt-1.5 whitespace-pre-wrap">{log.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: page.tsx'e veri sorgusu ve bileşen entegrasyonu**

`app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx` içinde:

a) Import listesine ekle:
```ts
import ParentContactLogSection from './ParentContactLogSection'
import { ClassRepository } from '@/src/domains/classes/repositories/ClassRepository'
```

b) `Promise.all` array'ine 7. sorguyu ekle:
```ts
// Mevcut 6 sorgu + yeni:
supabase
  .from('parent_contact_logs')
  .select('id, note, contact_method, contacted_at, teacher_id')
  .eq('student_id', studentId)
  .eq('school_id', schoolId)
  .order('contacted_at', { ascending: false })
  .limit(50)
```

Destructure'ı güncelle:
```ts
const [classResult, studentResult, submissionsResult, notesResult, attendanceRes, gradesRes, contactLogsRes] = await Promise.all([...])
```

c) Grades section'ın (`{grades.length > 0 && ...}`) hemen ardına ekle:
```tsx
<ParentContactLogSection
  logs={contactLogsRes.data ?? []}
  studentId={studentId}
  classId={classId}
  currentUserId={currentProfile.id}
/>
```

- [ ] **Step 3: Build + test**

```bash
npm run build 2>&1 | tail -20
```

Beklenen: Hata yok.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/siniflar/
git commit -m "feat: add parent contact log UI to student profile"
```

---

## Task 6: computeTeacherStats — Pure Function + Test

**Files:**
- Modify: `src/domains/homework/lib/analitik.ts`
- Create: `tests/vitest/unit/homework/analitik-teacher.test.ts`

- [ ] **Step 1: Tip ve fonksiyon ekle**

`src/domains/homework/lib/analitik.ts` sonuna:

```ts
export type TeacherStat = {
  teacher_id: string
  full_name: string
  homeworkCount: number
  avgCompletionPct: number
  riskyStudentCount: number
}

export function computeTeacherStats(
  teachers: { id: string; full_name: string }[],
  homeworks: AnalitikHomework[],
  submissions: AnalitikSubmission[],
  students: AnalitikStudent[],
): TeacherStat[] {
  const studentsByClass = new Map<string, number>()
  for (const s of students) {
    studentsByClass.set(s.class_id, (studentsByClass.get(s.class_id) ?? 0) + 1)
  }

  return teachers
    .map(t => {
      const teacherHws    = homeworks.filter(h => h.teacher_id === t.id)
      const homeworkCount = teacherHws.length
      if (homeworkCount === 0) return null

      const teacherHwIds = new Set(teacherHws.map(h => h.id))

      // Tamamlanma oranı
      const subsByHw = new Map<string, { yapildi: number; mazeretli: number }>()
      for (const s of submissions) {
        if (!teacherHwIds.has(s.homework_id)) continue
        const cur = subsByHw.get(s.homework_id) ?? { yapildi: 0, mazeretli: 0 }
        if (s.status === 'yapildi')       cur.yapildi++
        else if (s.status === 'mazeretli') cur.mazeretli++
        subsByHw.set(s.homework_id, cur)
      }
      let completionSum = 0
      let counted = 0
      for (const hw of teacherHws) {
        const count = studentsByClass.get(hw.class_id) ?? 0
        if (count === 0) continue
        const { yapildi = 0, mazeretli = 0 } = subsByHw.get(hw.id) ?? { yapildi: 0, mazeretli: 0 }
        const eligible = count - mazeretli
        if (eligible > 0) { completionSum += Math.round((yapildi / eligible) * 100); counted++ }
      }
      const avgCompletionPct = counted === 0 ? 0 : Math.round(completionSum / counted)

      // Risk öğrenci: bu öğretmenin ödevlerinde 3+ yapılmadı/eksik olan öğrenci
      const missedByStudent = new Map<string, number>()
      for (const s of submissions) {
        if (!teacherHwIds.has(s.homework_id)) continue
        if (s.status !== 'yapilmadi' && s.status !== 'eksik') continue
        missedByStudent.set(s.student_id, (missedByStudent.get(s.student_id) ?? 0) + 1)
      }
      const riskyStudentCount = [...missedByStudent.values()].filter(c => c >= 3).length

      return { teacher_id: t.id, full_name: t.full_name, homeworkCount, avgCompletionPct, riskyStudentCount }
    })
    .filter((t): t is TeacherStat => t !== null)
    .sort((a, b) => b.homeworkCount - a.homeworkCount)
}
```

- [ ] **Step 2: Failing test yaz**

`tests/vitest/unit/homework/analitik-teacher.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeTeacherStats } from '@/src/domains/homework/lib/analitik'
import type { AnalitikHomework, AnalitikSubmission, AnalitikStudent } from '@/src/domains/homework/lib/analitik'

function hw(id: string, classId: string, teacherId: string): AnalitikHomework {
  return { id, class_id: classId, teacher_id: teacherId, due_date: '2026-05-01', title: `Ödev ${id}` }
}
function sub(homeworkId: string, studentId: string, status: AnalitikSubmission['status']): AnalitikSubmission {
  return { homework_id: homeworkId, student_id: studentId, status }
}
function student(id: string, classId: string): AnalitikStudent {
  return { id, class_id: classId, full_name: `Öğrenci ${id}`, student_number: id }
}
const teacher = (id: string) => ({ id, full_name: `Öğretmen ${id}` })

describe('computeTeacherStats()', () => {
  it('ödevi olmayan öğretmen sonuçta çıkmaz', () => {
    const result = computeTeacherStats([teacher('t1')], [], [], [])
    expect(result).toHaveLength(0)
  })

  it('tüm ödevler yapıldı → avgCompletionPct=100', () => {
    const homeworks = [hw('h1', 'c1', 't1'), hw('h2', 'c1', 't1')]
    const students  = [student('s1', 'c1'), student('s2', 'c1')]
    const subs = [
      sub('h1', 's1', 'yapildi'), sub('h1', 's2', 'yapildi'),
      sub('h2', 's1', 'yapildi'), sub('h2', 's2', 'yapildi'),
    ]
    const result = computeTeacherStats([teacher('t1')], homeworks, subs, students)
    expect(result[0].avgCompletionPct).toBe(100)
  })

  it('2 öğrenci 3+ ödev yapılmadı → riskyStudentCount=2', () => {
    const homeworks = [hw('h1','c1','t1'), hw('h2','c1','t1'), hw('h3','c1','t1')]
    const students  = [student('s1','c1'), student('s2','c1'), student('s3','c1')]
    const subs = [
      // s1: h1,h2,h3 yapılmadı → risky
      sub('h1','s1','yapilmadi'), sub('h2','s1','yapilmadi'), sub('h3','s1','yapilmadi'),
      // s2: h1,h2,h3 eksik → risky
      sub('h1','s2','eksik'), sub('h2','s2','eksik'), sub('h3','s2','eksik'),
      // s3: 2 yapılmadı → risky değil
      sub('h1','s3','yapilmadi'), sub('h2','s3','yapilmadi'),
    ]
    const result = computeTeacherStats([teacher('t1')], homeworks, subs, students)
    expect(result[0].riskyStudentCount).toBe(2)
  })

  it('birden fazla öğretmen, ödev sayısına göre azalan sıra', () => {
    const homeworks = [
      hw('h1','c1','t1'), hw('h2','c1','t1'), hw('h3','c1','t1'), // t1: 3
      hw('h4','c2','t2'), // t2: 1
    ]
    const result = computeTeacherStats([teacher('t1'), teacher('t2')], homeworks, [], [])
    expect(result[0].teacher_id).toBe('t1')
    expect(result[1].teacher_id).toBe('t2')
  })

  it('mazeretli paydadan çıkar', () => {
    const homeworks = [hw('h1', 'c1', 't1')]
    const students  = [student('s1', 'c1'), student('s2', 'c1')]
    const subs = [sub('h1', 's1', 'yapildi'), sub('h1', 's2', 'mazeretli')]
    const result = computeTeacherStats([teacher('t1')], homeworks, subs, students)
    expect(result[0].avgCompletionPct).toBe(100)
  })
})
```

- [ ] **Step 3: Test çalıştır — başarısız olmalı**

```bash
npx vitest run tests/vitest/unit/homework/analitik-teacher.test.ts
```

Beklenen: `computeTeacherStats is not a function` veya export hatası.

- [ ] **Step 4: Step 1'deki kodu kaydet, test tekrar çalıştır**

```bash
npx vitest run tests/vitest/unit/homework/analitik-teacher.test.ts
```

Beklenen: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domains/homework/lib/analitik.ts tests/vitest/unit/homework/analitik-teacher.test.ts
git commit -m "feat: add computeTeacherStats + tests"
```

---

## Task 7: OgretmenKarsilastirma Bileşeni + Analitik Sayfa

**Files:**
- Create: `app/(dashboard)/odevler/analitik/OgretmenKarsilastirma.tsx`
- Modify: `app/(dashboard)/odevler/analitik/page.tsx`

- [ ] **Step 1: OgretmenKarsilastirma.tsx oluştur**

```tsx
import type { TeacherStat } from '@/src/domains/homework/lib/analitik'

export default function OgretmenKarsilastirma({ stats }: { stats: TeacherStat[] }) {
  if (stats.length === 0) return null

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 mt-6">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">Öğretmen Karşılaştırması</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-700">
              <th className="text-left text-xs font-medium text-gray-500 dark:text-slate-400 pb-2 pr-4">Öğretmen</th>
              <th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 pb-2 pr-4">Ödev</th>
              <th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 pb-2 pr-4">Ort. Tamamlanma</th>
              <th className="text-right text-xs font-medium text-gray-500 dark:text-slate-400 pb-2">Risk Öğrenci</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
            {stats.map(s => (
              <tr key={s.teacher_id}>
                <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-slate-100 truncate max-w-[150px]">
                  {s.full_name}
                </td>
                <td className="py-2.5 pr-4 text-right text-gray-700 dark:text-slate-300">{s.homeworkCount}</td>
                <td className="py-2.5 pr-4 text-right">
                  <span className={`font-semibold ${
                    s.avgCompletionPct >= 70 ? 'text-green-600 dark:text-green-400' :
                    s.avgCompletionPct >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    %{s.avgCompletionPct}
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  {s.riskyStudentCount > 0 ? (
                    <span className="text-red-600 dark:text-red-400 font-semibold">{s.riskyStudentCount}</span>
                  ) : (
                    <span className="text-gray-400 dark:text-slate-500">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: analitik/page.tsx güncelle**

a) Import ekle:
```ts
import OgretmenKarsilastirma from './OgretmenKarsilastirma'
import { computeTeacherStats } from '@/src/domains/homework/lib/analitik'
import type { TeacherStat } from '@/src/domains/homework/lib/analitik'
```

b) `homeworksRes` sorgusundan hemen önce müdür için öğretmen sorgusu ekle:

```ts
  const [classesRes, homeworksRes, teacherProfilesRes] = await Promise.all([
    supabase.from('classes').select('id, name, grade').eq('school_id', sid).is('deleted_at', null).order('grade').order('name'),
    hwQuery,
    isManager
      ? supabase.from('profiles').select('id, full_name').eq('school_id', sid).in('role', ['ogretmen', 'zumre_baskani'])
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ])
```

c) `classStats` hesaplamasından sonra ekle:

```ts
  const teacherStats: TeacherStat[] = isManager
    ? computeTeacherStats(teacherProfilesRes.data ?? [], homeworks, submissions, students)
    : []
```

d) JSX'te `<OgrenciSicil .../>` sonrasına ekle:

```tsx
{isManager && <OgretmenKarsilastirma stats={teacherStats} />}
```

- [ ] **Step 3: Build + testler**

```bash
npm run build 2>&1 | tail -20
npx vitest run tests/vitest/unit/homework/analitik-teacher.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/odevler/analitik/
git commit -m "feat: add teacher comparison table to analytics page"
```

---

## Task 8: StatusBoard Selective Bulk Mode

**Files:**
- Modify: `app/(dashboard)/odevler/[id]/StatusBoard.tsx`
- Modify: `app/(dashboard)/odevler/[id]/statusboard/StatusBoardToolbar.tsx`
- Modify: `app/(dashboard)/odevler/[id]/statusboard/StudentRow.tsx`

- [ ] **Step 1: StatusBoard.tsx — seçim state'i ekle**

Mevcut state tanımlarının sonuna (yaklaşık satır 56 civarı, `openBadge` state'inden sonra) ekle:

```ts
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
```

`setAllStatuses` fonksiyonundan önce yeni fonksiyon ekle:

```ts
  function toggleSelect(studentId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.student_id)))
    }
  }

  function setSelectedStatuses(next: SubmissionStatus) {
    if (selectedIds.size === 0) return
    const ids = [...selectedIds]
    const prevStatuses = { ...statuses }
    setStatuses(s => ({ ...s, ...Object.fromEntries(ids.map(id => [id, next])) }))
    startTransition(async () => {
      const result = await updateAllSubmissionStatuses(homeworkId, ids, next)
      if (result?.error) {
        setStatuses(prevStatuses)
        setErrorMsg(result.error)
      } else {
        setRecordedIds(cur => new Set([...cur, ...ids]))
      }
    })
    setSelectionMode(false)
    setSelectedIds(new Set())
  }
```

- [ ] **Step 2: StatusBoardToolbar.tsx güncelle**

Mevcut `Props` tipini güncelle:

```ts
type Props = {
  isPending: boolean
  onBulkUpdate: (status: SubmissionStatus) => void
  onExportExcel: () => void
  selectionMode: boolean
  onToggleSelectMode: () => void
}
```

Bileşeni güncelle (mevcut içeriğin başına seçim modu toggle butonu ekle):

```tsx
export default function StatusBoardToolbar({ isPending, onBulkUpdate, onExportExcel, selectionMode, onToggleSelectMode }: Props) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 mb-4">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Tümünü güncelle</p>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSelectMode}
            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
              selectionMode
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                : 'border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-700'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {selectionMode ? 'Seçim Modu' : 'Seç'}
          </button>
          <button
            onClick={onExportExcel}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-green-700 dark:hover:text-green-400 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-green-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Excel
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {BULK_OPTIONS.map(option => (
          <button
            key={option}
            disabled={isPending}
            onClick={() => onBulkUpdate(option)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${STYLES[option]}`}
          >
            Tümü {LABELS[option]}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: StudentRow.tsx — checkbox props ekle**

`Props` tipine ekle:
```ts
  selectionMode: boolean
  selected: boolean
  onToggleSelect: (studentId: string) => void
```

`StudentRow` fonksiyon parametrelerine ekle:
```ts
  selectionMode,
  selected,
  onToggleSelect,
```

Ana `<div>` hemen içinde, mevcut içerikten önce checkbox ekle:
```tsx
{selectionMode && (
  <div className="mb-2">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(item.student_id)}
        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-xs text-gray-500 dark:text-slate-400">Seç</span>
    </label>
  </div>
)}
```

- [ ] **Step 4: StatusBoard.tsx — bağlantıları tamamla**

`StatusBoardToolbar` çağrısını güncelle:
```tsx
<StatusBoardToolbar
  isPending={isPending}
  onBulkUpdate={setAllStatuses}
  onExportExcel={exportToExcel}
  selectionMode={selectionMode}
  onToggleSelectMode={() => {
    setSelectionMode(p => !p)
    setSelectedIds(new Set())
  }}
/>
```

`StudentRow` çağrısına ekle:
```tsx
selectionMode={selectionMode}
selected={selectedIds.has(item.student_id)}
onToggleSelect={toggleSelect}
```

Floating seçim action bar'ı `errorMsg` bloğunun hemen üstüne ekle:
```tsx
{selectionMode && selectedIds.size > 0 && (
  <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-gray-900 dark:bg-slate-700 text-white rounded-2xl shadow-2xl px-4 py-3 flex-wrap justify-center">
    <button
      onClick={toggleSelectAll}
      className="text-xs text-gray-300 hover:text-white transition-colors whitespace-nowrap"
    >
      {selectedIds.size === filteredItems.length ? 'Seçimi Temizle' : 'Tümünü Seç'}
    </button>
    <span className="text-sm font-medium whitespace-nowrap">{selectedIds.size} seçildi</span>
    {BULK_OPTIONS.map(status => (
      <button
        key={status}
        disabled={isPending}
        onClick={() => setSelectedStatuses(status)}
        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-60 ${STYLES[status]}`}
      >
        {LABELS[status]}
      </button>
    ))}
    <button
      onClick={() => { setSelectionMode(false); setSelectedIds(new Set()) }}
      className="text-xs text-gray-400 hover:text-white transition-colors"
    >
      İptal
    </button>
  </div>
)}
```

`BULK_OPTIONS` ve `STYLES` ve `LABELS` zaten `./statusboard/types`'tan import edilmiş, ek import gerekmez.

- [ ] **Step 5: Build + testler**

```bash
npm run build 2>&1 | tail -20
npm run test:unit 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add app/(dashboard)/odevler/[id]/
git commit -m "feat: add selective bulk mode to StatusBoard"
```

---

## Task 9: Yoklama "Alınmadı" Uyarısı

**Files:**
- Modify: `app/(dashboard)/yoklama/page.tsx`
- Modify: `app/(dashboard)/yoklama/YoklamaClient.tsx`

- [ ] **Step 1: page.tsx — bugün alınan sınıfları sorgula**

`absencesRes` ve `todayRes` sorgusunun `Promise.all`'una üçüncü sorguyu ekle:

```ts
  const [absencesRes, todayRes, takenTodayRes] = await Promise.all([
    // ... mevcut iki sorgu aynı ...
    supabase
      .from('attendance')
      .select('class_id')
      .eq('school_id', profile.school_id)
      .eq('date', todayISO)
      .in('class_id', classes.map(c => c.id)),
  ])
```

Ardından `takenTodayIds`'i türet:
```ts
  const takenTodayIds = new Set((takenTodayRes.data ?? []).map(r => r.class_id))
```

`YoklamaClient`'a prop geçir:
```tsx
<YoklamaClient
  ...
  takenTodayIds={[...takenTodayIds]}
/>
```

- [ ] **Step 2: YoklamaClient.tsx — Props ve badge**

`Props` tipine ekle:
```ts
  takenTodayIds?: string[]
```

`YoklamaClient` fonksiyonuna ekle:
```ts
  const takenSet = useMemo(() => new Set(takenTodayIds ?? []), [takenTodayIds])
```

Bugün hafta sonu mu kontrolü (mevcut `today` state'ini kullanarak):
```ts
  const isTodayWeekend = useMemo(() => {
    const d = new Date(today + 'T12:00:00')
    return d.getDay() === 0 || d.getDay() === 6
  }, [today])
```

Sayfanın başlık bölümünün (`<div className="mb-5 ...">`) hemen üstüne uyarı banner'ı ekle:
```tsx
{!isTodayWeekend && date === today && (() => {
  const missing = classes.filter(c => myClassIds?.includes(c.id) && !takenSet.has(c.id))
  if (missing.length === 0) return null
  return (
    <div className="mb-4 flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm px-4 py-3 rounded-xl">
      <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
      </svg>
      <span>Bugün yoklama alınmadı: <strong>{missing.map(c => c.name).join(', ')}</strong></span>
    </div>
  )
})()}
```

Sınıf tabı/seçici'ye (sınıf `name` gösterildiği yerde) yeşil/kırmızı nokta ekle. YoklamaClient'ta sınıf seçici alanını bul — `classes.map(cls => ...)` veya benzeri liste — ve her sınıf adının yanına:
```tsx
{!isTodayWeekend && date === today && (
  <span className={`inline-block w-1.5 h-1.5 rounded-full ml-1 ${takenSet.has(cls.id) ? 'bg-green-500' : 'bg-red-400'}`} />
)}
```

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/yoklama/
git commit -m "feat: add attendance not-taken warning to yoklama page"
```

---

## Task 10: OgrenciListesi Inline Not Ekleme

**Files:**
- Modify: `app/(dashboard)/siniflar/[id]/OgrenciListesi.tsx`

- [ ] **Step 1: OgrenciSatiri'ne not paneli ekle**

`OgrenciSatiri` bileşenine import ekle (dosya başına):
```ts
import { addStudentNote } from '@/src/domains/classes/actions'
import type { ActionResult } from '@/src/shared/types'
```

`OgrenciSatiri` içinde mevcut `const [open, setOpen] = useState(false)` satırının ardına:
```ts
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteState, noteAction, notePending] = useActionState(
    async (_: ActionResult | null, formData: FormData): Promise<ActionResult> => {
      const result = await addStudentNote(s.id, classId, formData) as ActionResult | undefined
      if (!result?.error) setNoteOpen(false)
      return result ?? {}
    },
    null,
  )
```

`addStudentNote` action void döner ama burada `ActionResult` bekliyoruz. Mevcut action signature'ı `throw`'u kullanıyor. Bu durumda:
```ts
    async (_: ActionResult | null, formData: FormData): Promise<ActionResult> => {
      try {
        await addStudentNote(s.id, classId, formData)
        setNoteOpen(false)
        return {}
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Not eklenemedi.' }
      }
    },
```

İletişim butonlarının (`s.veli_email`, `s.veli_telefon`) yanındaki buton grubuna not butonu ekle:
```tsx
<button
  onClick={() => setNoteOpen(v => !v)}
  title="Hızlı not"
  className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
    noteOpen
      ? 'text-purple-600 bg-purple-50 dark:bg-purple-950'
      : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950'
  }`}
>
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
</button>
```

Mevcut veli iletişim inline panelinin (`{open && ...}`) ardına not panelini ekle:
```tsx
{noteOpen && (
  <div className="border-t border-gray-100 dark:border-slate-700 px-4 py-3 bg-purple-50/50 dark:bg-slate-900/50">
    <form action={noteAction} className="flex gap-2 items-end">
      <textarea
        name="body"
        required
        placeholder="Hızlı not..."
        rows={2}
        className="flex-1 min-w-0 px-2.5 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-gray-400 resize-none"
      />
      <div className="flex flex-col gap-1 shrink-0">
        <button
          type="submit"
          disabled={notePending}
          className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-60 transition-colors"
        >
          {notePending ? '...' : 'Kaydet'}
        </button>
        <button
          type="button"
          onClick={() => setNoteOpen(false)}
          className="px-3 py-1.5 text-gray-500 dark:text-slate-400 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
        >
          İptal
        </button>
      </div>
    </form>
    {noteState?.error && (
      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{noteState.error}</p>
    )}
  </div>
)}
```

- [ ] **Step 2: ActionResult import kontrolü**

`app/(dashboard)/siniflar/[id]/OgrenciListesi.tsx` dosyasının başında `ActionResult` tipi import edilmiş mi kontrol et. Yoksa ekle:
```ts
import type { ActionResult } from '@/src/shared/types'
```

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/siniflar/[id]/OgrenciListesi.tsx"
git commit -m "feat: add inline quick note to student list"
```

---

## Task 11: Takvim Tamamlanma Oranı

**Files:**
- Modify: `app/(dashboard)/odevler/takvim/page.tsx`
- Modify: `app/(dashboard)/odevler/takvim/HomeworkCalendar.tsx`

- [ ] **Step 1: takvim/page.tsx — completion sorgusu**

Mevcut `rawHomeworks` sorgusunun ardına (homework ID'leri hazır olduktan sonra) ekle:

```ts
  const homeworks = (rawHomeworks ?? []).map(hw => ({
    ...hw,
    classes: Array.isArray(hw.classes) ? (hw.classes[0] ?? null) : hw.classes,
  }))

  const hwIds = homeworks.map(h => h.id)

  const { data: subRows } = hwIds.length > 0
    ? await supabase
        .from('homework_submissions')
        .select('homework_id, status')
        .in('homework_id', hwIds)
        .eq('school_id', sid)
    : { data: [] as { homework_id: string; status: string }[] }

  const completionMap: Record<string, { yapildi: number; total: number }> = {}
  for (const row of subRows ?? []) {
    const cur = completionMap[row.homework_id] ?? { yapildi: 0, total: 0 }
    cur.total++
    if (row.status === 'yapildi') cur.yapildi++
    completionMap[row.homework_id] = cur
  }
```

`HomeworkCalendar`'a prop geçir:
```tsx
<HomeworkCalendar homeworks={homeworks ?? []} completionMap={completionMap} />
```

- [ ] **Step 2: HomeworkCalendar.tsx — prop ve görünüm**

`HwItem` tipine completion ekle:
```ts
type HwItem = {
  id: string
  title: string
  subject: string | null
  due_date: string
  classes: { name: string } | null
}
```
Tip değişmez — completion ayrı prop olarak gelir.

`HomeworkCalendar` fonksiyon imzasına ekle:
```ts
export default function HomeworkCalendar({
  homeworks,
  completionMap = {},
}: {
  homeworks: HwItem[]
  completionMap?: Record<string, { yapildi: number; total: number }>
})
```

Sağ paneldeki ödev listesinde (`selectedHws.map(hw => ...)`) her `<li>` içinde `hw.subject` gösterilen satırın altına ekle:
```tsx
{completionMap[hw.id] && completionMap[hw.id].total > 0 && (
  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
    %{Math.round((completionMap[hw.id].yapildi / completionMap[hw.id].total) * 100)} tamamlandı
    ({completionMap[hw.id].yapildi}/{completionMap[hw.id].total})
  </p>
)}
```

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/odevler/takvim/"
git commit -m "feat: show completion rate in homework calendar side panel"
```

---

## Task 12: WeekLoadBanner Danger Sticky

**Files:**
- Modify: `app/(dashboard)/odevler/WeekLoadBanner.tsx`

- [ ] **Step 1: Danger durumunda sticky yap**

`WeekLoadBanner` bileşeninde `<div className="space-y-2">` wrapper'ını şöyle güncelle:

```tsx
  const hasDanger = loads.some(l => {
    const effectiveCount = l.count + (isCreating ? 1 : 0)
    return effectiveCount >= 5
  })

  return (
    <div className={`space-y-2 ${hasDanger ? 'sticky top-0 z-10' : ''}`}>
      {loads.map(load => (
        <ClassSection ... />
      ))}
    </div>
  )
```

`ClassSection` içinde danger başlık metnine `animate-pulse` ekle:

Mevcut `<span className={...headerText}>` satırını bul — `effectiveLevel === 'danger'` iken:
```tsx
<span className={`text-xs font-semibold ${headerText} ${effectiveLevel === 'danger' ? 'animate-pulse' : ''}`}>
```

- [ ] **Step 2: Build**

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/odevler/WeekLoadBanner.tsx"
git commit -m "feat: make WeekLoadBanner sticky and pulse on danger"
```

---

## Task 13: Print Görünümü

**Files:**
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `app/(dashboard)/odevler/[id]/page.tsx`

- [ ] **Step 1: layout.tsx — sidebar ve extra bileşenler print:hidden**

Mevcut `<Sidebar>` satırını `print:hidden` wrapper'a al:
```tsx
<div className="print:hidden">
  <Sidebar profile={profile} email={user.email ?? ''} />
</div>
```

`<QuickAddDrawer />` ve `<CommandPalette />` satırlarına `className="print:hidden"` eklenemiyor (bileşenler), wrapper kullan:
```tsx
<div className="print:hidden">
  {isTeachingRole(profile?.role) && <QuickAddDrawer />}
  <CommandPalette />
</div>
```

`<main>` elementine `print:overflow-visible print:pt-0` ekle:
```tsx
<main className="flex-1 overflow-auto pt-14 md:pt-0 pb-16 md:pb-0 mobile-main print:overflow-visible print:pt-0">
  {children}
</main>
```

- [ ] **Step 2: odevler/[id]/page.tsx — print header**

`<div className="p-4 md:p-6 max-w-4xl mx-auto">` içinde, `{sp.guncellendi && ...}` bloğunun hemen ÖNÜNE print header ekle:

```tsx
{/* Print başlığı — ekranda gizli, çıktıda görünür */}
<div className="hidden print:block mb-6 pb-4 border-b border-gray-300">
  <h1 className="text-xl font-bold text-gray-900">{hw.title}</h1>
  <p className="text-sm text-gray-600 mt-1">
    {cls?.name ?? '—'} · {hw.subject}
    {hw.due_date ? ` · Son Teslim: ${format(parseISO(hw.due_date), 'd MMMM yyyy')}` : ''}
  </p>
  <p className="text-xs text-gray-400 mt-1">
    Yazdırma tarihi: {format(new Date(), 'd MMMM yyyy')}
  </p>
</div>
```

Geri butonu ve üst aksiyon barını (`<div className="flex items-center justify-between mb-3 print:hidden">`) zaten `print:hidden` — doğrulanmış.

- [ ] **Step 3: Build + tüm testler**

```bash
npm run build 2>&1 | tail -20
npm run test:unit 2>&1 | tail -10
```

Beklenen: Hata yok, tüm testler geçiyor.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/layout.tsx" "app/(dashboard)/odevler/[id]/page.tsx"
git commit -m "feat: improve print layout for homework detail page"
```

---

## Son Adım: Tüm Testleri Çalıştır + Push

- [ ] **Final test**

```bash
npm run test 2>&1 | tail -15
```

Beklenen: Mevcut geçen testler + yeni `analitik-teacher.test.ts` testleri hepsi PASS.

- [ ] **Push**

```bash
git push origin main
```

---

## Bağımlılık Özeti

```
Task 1 (Migration)
  └── Task 2 (Repository)
        └── Task 3 (Service)
              └── Task 4 (Actions)
                    └── Task 5 (UI)

Task 6 (computeTeacherStats)
  └── Task 7 (Analitik UI)

Tasks 8, 9, 10, 11, 12, 13 → tamamen bağımsız, paralel çalıştırılabilir
```
