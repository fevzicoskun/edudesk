# Yapılacaklarım (Kişisel Aksiyon Katmanı) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Öğretmenin kafasındaki küçük işleri yakalayıp (capture) tamamlayabildiği/erteleyebildiği, anasayfaya gömülü kişisel görev katmanı eklemek.

**Architecture:** Tek tablo `tasks` (sahip-özel, RLS `current_school_id()`). Görünürlük/erteleme mantığı saf `taskMath.ts`'te (test edilebilir). Veri akışı CLAUDE.md desenine uyar: repository → service (`requireAbility`) → action (Zod → `revalidatePath`). UI iki yüzey: anasayfa capture kartı + öğrenci profili "+ Hatırlatıcı".

**Tech Stack:** Next.js App Router (React 19), Supabase SSR, TypeScript, Zod, Vitest. SQL deseni: `teacher_duties` migration'ı. Domain deseni: `src/domains/schedule` (Duty*).

## Global Constraints

- `school_id` her sorguda — asla atlanmaz. Yeni tablo `tasks` `school_id` taşır, RLS `current_school_id()` kullanır.
- `deleted_at` soft-delete deseni büyük tablolarda — `tasks` soft-delete kullanmaz (kişisel, hard-delete yeterli); FK'ler `students`/`classes`'a `ON DELETE SET NULL`.
- Server component'ler okuma için `createClient()` (`@/src/infrastructure/supabase/server`) kullanır; mutasyonlar yalnız server action üzerinden.
- Her mutasyondan sonra `revalidatePath('/anasayfa')`.
- Servislerde her zaman `requireAbility()` (`@/src/shared/authorization/server`) → `{ userId, schoolId }`.
- Action'lar `ActionResult<T>` döner (`@/src/shared/types/index`); girdi `unknown`, Zod `safeParse` ile doğrulanır.
- Hata loglama `logger` (`@/src/infrastructure/observability/logger`) ile, `{ event, userId, err }` şeklinde.
- Supabase project ID: `agijvfrcudpzsofgfogu`.
- Tarih kolonları `DATE` → string `YYYY-MM-DD`; UTC offset hatasından kaçınmak için yerel `pad` ile üretilir (toISOString DEĞİL).

---

### Task 1: `tasks` tablosu migration'ı

**Files:**
- Create: `supabase/migrations/20260624120000_tasks.sql`

**Interfaces:**
- Produces: `public.tasks` tablosu — kolonlar: `id, school_id, user_id, title, student_id, class_id, due_date, snoozed_until, done_at, created_at`. RLS politikası `tasks_own` (FOR ALL).

- [ ] **Step 1: Migration SQL'ini yaz**

`supabase/migrations/20260624120000_tasks.sql`:

```sql
-- Yapılacaklarım: kişisel görev/hatırlatıcı katmanı. Sahip-özel → katı RLS.
-- Patern: teacher_duties (current_school_id() + auth.uid()).

create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id)  on delete cascade,
  user_id       uuid not null references auth.users(id)      on delete cascade,
  title         text not null check (char_length(title) between 1 and 200),
  student_id    uuid references public.students(id) on delete set null,
  class_id      uuid references public.classes(id)  on delete set null,
  due_date      date,            -- isteğe bağlı; geçmişse "gecikti" vurgusu
  snoozed_until date,            -- ertelenirse o güne kadar gizli
  done_at       timestamptz,     -- doluysa tamamlanmış
  created_at    timestamptz not null default now()
);

-- Açık görevler en sık sorgu: kullanıcı + done_at IS NULL.
create index if not exists idx_tasks_user_open
  on public.tasks (user_id) where done_at is null;

-- Öğrenci profili yüzeyi: o öğrencinin açık görevleri.
create index if not exists idx_tasks_student
  on public.tasks (student_id) where done_at is null;

alter table public.tasks enable row level security;

-- Sahip-özel: yalnız kendi okulundaki kendi satırların (okuma+yazma tek policy).
create policy "tasks_own" on public.tasks
  for all to authenticated
  using (school_id = current_school_id() and user_id = auth.uid())
  with check (school_id = current_school_id() and user_id = auth.uid());
```

- [ ] **Step 2: Migration'ı Supabase'e uygula**

Supabase MCP `apply_migration` aracını kullan: `project_id=agijvfrcudpzsofgfogu`, `name=tasks`, `query=` yukarıdaki SQL.
Beklenen: hatasız uygulanır.

- [ ] **Step 3: Tablonun ve RLS'in oluştuğunu doğrula**

Supabase MCP `list_tables` (schema `public`) → çıktıda `tasks` görünmeli, `rls_enabled: true`.
Alternatif: `execute_sql` ile `select policyname from pg_policies where tablename='tasks';` → `tasks_own` dönmeli.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260624120000_tasks.sql
git commit -m "feat(tasks): tasks tablosu + sahip-özel RLS migration"
```

---

### Task 2: `taskMath.ts` — saf görünürlük/erteleme mantığı (TDD)

**Files:**
- Create: `src/domains/tasks/taskMath.ts`
- Test: `tests/vitest/unit/domains/tasks/taskMath.test.ts`

**Interfaces:**
- Produces:
  - `interface TaskRow { id: string; title: string; student_id: string | null; class_id: string | null; due_date: string | null; snoozed_until: string | null; done_at: string | null }`
  - `todayStr(d?: Date): string` → yerel `YYYY-MM-DD`
  - `snoozeDate(base: Date, option: 'tomorrow' | 'nextWeek'): string` → yerel `YYYY-MM-DD`
  - `isVisibleToday(t: Pick<TaskRow,'done_at'|'snoozed_until'>, today: string): boolean`
  - `isOverdue(t: Pick<TaskRow,'done_at'|'due_date'>, today: string): boolean`
  - `validateTaskTitle(title: string): string | null` → hata mesajı veya null

- [ ] **Step 1: Failing test'i yaz**

`tests/vitest/unit/domains/tasks/taskMath.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  todayStr, snoozeDate, isVisibleToday, isOverdue, validateTaskTitle,
} from '@/src/domains/tasks/taskMath'

describe('taskMath', () => {
  it('todayStr yerel YYYY-MM-DD üretir', () => {
    expect(todayStr(new Date(2026, 5, 24))).toBe('2026-06-24') // ay 0-index
  })

  it('snoozeDate yarın ve gelecek hafta', () => {
    const base = new Date(2026, 5, 24)
    expect(snoozeDate(base, 'tomorrow')).toBe('2026-06-25')
    expect(snoozeDate(base, 'nextWeek')).toBe('2026-07-01')
  })

  it('isVisibleToday: tamamlanan görünmez', () => {
    expect(isVisibleToday({ done_at: '2026-06-24T10:00:00Z', snoozed_until: null }, '2026-06-24')).toBe(false)
  })

  it('isVisibleToday: gelecek ertelemesi gizli, bugün/geçmiş görünür', () => {
    expect(isVisibleToday({ done_at: null, snoozed_until: '2026-06-25' }, '2026-06-24')).toBe(false)
    expect(isVisibleToday({ done_at: null, snoozed_until: '2026-06-24' }, '2026-06-24')).toBe(true)
    expect(isVisibleToday({ done_at: null, snoozed_until: null }, '2026-06-24')).toBe(true)
  })

  it('isOverdue: açık + due_date geçmişse', () => {
    expect(isOverdue({ done_at: null, due_date: '2026-06-23' }, '2026-06-24')).toBe(true)
    expect(isOverdue({ done_at: null, due_date: '2026-06-24' }, '2026-06-24')).toBe(false)
    expect(isOverdue({ done_at: null, due_date: null }, '2026-06-24')).toBe(false)
  })

  it('validateTaskTitle: boş ve 200+ reddedilir', () => {
    expect(validateTaskTitle('   ')).not.toBeNull()
    expect(validateTaskTitle('a'.repeat(201))).not.toBeNull()
    expect(validateTaskTitle('Velileri ara')).toBeNull()
  })
})
```

- [ ] **Step 2: Test'i çalıştır, başarısız olduğunu gör**

Run: `npx vitest run tests/vitest/unit/domains/tasks/taskMath.test.ts`
Expected: FAIL — modül bulunamadı.

- [ ] **Step 3: `taskMath.ts`'i yaz**

`src/domains/tasks/taskMath.ts`:

```ts
// Yapılacaklarım: saf görünürlük/erteleme/doğrulama mantığı (DB'siz, test edilebilir).
// Tarih string'leri 'YYYY-MM-DD'; leksikografik karşılaştırma kronolojik sıraya eştir.

export interface TaskRow {
  id: string
  title: string
  student_id: string | null
  class_id: string | null
  due_date: string | null
  snoozed_until: string | null
  done_at: string | null
}

function toStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Bugünün yerel tarihi (UTC offset hatası olmadan).
export function todayStr(d: Date = new Date()): string {
  return toStr(d)
}

// Erteleme hedef tarihi: yarın (+1) veya gelecek hafta (+7).
export function snoozeDate(base: Date, option: 'tomorrow' | 'nextWeek'): string {
  const d = new Date(base)
  d.setDate(d.getDate() + (option === 'tomorrow' ? 1 : 7))
  return toStr(d)
}

// Bugün görünür mü: açık VE (ertelenmemiş ya da erteleme günü gelmiş).
export function isVisibleToday(
  t: Pick<TaskRow, 'done_at' | 'snoozed_until'>,
  today: string,
): boolean {
  if (t.done_at) return false
  return t.snoozed_until == null || t.snoozed_until <= today
}

// Gecikmiş mi: açık VE due_date bugünden önce.
export function isOverdue(
  t: Pick<TaskRow, 'done_at' | 'due_date'>,
  today: string,
): boolean {
  if (t.done_at || t.due_date == null) return false
  return t.due_date < today
}

// Başlık doğrulama: 1–200 karakter (trim sonrası). Hata mesajı veya null.
export function validateTaskTitle(title: string): string | null {
  const t = (title ?? '').trim()
  if (t.length < 1) return 'Görev metni zorunludur'
  if (t.length > 200) return 'Görev en fazla 200 karakter olabilir'
  return null
}
```

- [ ] **Step 4: Test'i çalıştır, geçtiğini gör**

Run: `npx vitest run tests/vitest/unit/domains/tasks/taskMath.test.ts`
Expected: PASS (6 test).

- [ ] **Step 5: Commit**

```bash
git add src/domains/tasks/taskMath.ts tests/vitest/unit/domains/tasks/taskMath.test.ts
git commit -m "feat(tasks): saf görünürlük/erteleme/doğrulama mantığı (taskMath)"
```

---

### Task 3: `TaskRepository` — ham Supabase CRUD

**Files:**
- Create: `src/domains/tasks/repositories/TaskRepository.ts`

**Interfaces:**
- Consumes: `createClient` (`@/src/infrastructure/supabase/server`).
- Produces: `TaskRepository` nesnesi, metodlar: `listOpenForUser`, `listOpenForStudent`, `insert`, `setDone`, `setSnooze`, `deleteById`. Hepsi Supabase `{ data, error }` döndüren promise'ler; satır şekli `TaskRow & { created_at: string }`.

- [ ] **Step 1: `TaskRepository.ts`'i yaz**

`src/domains/tasks/repositories/TaskRepository.ts`:

```ts
import { createClient } from '@/src/infrastructure/supabase/server'

// RLS (tasks_own) zaten user_id=auth.uid() + school_id zorlar; eq filtreleri savunma katmanı.
const COLS = 'id, title, student_id, class_id, due_date, snoozed_until, done_at, created_at'

export const TaskRepository = {
  // Kullanıcının açık (done_at IS NULL) görevleri, yeni → eski.
  async listOpenForUser(userId: string, schoolId: string) {
    const db = await createClient()
    return db
      .from('tasks')
      .select(COLS)
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .is('done_at', null)
      .order('created_at', { ascending: false })
  },

  // Belirli öğrencinin açık görevleri (öğrenci profili yüzeyi).
  async listOpenForStudent(userId: string, schoolId: string, studentId: string) {
    const db = await createClient()
    return db
      .from('tasks')
      .select(COLS)
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .is('done_at', null)
      .order('created_at', { ascending: false })
  },

  // Yeni görev. Eklenen satırı id'siyle döndürür (optimistik liste için).
  async insert(row: {
    user_id: string
    school_id: string
    title: string
    student_id: string | null
    class_id: string | null
    due_date: string | null
  }) {
    const db = await createClient()
    return db.from('tasks').insert(row).select(COLS).single()
  },

  // Tamamla / geri-aç. done=true → done_at now; false → null.
  async setDone(id: string, userId: string, done: boolean) {
    const db = await createClient()
    return db
      .from('tasks')
      .update({ done_at: done ? new Date().toISOString() : null })
      .eq('id', id)
      .eq('user_id', userId)
  },

  // Ertele (untilDate) veya ertelemeyi kaldır (null).
  async setSnooze(id: string, userId: string, untilDate: string | null) {
    const db = await createClient()
    return db
      .from('tasks')
      .update({ snoozed_until: untilDate })
      .eq('id', id)
      .eq('user_id', userId)
  },

  async deleteById(id: string, userId: string) {
    const db = await createClient()
    return db.from('tasks').delete().eq('id', id).eq('user_id', userId)
  },
}
```

- [ ] **Step 2: Tip kontrolü**

Run: `npx tsc --noEmit`
Expected: hata yok.
Not: Eğer üretilen Database tipleri `tasks`'ı tanımıyorsa hata çıkarsa, Supabase MCP `generate_typescript_types` ile tipleri yenile ve projedeki tip dosyasına yaz (`DutyRepository` tipsiz çalıştığı için genelde gerek olmaz).

- [ ] **Step 3: Commit**

```bash
git add src/domains/tasks/repositories/TaskRepository.ts
git commit -m "feat(tasks): TaskRepository (ham Supabase CRUD)"
```

---

### Task 4: `TaskService` — `requireAbility` + orkestrasyon

**Files:**
- Create: `src/domains/tasks/services/TaskService.ts`

**Interfaces:**
- Consumes: `requireAbility` (`@/src/shared/authorization/server`), `logger`, `TaskRepository`, `taskMath` (`isVisibleToday`, `isOverdue`, `snoozeDate`, `todayStr`, `validateTaskTitle`, `TaskRow`).
- Produces:
  - `interface Task extends TaskRow { created_at: string; overdue: boolean }`
  - `TaskService.getMyActiveTasks(): Promise<Task[]>`
  - `TaskService.getStudentTasks(studentId: string): Promise<Task[]>`
  - `TaskService.addTask(input: { title: string; studentId?: string | null; classId?: string | null; dueDate?: string | null }): Promise<{ error?: string; task?: Task }>`
  - `TaskService.completeTask(id: string): Promise<{ error?: string }>`
  - `TaskService.reopenTask(id: string): Promise<{ error?: string }>`
  - `TaskService.snoozeTask(id: string, option: 'tomorrow' | 'nextWeek'): Promise<{ error?: string }>`
  - `TaskService.deleteTask(id: string): Promise<{ error?: string }>`

- [ ] **Step 1: `TaskService.ts`'i yaz**

`src/domains/tasks/services/TaskService.ts`:

```ts
import { requireAbility } from '@/src/shared/authorization/server'
import { logger } from '@/src/infrastructure/observability/logger'
import { TaskRepository } from '../repositories/TaskRepository'
import {
  isVisibleToday, isOverdue, snoozeDate, todayStr, validateTaskTitle, type TaskRow,
} from '../taskMath'

export interface Task extends TaskRow {
  created_at: string
  overdue: boolean
}

type Row = TaskRow & { created_at: string }

function decorate(rows: Row[]): Task[] {
  const today = todayStr()
  return rows
    .filter(r => isVisibleToday(r, today))
    .map(r => ({ ...r, overdue: isOverdue(r, today) }))
}

export const TaskService = {
  // Bugün görünür açık görevlerim.
  async getMyActiveTasks(): Promise<Task[]> {
    const ability = await requireAbility()
    const { data, error } = await TaskRepository.listOpenForUser(ability.userId, ability.schoolId)
    if (error) {
      logger.error({ event: 'task_list_failed', userId: ability.userId, err: error.message }, 'Görev listesi okuma hatası')
      return []
    }
    return decorate((data ?? []) as Row[])
  },

  // Bir öğrencinin açık görevleri (profil yüzeyi). Erteleme filtresi uygulanmaz: profilde hepsi görünür.
  async getStudentTasks(studentId: string): Promise<Task[]> {
    const ability = await requireAbility()
    const { data, error } = await TaskRepository.listOpenForStudent(ability.userId, ability.schoolId, studentId)
    if (error) {
      logger.error({ event: 'task_student_list_failed', userId: ability.userId, err: error.message }, 'Öğrenci görev listesi hatası')
      return []
    }
    const today = todayStr()
    return ((data ?? []) as Row[]).map(r => ({ ...r, overdue: isOverdue(r, today) }))
  },

  async addTask(input: {
    title: string
    studentId?: string | null
    classId?: string | null
    dueDate?: string | null
  }): Promise<{ error?: string; task?: Task }> {
    const ability = await requireAbility()

    const vErr = validateTaskTitle(input.title)
    if (vErr) return { error: vErr }

    const { data, error } = await TaskRepository.insert({
      user_id: ability.userId,
      school_id: ability.schoolId,
      title: input.title.trim(),
      student_id: input.studentId ?? null,
      class_id: input.classId ?? null,
      due_date: input.dueDate ?? null,
    })
    if (error || !data) {
      logger.error({ event: 'task_add_failed', userId: ability.userId, err: error?.message }, 'Görev ekleme hatası')
      return { error: 'Görev kaydedilemedi' }
    }
    const today = todayStr()
    return { task: { ...(data as Row), overdue: isOverdue(data as Row, today) } }
  },

  async completeTask(id: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { error } = await TaskRepository.setDone(id, ability.userId, true)
    if (error) {
      logger.error({ event: 'task_complete_failed', userId: ability.userId, err: error.message }, 'Görev tamamlama hatası')
      return { error: 'Görev güncellenemedi' }
    }
    return {}
  },

  async reopenTask(id: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { error } = await TaskRepository.setDone(id, ability.userId, false)
    if (error) {
      logger.error({ event: 'task_reopen_failed', userId: ability.userId, err: error.message }, 'Görev geri-açma hatası')
      return { error: 'Görev güncellenemedi' }
    }
    return {}
  },

  async snoozeTask(id: string, option: 'tomorrow' | 'nextWeek'): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { error } = await TaskRepository.setSnooze(id, ability.userId, snoozeDate(new Date(), option))
    if (error) {
      logger.error({ event: 'task_snooze_failed', userId: ability.userId, err: error.message }, 'Görev erteleme hatası')
      return { error: 'Görev ertelenemedi' }
    }
    return {}
  },

  async deleteTask(id: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { error } = await TaskRepository.deleteById(id, ability.userId)
    if (error) {
      logger.error({ event: 'task_delete_failed', userId: ability.userId, err: error.message }, 'Görev silme hatası')
      return { error: 'Görev silinemedi' }
    }
    return {}
  },
}
```

- [ ] **Step 2: Tip kontrolü**

Run: `npx tsc --noEmit`
Expected: hata yok.

- [ ] **Step 3: Commit**

```bash
git add src/domains/tasks/services/TaskService.ts
git commit -m "feat(tasks): TaskService (requireAbility + orkestrasyon)"
```

---

### Task 5: `app/actions/tasks.ts` — server action'lar

**Files:**
- Create: `app/actions/tasks.ts`

**Interfaces:**
- Consumes: `TaskService`, `Task` (`@/src/domains/tasks/services/TaskService`), `ActionResult` (`@/src/shared/types/index`), `z` (zod), `revalidatePath`.
- Produces (hepsi `'use server'`):
  - `createTask(input: unknown): Promise<ActionResult<{ task?: Task }>>`
  - `completeTask(id: unknown): Promise<ActionResult>`
  - `reopenTask(id: unknown): Promise<ActionResult>`
  - `snoozeTask(input: unknown): Promise<ActionResult>`  // `{ id, option }`
  - `deleteTask(id: unknown): Promise<ActionResult>`

- [ ] **Step 1: `tasks.ts`'i yaz**

`app/actions/tasks.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { TaskService, type Task } from '@/src/domains/tasks/services/TaskService'
import type { ActionResult } from '@/src/shared/types/index'

const createSchema = z.object({
  title: z.string().trim().min(1, 'Görev metni zorunludur').max(200, 'Görev en fazla 200 karakter olabilir'),
  studentId: z.string().uuid().nullish(),
  classId: z.string().uuid().nullish(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih').nullish(),
})

const snoozeSchema = z.object({
  id: z.string().uuid('Geçersiz görev kimliği'),
  option: z.enum(['tomorrow', 'nextWeek']),
})

const idSchema = z.string().uuid('Geçersiz görev kimliği')

// Yeni görev ekler; başarıda eklenen görevi (id'li) döndürür.
export async function createTask(input: unknown): Promise<ActionResult<{ task?: Task }>> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await TaskService.addTask({
    title: parsed.data.title,
    studentId: parsed.data.studentId ?? null,
    classId: parsed.data.classId ?? null,
    dueDate: parsed.data.dueDate ?? null,
  })
  if (result.error) return { error: result.error }

  revalidatePath('/anasayfa')
  return { task: result.task }
}

export async function completeTask(id: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }
  const result = await TaskService.completeTask(parsed.data)
  if (result.error) return { error: result.error }
  revalidatePath('/anasayfa')
  return {}
}

export async function reopenTask(id: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }
  const result = await TaskService.reopenTask(parsed.data)
  if (result.error) return { error: result.error }
  revalidatePath('/anasayfa')
  return {}
}

export async function snoozeTask(input: unknown): Promise<ActionResult> {
  const parsed = snoozeSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }
  const result = await TaskService.snoozeTask(parsed.data.id, parsed.data.option)
  if (result.error) return { error: result.error }
  revalidatePath('/anasayfa')
  return {}
}

export async function deleteTask(id: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }
  const result = await TaskService.deleteTask(parsed.data)
  if (result.error) return { error: result.error }
  revalidatePath('/anasayfa')
  return {}
}
```

- [ ] **Step 2: Tip kontrolü**

Run: `npx tsc --noEmit`
Expected: hata yok.
Not: `ActionResult`'ın genel kullanımını `app/actions/duty.ts` ile aynı imzada tut (`ActionResult<{ task?: Task }>` ve generic'siz `ActionResult`).

- [ ] **Step 3: Commit**

```bash
git add app/actions/tasks.ts
git commit -m "feat(tasks): server action'lar (create/complete/reopen/snooze/delete)"
```

---

### Task 6: `Yapilacaklarim` client bileşeni + anasayfaya bağlama

**Files:**
- Create: `app/(dashboard)/anasayfa/Yapilacaklarim.tsx`
- Modify: `app/(dashboard)/anasayfa/OgretmenDashboard.tsx` (import + Promise.all'a görev çekme + render)

**Interfaces:**
- Consumes: `Task` (`@/src/domains/tasks/services/TaskService`), action'lar (`@/app/actions/tasks`), `TaskService.getMyActiveTasks` (server tarafı çağrı).
- Produces: `default function Yapilacaklarim({ initial }: { initial: Task[] })` — client bileşen.

- [ ] **Step 1: `Yapilacaklarim.tsx`'i yaz**

`app/(dashboard)/anasayfa/Yapilacaklarim.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { Task } from '@/src/domains/tasks/services/TaskService'
import { createTask, completeTask, snoozeTask, deleteTask } from '@/app/actions/tasks'

export default function Yapilacaklarim({ initial }: { initial: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initial)
  const [title, setTitle] = useState('')
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  function add() {
    const t = title.trim()
    if (!t) return
    setErr(null)
    startTransition(async () => {
      const res = await createTask({ title: t })
      if (res.error) { setErr(res.error); return }
      if (res.task) setTasks(prev => [res.task!, ...prev])
      setTitle('')
    })
  }

  function complete(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id)) // optimistik
    startTransition(async () => {
      const res = await completeTask(id)
      if (res.error) setErr(res.error)
    })
  }

  function snooze(id: string, option: 'tomorrow' | 'nextWeek') {
    setTasks(prev => prev.filter(t => t.id !== id)) // ertelenince bugünden düşer
    startTransition(async () => {
      const res = await snoozeTask({ id, option })
      if (res.error) setErr(res.error)
    })
  }

  function remove(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    startTransition(async () => {
      const res = await deleteTask(id)
      if (res.error) setErr(res.error)
    })
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Yapılacaklarım</h2>
      </div>

      {/* Capture kutusu */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700/60">
        <div className="flex gap-2">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add() }}
            maxLength={200}
            placeholder="Bir iş ekle… (örn. 9-B velilerini ara)"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500 dark:placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={add}
            disabled={pending || !title.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Ekle
          </button>
        </div>
        {err && <p className="text-xs text-red-500 mt-1.5">{err}</p>}
      </div>

      {/* Liste */}
      {tasks.length === 0 ? (
        <p className="px-4 py-4 text-center text-sm text-gray-500 dark:text-slate-400">Bekleyen işin yok.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-slate-700/60">
          {tasks.map(t => (
            <li key={t.id} className="px-4 py-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => complete(t.id)}
                aria-label="Tamamla"
                className="w-4 h-4 shrink-0 rounded-full border-2 border-gray-300 dark:border-slate-500 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-800 dark:text-slate-200 truncate">{t.title}</p>
                {t.due_date && (
                  <p className={`text-[11px] ${t.overdue ? 'text-red-500 font-semibold' : 'text-gray-500 dark:text-slate-400'}`}>
                    {t.overdue ? 'Gecikti · ' : ''}{t.due_date}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => snooze(t.id, 'tomorrow')} className="text-[11px] text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-1.5 py-0.5 rounded transition-colors">Yarın</button>
                <button type="button" onClick={() => snooze(t.id, 'nextWeek')} className="text-[11px] text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-1.5 py-0.5 rounded transition-colors">+7g</button>
                <button type="button" onClick={() => remove(t.id)} aria-label="Sil" className="text-[11px] text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded transition-colors">Sil</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `OgretmenDashboard.tsx`'i bağla**

`app/(dashboard)/anasayfa/OgretmenDashboard.tsx`:

(a) İmport ekle (mevcut importların yanına, ~satır 15):

```tsx
import Yapilacaklarim from './Yapilacaklarim'
import { TaskService } from '@/src/domains/tasks/services/TaskService'
```

(b) `Promise.all`'a görev çekmeyi ekle (mevcut `const [metrics, duties] = await Promise.all([...])` bloğunu değiştir):

```tsx
  const [metrics, duties, myTasks] = await Promise.all([
    TeacherDashboardService.getDashboardMetrics(user.id),
    DutyService.getMyDuties(),
    TaskService.getMyActiveTasks(),
  ])
```

(c) Render: `HizliAksiyonlar`'dan hemen sonra, `OdevCockpit`'ten önce ekle (~satır 146 civarı):

```tsx
      {/* Yapılacaklarım — kişisel aksiyon katmanı */}
      <Yapilacaklarim initial={myTasks} />
```

- [ ] **Step 3: Tip kontrolü + build**

Run: `npx tsc --noEmit`
Expected: hata yok.

- [ ] **Step 4: Manuel doğrulama (dev)**

Run: `npm run dev`, öğretmen olarak `/anasayfa` aç.
Beklenen: "Yapılacaklarım" kartı; iş ekle → listede belirir; tamamla → kaybolur; "Yarın"/"+7g" → kaybolur; sayfa yenile → tamamlanan/ertelenen görünmez, açık olanlar durur.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/anasayfa/Yapilacaklarim.tsx app/(dashboard)/anasayfa/OgretmenDashboard.tsx
git commit -m "feat(tasks): anasayfa Yapılacaklarım kartı (capture + tamamla/ertele)"
```

---

### Task 7: Öğrenci profili "+ Hatırlatıcı" yüzeyi

**Files:**
- Create: `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/OgrenciHatirlaticilar.tsx`
- Modify: `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx` (TaskService çağrısı + section render)

**Interfaces:**
- Consumes: `Task`, `TaskService.getStudentTasks` (server), action'lar `createTask`/`completeTask`/`deleteTask`.
- Produces: `default function OgrenciHatirlaticilar({ initial, studentId, classId }: { initial: Task[]; studentId: string; classId: string })`.

- [ ] **Step 1: `OgrenciHatirlaticilar.tsx`'i yaz**

`app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/OgrenciHatirlaticilar.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Task } from '@/src/domains/tasks/services/TaskService'
import { createTask, completeTask, deleteTask } from '@/app/actions/tasks'

export default function OgrenciHatirlaticilar({
  initial, studentId, classId,
}: { initial: Task[]; studentId: string; classId: string }) {
  const [tasks, setTasks] = useState<Task[]>(initial)
  const [title, setTitle] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function add() {
    const t = title.trim()
    if (!t) return
    setErr(null)
    startTransition(async () => {
      const res = await createTask({ title: t, studentId, classId })
      if (res.error) { setErr(res.error); return }
      if (res.task) setTasks(prev => [res.task!, ...prev])
      setTitle('')
      router.refresh()
    })
  }

  function complete(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    startTransition(async () => { await completeTask(id); router.refresh() })
  }

  function remove(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    startTransition(async () => { await deleteTask(id); router.refresh() })
  }

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mt-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Hatırlatıcılar</h2>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          maxLength={200}
          placeholder="Bu öğrenciyle ilgili hatırlatıcı… (örn. veliyle görüş)"
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500 dark:placeholder:text-slate-400"
        />
        <button type="button" onClick={add} disabled={pending || !title.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          Ekle
        </button>
      </div>
      {err && <p className="text-xs text-red-500 mb-2">{err}</p>}
      {tasks.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-slate-400 text-sm py-4">Bu öğrenci için hatırlatıcı yok.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map(t => (
            <li key={t.id} className="flex items-center gap-2 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2">
              <button type="button" onClick={() => complete(t.id)} aria-label="Tamamla"
                className="w-4 h-4 shrink-0 rounded-full border-2 border-gray-300 dark:border-slate-500 hover:border-emerald-500 transition-colors" />
              <span className="text-sm text-gray-800 dark:text-slate-200 flex-1 min-w-0 truncate">{t.title}</span>
              {t.due_date && (
                <span className={`text-[11px] ${t.overdue ? 'text-red-500 font-semibold' : 'text-gray-500 dark:text-slate-400'}`}>{t.due_date}</span>
              )}
              <button type="button" onClick={() => remove(t.id)} className="text-[11px] text-gray-400 hover:text-red-500 transition-colors">Sil</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 2: `page.tsx`'i bağla**

`app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx`:

(a) İmport ekle (üst blok):

```tsx
import OgrenciHatirlaticilar from './OgrenciHatirlaticilar'
import { TaskService } from '@/src/domains/tasks/services/TaskService'
```

(b) `notFound()` kontrolünden SONRA öğrenci görevlerini çek (cls/student belli olduktan sonra, ~satır 82 civarı):

```tsx
  const studentTasks = await TaskService.getStudentTasks(studentId)
```

(c) Render: `NotGecmisiSection`'dan hemen sonra ekle (~satır 279):

```tsx
      <OgrenciHatirlaticilar initial={studentTasks} studentId={studentId} classId={classId} />
```

- [ ] **Step 3: Tip kontrolü + tüm testler**

Run: `npx tsc --noEmit && npm run test:unit`
Expected: tip hatası yok; taskMath testleri dahil tüm unit testler geçer.

- [ ] **Step 4: Manuel doğrulama (dev)**

Bir öğrenci profili aç → "Hatırlatıcılar" bölümünde iş ekle. `/anasayfa`'ya git → aynı iş "Yapılacaklarım"da da görünür (öğrenci/sınıf bağlı). Tamamla → her iki yüzeyden düşer.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/OgrenciHatirlaticilar.tsx" "app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx"
git commit -m "feat(tasks): öğrenci profili Hatırlatıcılar yüzeyi"
```

---

## Tamamlanınca

Tüm task'lar bitince `superpowers:finishing-a-development-branch` ile entegrasyonu (merge/PR) değerlendir. Push: kullanıcının daimi talimatı gereği `git push origin main` (onay sorma).
