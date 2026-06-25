# Veli Görüşme Randevu Defteri — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Öğretmenin ders programındaki boş saatlerine göre tarihli veli görüşme randevuları kaydedebileceği kişisel bir defter (`/randevular`).

**Architecture:** `tasks` feature'ının birebir pattern'i: tek tablo `parent_meetings` (sahip-özel RLS) + saf math modülü (boş-saat hesabı) + Repository + Service + server actions + tek sayfa/modal. Boş-saat hesabı tamamen istemcide, öğretmenin ders programı slot'larından türetilir; sunucuya ekstra sorgu yok.

**Tech Stack:** Next.js App Router (server components + server actions), Supabase (RLS, typed client), Zod, Vitest (unit), Playwright (e2e), Tailwind.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-25-veli-gorusme-randevu-design.md`.
- Tüm UI metinleri Türkçe, tam ortografik doğrulukla (ç, ğ, ı, ö, ş, ü).
- Tenant izolasyonu + sahiplik: her sorgu `school_id = current_school_id() AND teacher_id = auth.uid()`.
- Server action dönüş tipi: `ActionResult` (`@/src/shared/types/index`).
- Repository normal kullanıcı client'ı kullanır (`@/src/infrastructure/supabase/server` → `createClient`), RLS uygulansın.
- Service `requireAbility()` (`@/src/shared/authorization/server`) ile `userId`/`schoolId` alır; hatayı `logger` (`@/src/infrastructure/observability/logger`) ile loglar, sessizce yutmaz.
- Migration sonrası `database.types.ts` (`src/infrastructure/supabase/database.types.ts`) **zorunlu** yeniden üretilir, yoksa `tsc` kırılır.
- `period` değer alanı 1..9 (ders programı periyot numarası); saat aralığı `DEFAULT_PERIODS`/`periods` üzerinden çözülür, ayrıca saklanmaz.
- Kapsam dışı (v1 değil): veli bildirimi, müdür görünümü/raporu, okul-dışı serbest saat, tekrarlayan görüşme.

---

## File Structure

- `supabase/migrations/20260625120000_parent_meetings.sql` — tablo + RLS + index + updated_at trigger.
- `src/infrastructure/supabase/database.types.ts` — regenerate (parent_meetings tipleri).
- `src/domains/meetings/parentMeetingMath.ts` — saf fonksiyonlar (status tipi, weekdayFromDate, freePeriods).
- `src/domains/meetings/repositories/MeetingRepository.ts` — CRUD + öğrenci seçenekleri sorgusu.
- `src/domains/meetings/services/MeetingService.ts` — iş kuralları (requireAbility, logging).
- `app/actions/meetings.ts` — server actions (Zod doğrulama).
- `app/(dashboard)/randevular/page.tsx` — server component (rol guard + veri yükleme).
- `app/(dashboard)/randevular/RandevularClient.tsx` — liste + modal (client).
- `components/layout/Sidebar.tsx` — nav öğesi (modify).
- `tests/vitest/unit/meetings/parentMeetingMath.test.ts` — math birim testleri.
- `tests/playwright/e2e/randevular.spec.ts` — happy-path e2e.

---

### Task 1: Migration + tipler

**Files:**
- Create: `supabase/migrations/20260625120000_parent_meetings.sql`
- Modify: `src/infrastructure/supabase/database.types.ts` (regenerate)

**Interfaces:**
- Produces: `public.parent_meetings` tablosu — kolonlar: `id uuid`, `school_id uuid`, `teacher_id uuid`, `student_id uuid`, `meet_date date`, `period int (1..9)`, `status text ('planlandi'|'yapildi'|'iptal')`, `note text`, `created_at timestamptz`, `updated_at timestamptz`.

- [ ] **Step 1: Migration dosyasını yaz**

`supabase/migrations/20260625120000_parent_meetings.sql`:

```sql
-- Veli görüşme randevu defteri: öğretmene-özel tarihli randevular.
-- Patern: tasks (current_school_id() + auth.uid(), tek "own" policy).

create table if not exists public.parent_meetings (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id)   on delete cascade,
  teacher_id  uuid not null references public.profiles(id)  on delete cascade,
  student_id  uuid not null references public.students(id)  on delete cascade,
  meet_date   date not null,
  period      int  not null check (period between 1 and 9),
  status      text not null default 'planlandi'
              check (status in ('planlandi', 'yapildi', 'iptal')),
  note        text check (note is null or char_length(note) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Aynı slota iki aktif randevu olmasın (iptal hariç).
create unique index if not exists parent_meetings_slot_uniq
  on public.parent_meetings (teacher_id, meet_date, period)
  where status <> 'iptal';

-- En sık sorgu: öğretmenin randevuları, tarihe göre.
create index if not exists idx_parent_meetings_teacher_date
  on public.parent_meetings (teacher_id, meet_date);

-- FK kapsama indexleri (mevcut hot_fk_covering_indexes pratiği).
create index if not exists idx_parent_meetings_student
  on public.parent_meetings (student_id);

alter table public.parent_meetings enable row level security;

-- Sahip-özel: yalnız kendi okulundaki kendi satırların (okuma+yazma tek policy).
create policy "parent_meetings_own" on public.parent_meetings
  for all to authenticated
  using (school_id = current_school_id() and teacher_id = auth.uid())
  with check (school_id = current_school_id() and teacher_id = auth.uid());

-- updated_at trigger (mevcut update_*_updated_at pattern'i ile aynı imza).
create or replace function public.update_parent_meetings_updated_at()
returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger parent_meetings_updated_at
  before update on public.parent_meetings
  for each row execute function public.update_parent_meetings_updated_at();
```

- [ ] **Step 2: Migration'ı uygula**

Supabase MCP `apply_migration` ile uygula (name: `parent_meetings`, query: yukarıdaki SQL). Yerel CLI varsa alternatif: `supabase db push`.

- [ ] **Step 3: Güvenlik advisor kontrolü**

Supabase MCP `get_advisors` (type: security) çalıştır.
Expected: yeni ERROR yok (`parent_meetings_own` RLS aktif). WARN'lar mevcut bilinçli-bırakılanlarla aynı kalmalı.

- [ ] **Step 4: Tipleri yeniden üret**

Supabase MCP `generate_typescript_types` çıktısını `src/infrastructure/supabase/database.types.ts` dosyasına yaz (mevcut dosyayı tamamen değiştir).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: 0 hata; `database.types.ts` içinde `parent_meetings` Row/Insert/Update tipleri görünür.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260625120000_parent_meetings.sql src/infrastructure/supabase/database.types.ts
git commit -m "feat(randevular): parent_meetings tablosu + RLS + tip regen"
```

---

### Task 2: Saf math modülü — boş-saat hesabı

**Files:**
- Create: `src/domains/meetings/parentMeetingMath.ts`
- Test: `tests/vitest/unit/meetings/parentMeetingMath.test.ts`

**Interfaces:**
- Consumes: `Period`, `Slot` from `@/src/domains/schedule/scheduleMath` (`Period = { no: number; start: string; end: string }`, `Slot = { day: number; period: number; class_id: string }`).
- Produces:
  - `type MeetingStatus = 'planlandi' | 'yapildi' | 'iptal'`
  - `weekdayFromDate(isoDate: string): number` — 'YYYY-MM-DD' → 1=Pzt..7=Paz (UTC tabanlı, tz-bağımsız).
  - `freePeriods(slots: Slot[], periods: Period[], weekday: number, bookedPeriods: number[]): Period[]`

- [ ] **Step 1: Failing test yaz**

`tests/vitest/unit/meetings/parentMeetingMath.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { weekdayFromDate, freePeriods } from '@/src/domains/meetings/parentMeetingMath'
import type { Period, Slot } from '@/src/domains/schedule/scheduleMath'

const periods: Period[] = [
  { no: 1, start: '09:00', end: '09:35' },
  { no: 2, start: '09:45', end: '10:20' },
  { no: 3, start: '10:25', end: '11:00' },
]

describe('weekdayFromDate()', () => {
  it('2026-06-22 (Pazartesi) → 1', () => expect(weekdayFromDate('2026-06-22')).toBe(1))
  it('2026-06-26 (Cuma) → 5', () => expect(weekdayFromDate('2026-06-26')).toBe(5))
  it('2026-06-27 (Cumartesi) → 6', () => expect(weekdayFromDate('2026-06-27')).toBe(6))
  it('2026-06-28 (Pazar) → 7', () => expect(weekdayFromDate('2026-06-28')).toBe(7))
})

describe('freePeriods()', () => {
  const slots: Slot[] = [
    { day: 1, period: 1, class_id: 'c1' }, // Pzt 1. ders dolu
    { day: 1, period: 3, class_id: 'c2' }, // Pzt 3. ders dolu
    { day: 2, period: 1, class_id: 'c1' }, // Salı 1. ders dolu
  ]

  it('Pazartesi → sadece 2. ders boş', () => {
    const free = freePeriods(slots, periods, 1, [])
    expect(free.map(p => p.no)).toEqual([2])
  })

  it('boş periyot zaten rezerve → çıkar', () => {
    const free = freePeriods(slots, periods, 1, [2])
    expect(free).toHaveLength(0)
  })

  it('hafta sonu (weekday 6) → boş dizi', () => {
    expect(freePeriods(slots, periods, 6, [])).toHaveLength(0)
  })

  it('hiç ders olmayan gün → tüm periyotlar boş', () => {
    const free = freePeriods(slots, periods, 5, [])
    expect(free.map(p => p.no)).toEqual([1, 2, 3])
  })

  it('tam dolu gün → boş dizi', () => {
    const fullSlots: Slot[] = periods.map(p => ({ day: 3, period: p.no, class_id: 'c1' }))
    expect(freePeriods(fullSlots, periods, 3, [])).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Testi çalıştır, fail gör**

Run: `npm run test:unit -- parentMeetingMath`
Expected: FAIL ("Cannot find module '@/src/domains/meetings/parentMeetingMath'").

- [ ] **Step 3: Minimal implementasyon**

`src/domains/meetings/parentMeetingMath.ts`:

```ts
import type { Period, Slot } from '@/src/domains/schedule/scheduleMath'

export type MeetingStatus = 'planlandi' | 'yapildi' | 'iptal'

// 'YYYY-MM-DD' → 1=Pazartesi .. 7=Pazar. UTC tabanlı (yerel saat dilimi etkilemesin).
export function weekdayFromDate(isoDate: string): number {
  const js = new Date(`${isoDate}T00:00:00Z`).getUTCDay() // 0=Pazar .. 6=Cumartesi
  return js === 0 ? 7 : js
}

// Seçilen güne ait müsait periyotlar: ders programında dolu olmayan + rezerve olmayan.
// Hafta sonu (weekday ∉ 1..5) → boş.
export function freePeriods(
  slots: Slot[],
  periods: Period[],
  weekday: number,
  bookedPeriods: number[],
): Period[] {
  if (weekday < 1 || weekday > 5) return []
  const taken = new Set<number>([
    ...slots.filter(s => s.day === weekday).map(s => s.period),
    ...bookedPeriods,
  ])
  return periods.filter(p => !taken.has(p.no))
}
```

- [ ] **Step 4: Testi çalıştır, pass gör**

Run: `npm run test:unit -- parentMeetingMath`
Expected: PASS (tüm testler yeşil).

- [ ] **Step 5: Commit**

```bash
git add src/domains/meetings/parentMeetingMath.ts tests/vitest/unit/meetings/parentMeetingMath.test.ts
git commit -m "feat(randevular): boş-saat hesabı (parentMeetingMath) + birim testler"
```

---

### Task 3: Repository + Service

**Files:**
- Create: `src/domains/meetings/repositories/MeetingRepository.ts`
- Create: `src/domains/meetings/services/MeetingService.ts`

**Interfaces:**
- Consumes: `requireAbility()` → `{ userId: string; schoolId: string }`; `logger`; `MeetingStatus` from `../parentMeetingMath`.
- Produces (Service):
  - `type Meeting = { id: string; student_id: string; student_name: string; class_name: string | null; meet_date: string; period: number; status: MeetingStatus; note: string | null }`
  - `type StudentOption = { id: string; full_name: string; class_id: string; class_name: string | null }`
  - `MeetingService.getMyMeetings(): Promise<Meeting[]>`
  - `MeetingService.getStudentOptions(classIds: string[]): Promise<StudentOption[]>`
  - `MeetingService.create(input: { studentId: string; meetDate: string; period: number; note: string | null }): Promise<{ error?: string; id?: string }>`
  - `MeetingService.updateStatus(id: string, status: MeetingStatus): Promise<{ error?: string }>`
  - `MeetingService.remove(id: string): Promise<{ error?: string }>`

- [ ] **Step 1: Repository yaz**

`src/domains/meetings/repositories/MeetingRepository.ts`:

```ts
import { createClient } from '@/src/infrastructure/supabase/server'
import type { MeetingStatus } from '../parentMeetingMath'

// Not: createClient (kullanıcı oturumu) → RLS "parent_meetings_own" politikasını uygular.
export const MeetingRepository = {
  async listForTeacher(teacherId: string, schoolId: string) {
    const db = await createClient()
    return db
      .from('parent_meetings')
      .select('id, student_id, meet_date, period, status, note, students(full_name, class_id, classes(name))')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .order('meet_date', { ascending: true })
      .order('period', { ascending: true })
      .limit(1000)
  },

  async listStudentsByClassIds(classIds: string[], schoolId: string) {
    if (classIds.length === 0) return { data: [], error: null }
    const db = await createClient()
    return db
      .from('students')
      .select('id, full_name, class_id, classes(name)')
      .in('class_id', classIds)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('full_name')
      .limit(2000)
  },

  async insert(row: {
    teacher_id: string
    school_id: string
    student_id: string
    meet_date: string
    period: number
    note: string | null
  }) {
    const db = await createClient()
    return db.from('parent_meetings').insert(row).select('id').single()
  },

  async updateStatus(id: string, teacherId: string, status: MeetingStatus) {
    const db = await createClient()
    return db
      .from('parent_meetings')
      .update({ status })
      .eq('id', id)
      .eq('teacher_id', teacherId)
  },

  async deleteById(id: string, teacherId: string) {
    const db = await createClient()
    return db.from('parent_meetings').delete().eq('id', id).eq('teacher_id', teacherId)
  },
}
```

- [ ] **Step 2: Service yaz**

`src/domains/meetings/services/MeetingService.ts`:

```ts
import { requireAbility } from '@/src/shared/authorization/server'
import { logger } from '@/src/infrastructure/observability/logger'
import { MeetingRepository } from '../repositories/MeetingRepository'
import type { MeetingStatus } from '../parentMeetingMath'

export interface Meeting {
  id: string
  student_id: string
  student_name: string
  class_name: string | null
  meet_date: string
  period: number
  status: MeetingStatus
  note: string | null
}

export interface StudentOption {
  id: string
  full_name: string
  class_id: string
  class_name: string | null
}

// Supabase join satır şekli (students(...) / classes(...) tek-nesne döner).
type MeetingRow = {
  id: string
  student_id: string
  meet_date: string
  period: number
  status: MeetingStatus
  note: string | null
  students: { full_name: string; class_id: string; classes: { name: string } | null } | null
}

type StudentRow = {
  id: string
  full_name: string
  class_id: string
  classes: { name: string } | null
}

export const MeetingService = {
  async getMyMeetings(): Promise<Meeting[]> {
    const ability = await requireAbility()
    const { data, error } = await MeetingRepository.listForTeacher(ability.userId, ability.schoolId)
    if (error) {
      logger.error({ event: 'meeting_list_failed', userId: ability.userId, err: error.message }, 'Randevu listesi okuma hatası')
      return []
    }
    return ((data ?? []) as unknown as MeetingRow[]).map(r => ({
      id: r.id,
      student_id: r.student_id,
      student_name: r.students?.full_name ?? '—',
      class_name: r.students?.classes?.name ?? null,
      meet_date: r.meet_date,
      period: r.period,
      status: r.status,
      note: r.note,
    }))
  },

  async getStudentOptions(classIds: string[]): Promise<StudentOption[]> {
    const ability = await requireAbility()
    const { data, error } = await MeetingRepository.listStudentsByClassIds(classIds, ability.schoolId)
    if (error) {
      logger.error({ event: 'meeting_students_failed', userId: ability.userId, err: error.message }, 'Öğrenci seçenekleri okuma hatası')
      return []
    }
    return ((data ?? []) as unknown as StudentRow[]).map(s => ({
      id: s.id,
      full_name: s.full_name,
      class_id: s.class_id,
      class_name: s.classes?.name ?? null,
    }))
  },

  async create(input: { studentId: string; meetDate: string; period: number; note: string | null }): Promise<{ error?: string; id?: string }> {
    const ability = await requireAbility()
    const { data, error } = await MeetingRepository.insert({
      teacher_id: ability.userId,
      school_id: ability.schoolId,
      student_id: input.studentId,
      meet_date: input.meetDate,
      period: input.period,
      note: input.note,
    })
    if (error || !data) {
      // 23505 = unique_violation → slot zaten dolu.
      if (error?.code === '23505') return { error: 'Bu tarih ve saatte zaten bir randevun var' }
      logger.error({ event: 'meeting_create_failed', userId: ability.userId, err: error?.message }, 'Randevu ekleme hatası')
      return { error: 'Randevu kaydedilemedi' }
    }
    return { id: (data as { id: string }).id }
  },

  async updateStatus(id: string, status: MeetingStatus): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { error } = await MeetingRepository.updateStatus(id, ability.userId, status)
    if (error) {
      logger.error({ event: 'meeting_status_failed', userId: ability.userId, err: error.message }, 'Randevu durum güncelleme hatası')
      return { error: 'Randevu güncellenemedi' }
    }
    return {}
  },

  async remove(id: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { error } = await MeetingRepository.deleteById(id, ability.userId)
    if (error) {
      logger.error({ event: 'meeting_delete_failed', userId: ability.userId, err: error.message }, 'Randevu silme hatası')
      return { error: 'Randevu silinemedi' }
    }
    return {}
  },
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: 0 hata. (Join satır tipleri `as unknown as` ile daraltıldı — mevcut kod tabanı pratiği.)

- [ ] **Step 4: Commit**

```bash
git add src/domains/meetings/repositories/MeetingRepository.ts src/domains/meetings/services/MeetingService.ts
git commit -m "feat(randevular): MeetingRepository + MeetingService"
```

---

### Task 4: Server actions

**Files:**
- Create: `app/actions/meetings.ts`

**Interfaces:**
- Consumes: `MeetingService` (Task 3); `ActionResult` from `@/src/shared/types/index`.
- Produces:
  - `createMeeting(input: unknown): Promise<ActionResult<{ id?: string }>>`
  - `setMeetingStatus(input: unknown): Promise<ActionResult>`
  - `deleteMeeting(id: unknown): Promise<ActionResult>`

- [ ] **Step 1: Action dosyasını yaz**

`app/actions/meetings.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { MeetingService } from '@/src/domains/meetings/services/MeetingService'
import type { ActionResult } from '@/src/shared/types/index'

const createSchema = z.object({
  studentId: z.string().uuid('Geçersiz öğrenci'),
  meetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih'),
  period: z.number().int().min(1).max(9),
  note: z.string().trim().max(1000).nullish(),
})

const statusSchema = z.object({
  id: z.string().uuid('Geçersiz randevu kimliği'),
  status: z.enum(['planlandi', 'yapildi', 'iptal']),
})

const idSchema = z.string().uuid('Geçersiz randevu kimliği')

export async function createMeeting(input: unknown): Promise<ActionResult<{ id?: string }>> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await MeetingService.create({
    studentId: parsed.data.studentId,
    meetDate: parsed.data.meetDate,
    period: parsed.data.period,
    note: parsed.data.note ?? null,
  })
  if (result.error) return { error: result.error }

  revalidatePath('/randevular')
  return { id: result.id }
}

export async function setMeetingStatus(input: unknown): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await MeetingService.updateStatus(parsed.data.id, parsed.data.status)
  if (result.error) return { error: result.error }

  revalidatePath('/randevular')
  return {}
}

export async function deleteMeeting(id: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await MeetingService.remove(parsed.data)
  if (result.error) return { error: result.error }

  revalidatePath('/randevular')
  return {}
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: 0 hata. `ActionResult<{ id?: string }>` generic'i mevcut tiple uyumlu (bkz. `app/actions/tasks.ts` `createTask`).

- [ ] **Step 3: Commit**

```bash
git add app/actions/meetings.ts
git commit -m "feat(randevular): server actions (create/status/delete)"
```

---

### Task 5: Sayfa + client (liste + modal)

**Files:**
- Create: `app/(dashboard)/randevular/page.tsx`
- Create: `app/(dashboard)/randevular/RandevularClient.tsx`

**Interfaces:**
- Consumes: `getCurrentProfile`, `isTeachingRole` from `@/src/shared/...` (bkz. ders-programi/page.tsx); `ScheduleService.getMySchedule()`; `MeetingService.getMyMeetings()` + `getStudentOptions(classIds)`; `freePeriods`, `weekdayFromDate` (Task 2); actions (Task 4); `Period`, `Slot` tipleri.
- Produces: `/randevular` route, teaching roller için.

- [ ] **Step 1: Server component (page.tsx) yaz**

`app/(dashboard)/randevular/page.tsx`:

```tsx
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import { isTeachingRole } from '@/src/shared/types'
import { ScheduleService } from '@/src/domains/schedule/services/ScheduleService'
import { MeetingService } from '@/src/domains/meetings/services/MeetingService'
import RandevularClient from './RandevularClient'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Veli Görüşmeleri' }

export default async function RandevularPage() {
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')
  if (!isTeachingRole(profile.role)) redirect('/anasayfa')

  const { periods, slots } = await ScheduleService.getMySchedule()
  // Öğretmenin ders verdiği sınıflar = programındaki slot'ların class_id'leri (boşluk hesabı da buna dayanır).
  const classIds = Array.from(new Set(slots.map(s => s.class_id)))
  const [meetings, students] = await Promise.all([
    MeetingService.getMyMeetings(),
    MeetingService.getStudentOptions(classIds),
  ])

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <RandevularClient
        periods={periods}
        slots={slots}
        meetings={meetings}
        students={students}
      />
    </div>
  )
}
```

- [ ] **Step 2: Client component (RandevularClient.tsx) yaz**

`app/(dashboard)/randevular/RandevularClient.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Period, Slot } from '@/src/domains/schedule/scheduleMath'
import type { Meeting, StudentOption } from '@/src/domains/meetings/services/MeetingService'
import type { MeetingStatus } from '@/src/domains/meetings/parentMeetingMath'
import { freePeriods, weekdayFromDate } from '@/src/domains/meetings/parentMeetingMath'
import { createMeeting, setMeetingStatus, deleteMeeting } from '@/app/actions/meetings'

const STATUS_LABEL: Record<MeetingStatus, string> = {
  planlandi: 'Planlandı',
  yapildi: 'Yapıldı',
  iptal: 'İptal',
}
const STATUS_BADGE: Record<MeetingStatus, string> = {
  planlandi: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  yapildi: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  iptal: 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400',
}

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', weekday: 'short', timeZone: 'UTC',
  })

export default function RandevularClient({
  periods, slots, meetings, students,
}: {
  periods: Period[]
  slots: Slot[]
  meetings: Meeting[]
  students: StudentOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Form state
  const [date, setDate] = useState('')
  const [period, setPeriod] = useState<number | ''>('')
  const [studentId, setStudentId] = useState('')
  const [note, setNote] = useState('')

  const periodLabel = (no: number) => {
    const p = periods.find(x => x.no === no)
    return p ? `${no}. ders · ${p.start}–${p.end}` : `${no}. ders`
  }

  // Seçilen tarihe zaten rezerve periyotlar (iptal hariç).
  const bookedPeriods = useMemo(
    () => meetings.filter(m => m.meet_date === date && m.status !== 'iptal').map(m => m.period),
    [meetings, date],
  )
  const available = useMemo(() => {
    if (!date) return []
    return freePeriods(slots, periods, weekdayFromDate(date), bookedPeriods)
  }, [date, slots, periods, bookedPeriods])

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = meetings.filter(m => m.meet_date >= today && m.status !== 'iptal')
  const past = meetings.filter(m => m.meet_date < today || m.status === 'iptal')

  function resetForm() {
    setDate(''); setPeriod(''); setStudentId(''); setNote(''); setErr(null)
  }

  async function submit() {
    setErr(null)
    if (!date || period === '' || !studentId) {
      setErr('Tarih, saat ve öğrenci zorunlu')
      return
    }
    setBusy(true)
    const res = await createMeeting({ studentId, meetDate: date, period: Number(period), note: note || null })
    setBusy(false)
    if (res.error) { setErr(res.error); return }
    setOpen(false); resetForm(); router.refresh()
  }

  async function changeStatus(id: string, status: MeetingStatus) {
    setErr(null)
    const res = await setMeetingStatus({ id, status })
    if (res.error) { setErr(res.error); return }
    router.refresh()
  }

  async function remove(id: string) {
    setErr(null)
    const res = await deleteMeeting(id)
    if (res.error) { setErr(res.error); return }
    router.refresh()
  }

  const renderRow = (m: Meeting) => (
    <li key={m.id} className="flex flex-wrap items-center gap-2 py-3 border-b border-gray-100 dark:border-slate-800">
      <span className="font-medium">{m.student_name}</span>
      {m.class_name && <span className="text-sm text-gray-500 dark:text-slate-400">{m.class_name}</span>}
      <span className="text-sm text-gray-600 dark:text-slate-300">· {fmtDate(m.meet_date)} · {periodLabel(m.period)}</span>
      <span className={`ml-auto text-xs px-2 py-0.5 rounded ${STATUS_BADGE[m.status]}`}>{STATUS_LABEL[m.status]}</span>
      {m.note && <p className="w-full text-sm text-gray-500 dark:text-slate-400">{m.note}</p>}
      <div className="w-full flex gap-3 text-sm">
        {m.status === 'planlandi' && (
          <>
            <button onClick={() => changeStatus(m.id, 'yapildi')} className="text-green-600 hover:underline">Yapıldı</button>
            <button onClick={() => changeStatus(m.id, 'iptal')} className="text-gray-500 hover:underline">İptal</button>
          </>
        )}
        <button onClick={() => remove(m.id)} className="text-red-600 hover:underline">Sil</button>
      </div>
    </li>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Veli Görüşmeleri</h1>
        <button
          onClick={() => { resetForm(); setOpen(true) }}
          className="px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
        >
          Yeni Randevu
        </button>
      </div>

      {err && !open && <p className="mb-3 text-sm text-red-600">{err}</p>}

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 mb-2">Yaklaşan</h2>
        {upcoming.length === 0
          ? <p className="text-sm text-gray-500 dark:text-slate-400">Yaklaşan randevun yok.</p>
          : <ul>{upcoming.map(renderRow)}</ul>}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 mb-2">Geçmiş</h2>
        {past.length === 0
          ? <p className="text-sm text-gray-500 dark:text-slate-400">Geçmiş randevu yok.</p>
          : <ul>{past.map(renderRow)}</ul>}
      </section>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-lg p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Yeni Randevu</h2>

            <label className="block text-sm mb-1">Tarih</label>
            <input
              type="date" value={date} min={today}
              onChange={e => { setDate(e.target.value); setPeriod('') }}
              className="w-full mb-3 border rounded px-2 py-1.5 dark:bg-slate-800 dark:border-slate-700"
            />

            <label className="block text-sm mb-1">Saat</label>
            {date && available.length === 0
              ? <p className="mb-3 text-sm text-amber-600">Bu gün boş saatin yok.</p>
              : (
                <select
                  value={period} disabled={!date}
                  onChange={e => setPeriod(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full mb-3 border rounded px-2 py-1.5 dark:bg-slate-800 dark:border-slate-700"
                >
                  <option value="">{date ? 'Saat seç' : 'Önce tarih seç'}</option>
                  {available.map(p => <option key={p.no} value={p.no}>{periodLabel(p.no)}</option>)}
                </select>
              )}

            <label className="block text-sm mb-1">Öğrenci</label>
            <select
              value={studentId} onChange={e => setStudentId(e.target.value)}
              className="w-full mb-3 border rounded px-2 py-1.5 dark:bg-slate-800 dark:border-slate-700"
            >
              <option value="">Öğrenci seç</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.full_name}{s.class_name ? ` (${s.class_name})` : ''}</option>
              ))}
            </select>

            <label className="block text-sm mb-1">Not (opsiyonel)</label>
            <textarea
              value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={1000}
              className="w-full mb-3 border rounded px-2 py-1.5 dark:bg-slate-800 dark:border-slate-700"
            />

            {err && <p className="mb-3 text-sm text-red-600">{err}</p>}

            <div className="flex justify-end gap-3">
              <button onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-gray-600 dark:text-slate-300">Vazgeç</button>
              <button onClick={submit} disabled={busy} className="px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
                {busy ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: 0 hata. (`getCurrentProfile`/`isTeachingRole` import yollarını `app/(dashboard)/ders-programi/page.tsx` ile birebir doğrula; farklıysa eşitle.)

- [ ] **Step 4: Manuel duman testi**

Run: `npm run dev` → öğretmen olarak giriş → `/randevular`.
Expected: sayfa açılır, "Yeni Randevu" → tarih seçince boş saatler dolu derslere göre filtreli gelir; kayıt sonrası "Yaklaşan" listesinde görünür.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/randevular/page.tsx" "app/(dashboard)/randevular/RandevularClient.tsx"
git commit -m "feat(randevular): liste + yeni randevu modalı sayfası"
```

---

### Task 6: Sidebar nav öğesi

**Files:**
- Modify: `components/layout/Sidebar.tsx` (navItems dizisi, ~satır 67-72 "Ders Programım" öğesinden sonra)

**Interfaces:**
- Consumes: mevcut `navItems` yapısı `{ href, label, mobile, roles, icon }`.

- [ ] **Step 1: navItems'a öğe ekle**

`components/layout/Sidebar.tsx` — "Ders Programım" nesnesinden hemen sonra şu nesneyi ekle:

```tsx
  {
    href: '/randevular',
    label: 'Veli Görüşmeleri',
    mobile: false,
    roles: ['ogretmen', 'zumre_baskani'],
    icon: <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  },
```

- [ ] **Step 2: Typecheck + duman testi**

Run: `npm run typecheck`
Expected: 0 hata. Dev'de öğretmen menüsünde "Veli Görüşmeleri" görünür, müdür menüsünde görünmez.

- [ ] **Step 3: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat(randevular): sidebar nav öğesi (teaching roller)"
```

---

### Task 7: Playwright e2e (happy-path)

**Files:**
- Create: `tests/playwright/e2e/randevular.spec.ts`

**Interfaces:**
- Consumes: `TEST_EMAIL_OGRETMEN` / `TEST_PASSWORD_OGRETMEN` env (bkz. `auth-flow.spec.ts`).

- [ ] **Step 1: Spec yaz**

`tests/playwright/e2e/randevular.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const email    = process.env.TEST_EMAIL_OGRETMEN    ?? 'test_ogretmen@test.example'
const password = process.env.TEST_PASSWORD_OGRETMEN ?? 'Test1234!'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(anasayfa)?$/)
}

test.describe('Veli Görüşmeleri', () => {
  test('sayfa açılır ve yeni randevu modalı çalışır', async ({ page }) => {
    await login(page)
    await page.goto('/randevular')
    await expect(page.getByRole('heading', { name: 'Veli Görüşmeleri' })).toBeVisible()

    await page.getByRole('button', { name: 'Yeni Randevu' }).click()
    await expect(page.getByRole('heading', { name: 'Yeni Randevu' })).toBeVisible()
    // Tarih girişi görünür (boş-saat hesabının tetikleyicisi).
    await expect(page.locator('input[type="date"]')).toBeVisible()
  })
})
```

- [ ] **Step 2: Çalıştır**

Run: `npm run test:e2e -- randevular`
Expected: PASS. (Test öğretmeni hesabı / dev sunucusu hazır olmalı — diğer e2e'lerle aynı önkoşul.)

- [ ] **Step 3: Commit**

```bash
git add tests/playwright/e2e/randevular.spec.ts
git commit -m "test(randevular): happy-path e2e"
```

---

## Self-Review

**Spec coverage:**
- Veri modeli (parent_meetings + UNIQUE + RLS) → Task 1 ✓
- Boş-saat mantığı (freePeriods, weekday) → Task 2 ✓
- Repository/Service CRUD + öğrenci seçenekleri → Task 3 ✓
- Server actions (create/status/delete) → Task 4 ✓
- Sayfa + modal + liste (yaklaşan/geçmiş, durum, boş-saat dropdown) → Task 5 ✓
- Sidebar girişi → Task 6 ✓
- Test: math birim + e2e happy-path → Task 2 + Task 7 ✓
- Tip regen zorunluluğu → Task 1 Step 4 ✓
- Kapsam dışı maddeler hiçbir task'ta yok ✓

**Type consistency:** `MeetingStatus`, `Meeting`, `StudentOption` tipleri Task 3'te tanımlı; Task 4 (actions) ve Task 5 (client) aynı isim/alanları tüketiyor. `freePeriods`/`weekdayFromDate` imzaları Task 2'de sabit, Task 5'te aynı çağrılıyor. `createMeeting` input alanları (studentId/meetDate/period/note) action ↔ client ↔ service zincirinde tutarlı.

**Placeholder scan:** TBD/TODO yok; her kod adımı tam içerik.

**Not (uygulayıcı için):** Task 5 Step 3'te `getCurrentProfile`/`isTeachingRole` import yolları `ders-programi/page.tsx`'ten birebir kopyalanmalı (kod tabanında yol farklıysa ona uy). `ActionResult` generic kullanımını `app/actions/tasks.ts` doğrular.
