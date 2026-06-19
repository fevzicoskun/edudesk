# Ders Programım Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Her öğretmen kendi haftalık ders programını ızgaradan girip görüntüleyebilsin ve her sabah "bugünün dersleri" bildirimi alsın.

**Architecture:** Mevcut `lesson_schedules` tablosu (öksüz) kullanılır; `periods` JSONB kolonu eklenir. Saf mantık `scheduleMath.ts`'te (test edilir), I/O repository/service/action katmanlarında (CLAUDE.md deseni), UI `/ders-programi` ızgarası, hatırlatma Inngest cron'u.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, Supabase SSR + RLS, Zod, Vitest, Inngest, web-push.

## Global Constraints

- Next.js 16: middleware dosyası `proxy.ts` (dokunulmayacak).
- Her sorguda `school_id` filtresi; soft-delete tablolarda `.is('deleted_at', null)`.
- Mutasyonlar server action üzerinden: validate → service → `revalidatePath`.
- Server-side cross-tenant doğrulaması UI'a güvenmeden yapılır (`class_id` okul sınıflarına karşı).
- Supabase project ID: `agijvfrcudpzsofgfogu`.
- Türkçe arayüz metinleri; teknik tanımlayıcılar İngilizce.
- `database.types.ts` git'te tracked — şema değişince yenilenir.

---

### Task 1: Migration — periods kolonu, teklik, daraltılmış RLS

**Files:**
- Create: `supabase/migrations/20260619140000_ders_programi_periods_rls.sql`
- Modify: `src/infrastructure/supabase/database.types.ts` (yeniden üret)

**Interfaces:**
- Produces: `lesson_schedules.periods` (jsonb), `UNIQUE (school_id, teacher_id)`, öğretmen-self RLS politikaları.

- [ ] **Step 1: Migration dosyasını yaz**

`supabase/migrations/20260619140000_ders_programi_periods_rls.sql`:

```sql
-- Ders Programım: periods kolonu + öğretmen başına teklik + daraltılmış SELECT + öğretmen-self yazma.

alter table lesson_schedules
  add column if not exists periods jsonb not null default '[]'::jsonb;

-- Öğretmen başına tek satır (upsert conflict hedefi). teacher_id nullable;
-- Postgres'te UNIQUE içindeki NULL'lar ayrık → olası sınıf-bazlı satırları bozmaz.
alter table lesson_schedules
  add constraint lesson_schedules_school_teacher_uniq unique (school_id, teacher_id);

-- SELECT daralt: kendi satırı VEYA müdür/MY (en az ayrıcalık; gözetim geldiğinde genişletilir).
drop policy if exists "lesson_schedules_select" on lesson_schedules;
create policy "lesson_schedules_select" on lesson_schedules
  for select to authenticated
  using (
    school_id = current_school_id()
    and (
      teacher_id = auth.uid()
      or (select role from profiles where id = auth.uid()) in ('mudur','mudur_yardimcisi')
    )
  );

-- Öğretmen-self yazma (mevcut müdür/MY politikaları korunur).
create policy "lesson_schedules_teacher_insert" on lesson_schedules
  for insert to authenticated
  with check (school_id = current_school_id() and teacher_id = auth.uid());

create policy "lesson_schedules_teacher_update" on lesson_schedules
  for update to authenticated
  using (school_id = current_school_id() and teacher_id = auth.uid())
  with check (school_id = current_school_id() and teacher_id = auth.uid());

create policy "lesson_schedules_teacher_delete" on lesson_schedules
  for delete to authenticated
  using (school_id = current_school_id() and teacher_id = auth.uid());
```

- [ ] **Step 2: Migration'ı uygula**

Supabase MCP `apply_migration` ile: `project_id=agijvfrcudpzsofgfogu`, `name=ders_programi_periods_rls`, `query=` yukarıdaki SQL.

- [ ] **Step 3: Uygulandığını doğrula**

Supabase MCP `execute_sql` ile:
```sql
select column_name from information_schema.columns
where table_name='lesson_schedules' and column_name='periods';
select polname from pg_policies where tablename='lesson_schedules' order by polname;
```
Expected: `periods` döner; politikalar arasında `lesson_schedules_teacher_insert/update/delete` ve daraltılmış `lesson_schedules_select` görünür.

- [ ] **Step 4: Tipleri yenile**

Supabase MCP `generate_typescript_types` (project_id) çıktısını `src/infrastructure/supabase/database.types.ts` üzerine yaz. Ardından `lesson_schedules` Row'unda `periods: Json` alanının geldiğini doğrula.

- [ ] **Step 5: Tip kontrolü**

Run: `npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260619140000_ders_programi_periods_rls.sql src/infrastructure/supabase/database.types.ts
git commit -m "feat(schedule): lesson_schedules periods kolonu + teklik + daraltılmış RLS"
```

---

### Task 2: scheduleMath — saf mantık + birim testler (TDD)

**Files:**
- Create: `src/domains/schedule/scheduleMath.ts`
- Test: `tests/vitest/unit/domains/schedule/scheduleMath.test.ts`

**Interfaces:**
- Produces:
  - `interface Period { no: number; start: string; end: string }` (start/end "HH:MM", 24h, sıfır dolgulu)
  - `interface Slot { day: number; period: number; class_id: string }`
  - `interface TodayLesson { period: number; start: string; end: string; classId: string }`
  - `DEFAULT_PERIODS: Period[]`
  - `validatePeriods(periods: Period[]): string | null` (null=geçerli, aksi halde Türkçe hata)
  - `validateSlots(slots: Slot[], periods: Period[], validClassIds: string[]): string | null`
  - `todaysLessons(slots: Slot[], periods: Period[], day: number): TodayLesson[]`
  - `formatOzetBody(items: { period: number; className: string }[]): string`

- [ ] **Step 1: Testi yaz**

`tests/vitest/unit/domains/schedule/scheduleMath.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PERIODS,
  validatePeriods,
  validateSlots,
  todaysLessons,
  formatOzetBody,
  type Period,
  type Slot,
} from '@/src/domains/schedule/scheduleMath'

const P: Period[] = [
  { no: 1, start: '08:30', end: '09:05' },
  { no: 2, start: '09:15', end: '09:50' },
  { no: 3, start: '09:55', end: '10:30' },
]

describe('DEFAULT_PERIODS', () => {
  it('geçerli ve artan sıralı', () => {
    expect(validatePeriods(DEFAULT_PERIODS)).toBeNull()
    expect(DEFAULT_PERIODS.length).toBe(8)
  })
})

describe('validatePeriods', () => {
  it('boş listeyi reddeder', () => {
    expect(validatePeriods([])).not.toBeNull()
  })
  it('start >= end ise reddeder', () => {
    expect(validatePeriods([{ no: 1, start: '10:00', end: '09:00' }])).not.toBeNull()
  })
  it('çakışan/sıra dışı periyodu reddeder', () => {
    const bad: Period[] = [
      { no: 1, start: '08:30', end: '09:05' },
      { no: 2, start: '09:00', end: '09:40' }, // önceki bitişten önce başlıyor
    ]
    expect(validatePeriods(bad)).not.toBeNull()
  })
  it('yinelenen no reddeder', () => {
    const bad: Period[] = [
      { no: 1, start: '08:30', end: '09:05' },
      { no: 1, start: '09:15', end: '09:50' },
    ]
    expect(validatePeriods(bad)).not.toBeNull()
  })
})

describe('validateSlots', () => {
  const ids = ['c1', 'c2']
  it('geçerli slotları kabul eder', () => {
    const slots: Slot[] = [{ day: 1, period: 1, class_id: 'c1' }]
    expect(validateSlots(slots, P, ids)).toBeNull()
  })
  it('gün aralığı dışını reddeder', () => {
    expect(validateSlots([{ day: 6, period: 1, class_id: 'c1' }], P, ids)).not.toBeNull()
  })
  it('var olmayan periyodu reddeder', () => {
    expect(validateSlots([{ day: 1, period: 9, class_id: 'c1' }], P, ids)).not.toBeNull()
  })
  it('okulda olmayan sınıfı reddeder (cross-tenant)', () => {
    expect(validateSlots([{ day: 1, period: 1, class_id: 'yabanci' }], P, ids)).not.toBeNull()
  })
  it('aynı (gün,periyot) iki slotu reddeder', () => {
    const dup: Slot[] = [
      { day: 1, period: 1, class_id: 'c1' },
      { day: 1, period: 1, class_id: 'c2' },
    ]
    expect(validateSlots(dup, P, ids)).not.toBeNull()
  })
})

describe('todaysLessons', () => {
  const slots: Slot[] = [
    { day: 1, period: 3, class_id: 'c2' },
    { day: 1, period: 1, class_id: 'c1' },
    { day: 2, period: 1, class_id: 'c1' },
  ]
  it('günü filtreler ve saate göre sıralar', () => {
    const r = todaysLessons(slots, P, 1)
    expect(r.map(x => x.period)).toEqual([1, 3])
    expect(r[0]).toEqual({ period: 1, start: '08:30', end: '09:05', classId: 'c1' })
  })
  it('dersi olmayan gün için boş döner', () => {
    expect(todaysLessons(slots, P, 5)).toEqual([])
  })
})

describe('formatOzetBody', () => {
  it('periyot ve sınıfı okunur biçimde birleştirir', () => {
    const body = formatOzetBody([
      { period: 1, className: '9-A' },
      { period: 3, className: '10-B' },
    ])
    expect(body).toBe('1. ders 9-A · 3. ders 10-B')
  })
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `npx vitest run tests/vitest/unit/domains/schedule/scheduleMath.test.ts`
Expected: FAIL — modül yok / fonksiyonlar tanımsız.

- [ ] **Step 3: scheduleMath'i yaz**

`src/domains/schedule/scheduleMath.ts`:

```ts
export interface Period { no: number; start: string; end: string } // "HH:MM"
export interface Slot { day: number; period: number; class_id: string }
export interface TodayLesson { period: number; start: string; end: string; classId: string }

// Varsayılan zil çizelgesi (08:30 başlangıç varsayımı; öğretmen UI'dan düzenler).
// Teneffüs/öğle ayrı satır değil — periyot araları boşluktur; öğle = 5.→6. arası büyük boşluk.
export const DEFAULT_PERIODS: Period[] = [
  { no: 1, start: '08:30', end: '09:05' },
  { no: 2, start: '09:15', end: '09:50' },
  { no: 3, start: '09:55', end: '10:30' },
  { no: 4, start: '10:35', end: '11:10' },
  { no: 5, start: '11:15', end: '11:50' },
  { no: 6, start: '13:40', end: '14:15' },
  { no: 7, start: '14:20', end: '14:55' },
  { no: 8, start: '15:00', end: '15:35' },
]

const TIME_RE = /^\d{2}:\d{2}$/

// "HH:MM" sıfır dolgulu olduğundan sözlük sırası = kronolojik sıra.
export function validatePeriods(periods: Period[]): string | null {
  if (!Array.isArray(periods) || periods.length < 1) return 'En az bir ders saati gerekli'
  if (periods.length > 12) return 'En fazla 12 ders saati olabilir'
  const seen = new Set<number>()
  let prevEnd = ''
  for (const p of periods) {
    if (!TIME_RE.test(p.start) || !TIME_RE.test(p.end)) return 'Saat biçimi HH:MM olmalı'
    if (p.start >= p.end) return `${p.no}. ders: başlangıç bitişten önce olmalı`
    if (seen.has(p.no)) return `Tekrarlanan ders no: ${p.no}`
    seen.add(p.no)
    if (prevEnd && p.start < prevEnd) return 'Ders saatleri çakışıyor / sıralı değil'
    prevEnd = p.end
  }
  return null
}

export function validateSlots(slots: Slot[], periods: Period[], validClassIds: string[]): string | null {
  const periodNos = new Set(periods.map(p => p.no))
  const classes = new Set(validClassIds)
  const cells = new Set<string>()
  for (const s of slots) {
    if (!Number.isInteger(s.day) || s.day < 1 || s.day > 5) return 'Geçersiz gün'
    if (!periodNos.has(s.period)) return `Geçersiz ders saati: ${s.period}`
    if (!classes.has(s.class_id)) return 'Geçersiz sınıf seçimi'
    const key = `${s.day}-${s.period}`
    if (cells.has(key)) return 'Aynı saatte birden fazla sınıf seçilemez'
    cells.add(key)
  }
  return null
}

export function todaysLessons(slots: Slot[], periods: Period[], day: number): TodayLesson[] {
  const byNo = new Map(periods.map(p => [p.no, p]))
  return slots
    .filter(s => s.day === day && byNo.has(s.period))
    .map(s => {
      const p = byNo.get(s.period)!
      return { period: p.no, start: p.start, end: p.end, classId: s.class_id }
    })
    .sort((a, b) => a.start.localeCompare(b.start))
}

export function formatOzetBody(items: { period: number; className: string }[]): string {
  return items
    .slice()
    .sort((a, b) => a.period - b.period)
    .map(i => `${i.period}. ders ${i.className}`)
    .join(' · ')
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `npx vitest run tests/vitest/unit/domains/schedule/scheduleMath.test.ts`
Expected: PASS (tüm testler yeşil).

- [ ] **Step 5: Commit**

```bash
git add src/domains/schedule/scheduleMath.ts tests/vitest/unit/domains/schedule/scheduleMath.test.ts
git commit -m "feat(schedule): scheduleMath saf mantık (periyot/slot doğrulama, bugünün dersleri)"
```

---

### Task 3: Repository + Service + Action (server yazma yolu)

**Files:**
- Create: `src/domains/schedule/repositories/ScheduleRepository.ts`
- Create: `src/domains/schedule/services/ScheduleService.ts`
- Create: `app/actions/schedule.ts`

**Interfaces:**
- Consumes: `scheduleMath` (`Period`, `Slot`, `DEFAULT_PERIODS`, `validatePeriods`, `validateSlots`); `requireAbility()` from `@/src/shared/authorization/server` → `{ userId: string; schoolId: string }`; `ActionResult` from `@/src/shared/types/index`.
- Produces:
  - `ScheduleService.getMySchedule(): Promise<{ periods: Period[]; slots: Slot[]; classes: { id: string; name: string }[] }>`
  - `ScheduleService.saveMySchedule(periods: Period[], slots: Slot[]): Promise<{ error?: string }>`
  - `saveSchedule(input: unknown): Promise<ActionResult>`

- [ ] **Step 1: Repository'yi yaz**

`src/domains/schedule/repositories/ScheduleRepository.ts`:

```ts
import { createClient } from '@/src/infrastructure/supabase/server'
import type { Period, Slot } from '../scheduleMath'

// Not: createClient (kullanıcı oturumu) → RLS öğretmen-self politikalarını uygular.
export const ScheduleRepository = {
  async getByTeacher(teacherId: string, schoolId: string) {
    const db = await createClient()
    return db
      .from('lesson_schedules')
      .select('slots, periods')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .maybeSingle()
  },

  async listSchoolClasses(schoolId: string) {
    const db = await createClient()
    return db
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('grade')
      .order('name')
  },

  async upsert(row: { teacher_id: string; school_id: string; periods: Period[]; slots: Slot[] }) {
    const db = await createClient()
    return db.from('lesson_schedules').upsert(
      {
        teacher_id: row.teacher_id,
        school_id:  row.school_id,
        periods:    row.periods as unknown as never,
        slots:      row.slots as unknown as never,
      },
      { onConflict: 'school_id,teacher_id' },
    )
  },
}
```

- [ ] **Step 2: Service'i yaz**

`src/domains/schedule/services/ScheduleService.ts`:

```ts
import { requireAbility } from '@/src/shared/authorization/server'
import { ScheduleRepository } from '../repositories/ScheduleRepository'
import { DEFAULT_PERIODS, validatePeriods, validateSlots, type Period, type Slot } from '../scheduleMath'

export const ScheduleService = {
  async getMySchedule(): Promise<{ periods: Period[]; slots: Slot[]; classes: { id: string; name: string }[] }> {
    const ability = await requireAbility()
    const [rowRes, classRes] = await Promise.all([
      ScheduleRepository.getByTeacher(ability.userId, ability.schoolId),
      ScheduleRepository.listSchoolClasses(ability.schoolId),
    ])
    const row = rowRes.data
    const periods = (row?.periods as Period[] | null)?.length ? (row!.periods as unknown as Period[]) : DEFAULT_PERIODS
    const slots = (row?.slots as Slot[] | null) ?? []
    return {
      periods,
      slots: slots as unknown as Slot[],
      classes: (classRes.data ?? []) as { id: string; name: string }[],
    }
  },

  async saveMySchedule(periods: Period[], slots: Slot[]): Promise<{ error?: string }> {
    const ability = await requireAbility()

    const pErr = validatePeriods(periods)
    if (pErr) return { error: pErr }

    // class_id'leri UI'a güvenmeden okul sınıflarına karşı doğrula (cross-tenant koruması).
    const { data: classes } = await ScheduleRepository.listSchoolClasses(ability.schoolId)
    const validIds = (classes ?? []).map(c => c.id)
    const sErr = validateSlots(slots, periods, validIds)
    if (sErr) return { error: sErr }

    const { error } = await ScheduleRepository.upsert({
      teacher_id: ability.userId,
      school_id:  ability.schoolId,
      periods,
      slots,
    })
    if (error) return { error: error.message }
    return {}
  },
}
```

- [ ] **Step 3: Action'ı yaz**

`app/actions/schedule.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ScheduleService } from '@/src/domains/schedule/services/ScheduleService'
import type { ActionResult } from '@/src/shared/types/index'

const periodSchema = z.object({
  no:    z.number().int().min(1).max(12),
  start: z.string().regex(/^\d{2}:\d{2}$/, 'Saat biçimi HH:MM olmalı'),
  end:   z.string().regex(/^\d{2}:\d{2}$/, 'Saat biçimi HH:MM olmalı'),
})

const slotSchema = z.object({
  day:      z.number().int().min(1).max(5),
  period:   z.number().int().min(1).max(12),
  class_id: z.string().uuid(),
})

const saveSchema = z.object({
  periods: z.array(periodSchema).min(1).max(12),
  slots:   z.array(slotSchema).max(60),
})

export async function saveSchedule(input: unknown): Promise<ActionResult> {
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await ScheduleService.saveMySchedule(parsed.data.periods, parsed.data.slots)
  if (result.error) return { error: result.error }

  revalidatePath('/ders-programi')
  return {}
}
```

- [ ] **Step 4: Tip kontrolü + birim testler**

Run: `npx tsc --noEmit && npm run test:unit`
Expected: 0 TS hatası; mevcut birim testler + Task 2 testleri yeşil (regresyon yok).

- [ ] **Step 5: Commit**

```bash
git add src/domains/schedule/repositories/ScheduleRepository.ts src/domains/schedule/services/ScheduleService.ts app/actions/schedule.ts
git commit -m "feat(schedule): repository + service + saveSchedule action"
```

---

### Task 4: Sayfa + ızgara client + Sidebar linki

**Files:**
- Create: `app/(dashboard)/ders-programi/page.tsx`
- Create: `app/(dashboard)/ders-programi/DersProgramiClient.tsx`
- Modify: `components/layout/Sidebar.tsx` (navItems dizisine ekleme)

**Interfaces:**
- Consumes: `ScheduleService.getMySchedule()`; `saveSchedule` action; `getCurrentProfile()`; `isTeachingRole`, `isMudurOrAbove` from `@/src/shared/types`; `Period`, `Slot` from `scheduleMath`.

- [ ] **Step 1: Server sayfasını yaz**

`app/(dashboard)/ders-programi/page.tsx`:

```tsx
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import { isTeachingRole, isMudurOrAbove } from '@/src/shared/types'
import { ScheduleService } from '@/src/domains/schedule/services/ScheduleService'
import DersProgramiClient from './DersProgramiClient'

export const dynamic = 'force-dynamic'

export default async function DersProgramiPage() {
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')
  if (!(isTeachingRole(profile.role) || isMudurOrAbove(profile.role))) redirect('/anasayfa')

  const { periods, slots, classes } = await ScheduleService.getMySchedule()

  return (
    <DersProgramiClient
      initialPeriods={periods}
      initialSlots={slots}
      classes={classes}
      subject={profile.subject ?? ''}
    />
  )
}
```

- [ ] **Step 2: Izgara client'ını yaz**

`app/(dashboard)/ders-programi/DersProgramiClient.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { saveSchedule } from '@/app/actions/schedule'
import type { Period, Slot } from '@/src/domains/schedule/scheduleMath'

const DAYS = [
  { n: 1, label: 'Pazartesi' },
  { n: 2, label: 'Salı' },
  { n: 3, label: 'Çarşamba' },
  { n: 4, label: 'Perşembe' },
  { n: 5, label: 'Cuma' },
]

type Props = {
  initialPeriods: Period[]
  initialSlots: Slot[]
  classes: { id: string; name: string }[]
  subject: string
}

export default function DersProgramiClient({ initialPeriods, initialSlots, classes, subject }: Props) {
  const [periods, setPeriods] = useState<Period[]>(initialPeriods)
  const [slots, setSlots] = useState<Slot[]>(initialSlots)
  const [editTimes, setEditTimes] = useState(false)
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const cellClass = (day: number, period: number) =>
    slots.find(s => s.day === day && s.period === period)?.class_id ?? ''

  function setCell(day: number, period: number, classId: string) {
    setSlots(prev => {
      const rest = prev.filter(s => !(s.day === day && s.period === period))
      return classId ? [...rest, { day, period, class_id: classId }] : rest
    })
  }

  function setPeriodTime(no: number, field: 'start' | 'end', value: string) {
    setPeriods(prev => prev.map(p => (p.no === no ? { ...p, [field]: value } : p)))
  }

  function save() {
    setMsg(null)
    startTransition(async () => {
      const res = await saveSchedule({ periods, slots })
      setMsg(res.error ? { text: res.error } : { ok: true, text: 'Kaydedildi' })
    })
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Ders Programım</h1>
          {subject && <p className="text-sm text-gray-500 dark:text-slate-400">{subject}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditTimes(v => !v)}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            {editTimes ? 'Saatleri gizle' : 'Zil saatlerini düzenle'}
          </button>
          <button
            onClick={save}
            disabled={pending}
            className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>

      {msg && (
        <p className={`mb-3 text-sm ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {msg.text}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left text-gray-500 dark:text-slate-400 font-medium w-28">Ders</th>
              {DAYS.map(d => (
                <th key={d.n} className="p-2 text-left text-gray-700 dark:text-slate-200 font-semibold min-w-[120px]">{d.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map(p => (
              <tr key={p.no} className="border-t border-gray-100 dark:border-slate-800">
                <td className="p-2 align-top">
                  <div className="font-semibold text-gray-800 dark:text-slate-200">{p.no}. ders</div>
                  {editTimes ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input type="time" value={p.start} onChange={e => setPeriodTime(p.no, 'start', e.target.value)}
                        className="w-[72px] text-xs border rounded px-1 py-0.5 dark:bg-slate-800 dark:border-slate-600" />
                      <span className="text-gray-400">–</span>
                      <input type="time" value={p.end} onChange={e => setPeriodTime(p.no, 'end', e.target.value)}
                        className="w-[72px] text-xs border rounded px-1 py-0.5 dark:bg-slate-800 dark:border-slate-600" />
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{p.start}–{p.end}</div>
                  )}
                </td>
                {DAYS.map(d => (
                  <td key={d.n} className="p-1 align-top">
                    <select
                      value={cellClass(d.n, p.no)}
                      onChange={e => setCell(d.n, p.no, e.target.value)}
                      className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200"
                    >
                      <option value="">—</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {classes.length === 0 && (
        <p className="mt-4 text-sm text-gray-500 dark:text-slate-400">Okulda kayıtlı sınıf yok. Önce sınıf eklenmeli.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Sidebar'a nav linki ekle**

`components/layout/Sidebar.tsx` — `navItems` dizisinde `/yoklama` kaydından SONRA şu kaydı ekle (icon = takvim):

```tsx
  {
    href: '/ders-programi',
    label: 'Ders Programım',
    mobile: false,
    roles: ['ogretmen', 'zumre_baskani', 'mudur_yardimcisi'],
    icon: <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
```

- [ ] **Step 4: Tip kontrolü + build**

Run: `npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 5: Elle doğrula (dev)**

`npm run dev` → öğretmen olarak `/ders-programi` aç. Beklenen: 8 satırlı (varsayılan saatler) Pzt–Cuma ızgarası; hücrede sınıf seç → Kaydet → "Kaydedildi"; sayfayı yenile → seçim korunuyor. "Zil saatlerini düzenle" ile saat alanları açılıp kaydediliyor.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/ders-programi/page.tsx" "app/(dashboard)/ders-programi/DersProgramiClient.tsx" components/layout/Sidebar.tsx
git commit -m "feat(schedule): /ders-programi ızgara sayfası + Sidebar linki"
```

---

### Task 5: Sabah özeti cron'u

**Files:**
- Create: `src/domains/notifications/functions/dersProgramiOzeti.ts`
- Modify: `app/api/inngest/route.ts`

**Interfaces:**
- Consumes: `todaysLessons`, `formatOzetBody`, `Period`, `Slot` from `scheduleMath`; `inngest`; `createServiceClient`; `sendPushToUser`; `logger`.
- Produces: `dersProgramiOzetiFn` (Inngest fonksiyonu), route.ts kaydı.

- [ ] **Step 1: Cron fonksiyonunu yaz**

`src/domains/notifications/functions/dersProgramiOzeti.ts`:

```ts
import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { sendPushToUser } from '@/src/infrastructure/push/webpush'
import { logger } from '@/src/infrastructure/observability/logger'
import { todaysLessons, formatOzetBody, type Period, type Slot } from '@/src/domains/schedule/scheduleMath'

const DAY_MAP: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5 }

export const dersProgramiOzetiFn = inngest.createFunction(
  { id: 'ders-programi-ozeti', triggers: [{ cron: 'TZ=Europe/Istanbul 30 7 * * 1-5' }] },
  async ({ step }) => {
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', weekday: 'short' }).format(new Date())
    const today = DAY_MAP[wd]
    if (!today) return { sent: 0 } // hafta sonu güvenlik freni

    const sent = await step.run('ders-ozetleri', async () => {
      const db = createServiceClient()
      const { data: rows } = await db
        .from('lesson_schedules')
        .select('teacher_id, school_id, slots, periods')
        .not('teacher_id', 'is', null)
      if (!rows?.length) return 0

      const { data: classes } = await db.from('classes').select('id, name').is('deleted_at', null)
      const nameById = new Map((classes ?? []).map(c => [c.id as string, c.name as string]))

      const notifs: { user_id: string; school_id: string; title: string; body: string }[] = []
      const pushes: Promise<unknown>[] = []

      for (const r of rows) {
        const lessons = todaysLessons((r.slots ?? []) as unknown as Slot[], (r.periods ?? []) as unknown as Period[], today)
        if (!lessons.length) continue
        const body = formatOzetBody(lessons.map(l => ({ period: l.period, className: nameById.get(l.classId) ?? '?' })))
        notifs.push({ user_id: r.teacher_id as string, school_id: r.school_id as string, title: 'Bugünün dersleri', body })
        pushes.push(sendPushToUser(r.teacher_id as string, { title: 'Bugünün dersleri', body, url: '/ders-programi' }))
      }

      if (notifs.length) await db.from('notifications').insert(notifs)
      const results = await Promise.allSettled(pushes)
      const failed = results.filter(x => x.status === 'rejected').length
      if (failed) logger.error({ event: 'ders_programi_ozeti_push_failed', failed }, 'Ders programı özet push hatası')
      return notifs.length
    })

    return { sent }
  },
)
```

- [ ] **Step 2: route.ts'e kaydet**

`app/api/inngest/route.ts` — import ekle ve `functions` dizisine `dersProgramiOzetiFn` ekle:

```ts
import { dersProgramiOzetiFn } from '@/src/domains/notifications/functions/dersProgramiOzeti'
```
```ts
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [homeworkReminderFn, veliAbsenceNotifierFn, aylikBultenFn, odevSonrasiVeliNotifierFn, homeworkCreatedNotifierFn, yoklamaHatirlaticiFn, dersProgramiOzetiFn],
})
```

- [ ] **Step 3: Tip kontrolü + birim testler**

Run: `npx tsc --noEmit && npm run test:unit`
Expected: 0 TS hatası; tüm birim testler yeşil (cron'un saf mantığı `scheduleMath` testlerinde zaten kapsanıyor — `yoklamaHatirlatici` deseni gibi fonksiyon gövdesi ayrıca unit edilmez).

- [ ] **Step 4: Commit**

```bash
git add src/domains/notifications/functions/dersProgramiOzeti.ts app/api/inngest/route.ts
git commit -m "feat(schedule): sabah ders özeti cron'u (07:30 hafta içi)"
```

---

## Notlar (faz dışı)

- **Faz 2 (ayrı spec):** ASC TimeTables fotoğrafından OCR ile `slots` ön-doldurma — `DersProgramiClient` aynı ızgarayı düzeltme/onay arayüzü olarak kullanır; şema değişmez.
- **E2E (opsiyonel):** `tests/playwright/` altına `ders-programi.spec.ts` — öğretmen hücre seçer/kaydeder/yeniden yüklemede görür. `global-setup` öğretmen+sınıf seed'i mevcut.
