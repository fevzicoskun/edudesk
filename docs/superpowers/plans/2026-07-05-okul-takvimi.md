# Okul Takvimi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/takvim` sayfası — veli randevuları, nöbetler, ödev teslimleri, resmî tatiller ve yönetimin eklediği okul etkinliklerini tek ay görünümünde birleştiren rol-bazlı takvim.

**Architecture:** Sunucu-birleştirmeli ay beslemesi: server component 5 kaynağı paralel çeker, saf `calendarMath.ts` tek tip `CalendarEvent` listesine birleştirip güne gruplar, client component sadece çizer. Ay geçişi `?ay=YYYY-MM` searchParams ile.

**Tech Stack:** Next.js App Router (searchParams **Promise'dir**, `await` gerekir), Supabase (RLS), Zod, Vitest, Playwright. Yeni bağımlılık YOK (tarih işlemleri el yazması saf fonksiyonlar).

**Spec:** `docs/superpowers/specs/2026-07-05-okul-takvimi-design.md`

## Global Constraints

- Supabase proje ID: `agijvfrcudpzsofgfogu`
- Migration sonrası DB tipleri REGEN edilmeli (`src/infrastructure/supabase/database.types.ts`) — yoksa tsc kırılır
- `deleted_at` soft-delete: her sorguda `.is('deleted_at', null)`
- Her sorguda `school_id` filtresi
- `day_of_week` konvansiyonu: **1=Pazartesi .. 5=Cuma** (`src/domains/schedule/dutyMath.ts:5`)
- Tarihler her yerde `'YYYY-MM-DD'` string; `new Date(isoString)` ASLA kullanma (tz kayması), `new Date(y, m-1, d)` kullan
- Soluk metin token'ı: `text-gray-500 dark:text-slate-400` (WCAG AA)
- Roller: `ogretmen | zumre_baskani | mudur_yardimcisi | mudur | admin`; müdür+MY kontrolü `isMudurOrAbove()` (`src/shared/types/index.ts:10`)
- Commit mesajları Türkçe, `feat(takvim): ...` öneki
- Her commit'ten önce o task'ın testleri yeşil olmalı

---

### Task 1: `school_events` tablosu — migration + DB tipleri regen

**Files:**
- Create: `supabase/migrations/20260705120000_school_events.sql`
- Modify: `src/infrastructure/supabase/database.types.ts` (regen ile)

**Interfaces:**
- Produces: `school_events` tablosu (kolonlar: `id, school_id, title, event_date, note, created_by, created_at, deleted_at, deleted_by`), `public.is_mudur_or_my()` SQL helper. Task 3'ün repository'si bu tabloyu sorgular.

- [ ] **Step 1: Migration dosyasını yaz**

```sql
-- Okul etkinlikleri (gezi, tören, genel duyuru niteliğinde tarihli olaylar).
-- Yazma: müdür + müdür yardımcısı. Okuma: okul üyeleri. Patern: parent_meetings.

-- Müdür/MY kontrolü için SECURITY DEFINER helper (is_yonetici_in_school zümre
-- başkanını da içerdiği için kullanılamaz). NOT: advisor 0028/0029 bu fonksiyonu
-- flag'leyecek — bilinçli kabul (bkz. feedback_rls_helper_execute_grant kararı).
create or replace function public.is_mudur_or_my()
returns boolean language sql stable security definer
set search_path to 'public' as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('mudur', 'mudur_yardimcisi')
      and school_id = current_school_id()
  )
$$;

create table if not exists public.school_events (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id)  on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  event_date  date not null,
  note        text check (note is null or char_length(note) <= 1000),
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  deleted_by  uuid references public.profiles(id)
);

-- En sık sorgu: okulun ay aralığındaki etkinlikleri.
create index if not exists idx_school_events_school_date
  on public.school_events (school_id, event_date);

alter table public.school_events enable row level security;

-- Okuma: okul üyeleri.
create policy "school_events_select" on public.school_events
  for select to authenticated
  using (school_id = current_school_id());

-- Yazma: müdür + MY. Silme soft-delete (UPDATE) ile yapılır; DELETE policy yok.
create policy "school_events_insert" on public.school_events
  for insert to authenticated
  with check (school_id = current_school_id() and is_mudur_or_my() and created_by = auth.uid());

create policy "school_events_update" on public.school_events
  for update to authenticated
  using (school_id = current_school_id() and is_mudur_or_my())
  with check (school_id = current_school_id() and is_mudur_or_my());
```

- [ ] **Step 2: Migration'ı uygula**

Supabase MCP `apply_migration` aracıyla (project_id `agijvfrcudpzsofgfogu`, name `school_events`, yukarıdaki SQL). MCP yoksa: `npx supabase db push`.

- [ ] **Step 3: DB tiplerini regen et**

Supabase MCP `generate_typescript_types` çıktısını `src/infrastructure/supabase/database.types.ts` dosyasına AYNEN yaz (dosyanın tamamını değiştir). Alternatif: `npx supabase gen types typescript --project-id agijvfrcudpzsofgfogu --schema public > src/infrastructure/supabase/database.types.ts`

- [ ] **Step 4: tsc ile doğrula**

Run: `npx tsc --noEmit`
Expected: hatasız çıkış (yeni tablo tiplere girdi, mevcut kod kırılmadı)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260705120000_school_events.sql src/infrastructure/supabase/database.types.ts
git commit -m "feat(takvim): school_events tablosu + RLS (yazma müdür/MY) + tip regen"
```

---

### Task 2: `calendarMath.ts` — saf birleştirme çekirdeği (TDD)

**Files:**
- Create: `src/domains/calendar/calendarMath.ts`
- Test: `tests/vitest/unit/domains/calendar/calendarMath.test.ts`

**Interfaces:**
- Produces (Task 3 ve 5 bunları kullanır):

```ts
export type CalendarEventType = 'tatil' | 'etkinlik' | 'nobet' | 'randevu' | 'odev'
export interface CalendarEvent {
  date: string            // YYYY-MM-DD
  type: CalendarEventType
  title: string
  detail?: string
  id?: string             // yalnız etkinlik (silme için)
}
export interface MonthCell { date: string; day: number; inMonth: boolean }
export interface DutyInput { day_of_week: number; time_range: string; location: string; teacherName?: string }

export function parseAyParam(raw: string | undefined, today: Date): { year: number; month: number }
export function toDateStr(year: number, month: number, day: number): string
export function buildMonthCells(year: number, month: number): MonthCell[]   // Pzt başlangıçlı, 7'nin katı uzunluk
export function expandDuties(duties: DutyInput[], year: number, month: number, holidayDates: Set<string>): CalendarEvent[]
export function groupByDay(events: CalendarEvent[]): Record<string, CalendarEvent[]>  // gün içi sıra: tatil→etkinlik→nobet→randevu→odev
```

- [ ] **Step 1: Failing testleri yaz**

```ts
import { describe, it, expect } from 'vitest'
import {
  parseAyParam, toDateStr, buildMonthCells, expandDuties, groupByDay,
  type CalendarEvent,
} from '@/src/domains/calendar/calendarMath'

describe('parseAyParam', () => {
  const today = new Date(2026, 6, 5) // 5 Temmuz 2026

  it('geçerli ay parametresini çözer', () => {
    expect(parseAyParam('2026-03', today)).toEqual({ year: 2026, month: 3 })
  })

  it.each(['abc', '2026-13', '2026-00', '2026', '', '2026-3'])('geçersiz "%s" → içinde bulunulan ay', raw => {
    expect(parseAyParam(raw, today)).toEqual({ year: 2026, month: 7 })
  })

  it('undefined → içinde bulunulan ay', () => {
    expect(parseAyParam(undefined, today)).toEqual({ year: 2026, month: 7 })
  })
})

describe('toDateStr', () => {
  it('tek haneli ay/günü sıfırla doldurur', () => {
    expect(toDateStr(2026, 7, 5)).toBe('2026-07-05')
    expect(toDateStr(2026, 12, 31)).toBe('2026-12-31')
  })
})

describe('buildMonthCells', () => {
  it('Temmuz 2026: 1 Temmuz Çarşamba → önde 2 dolgu hücre, toplam 7 katı', () => {
    const cells = buildMonthCells(2026, 7)
    expect(cells.length % 7).toBe(0)
    expect(cells[0].inMonth).toBe(false)          // 29 Haziran (Pzt)
    expect(cells[2]).toEqual({ date: '2026-07-01', day: 1, inMonth: true })
    expect(cells.filter(c => c.inMonth)).toHaveLength(31)
  })

  it('Haziran 2026: 1 Haziran Pazartesi → önde dolgu yok', () => {
    const cells = buildMonthCells(2026, 6)
    expect(cells[0]).toEqual({ date: '2026-06-01', day: 1, inMonth: true })
  })

  it('Şubat 2027 (28 gün, 1 Şubat Pazartesi) → tam 28 hücre', () => {
    const cells = buildMonthCells(2027, 2)
    expect(cells).toHaveLength(28)
    expect(cells.every(c => c.inMonth)).toBe(true)
  })
})

describe('expandDuties', () => {
  const nobet = { day_of_week: 3, time_range: '08:00-16:00', location: 'A Blok' } // Çarşamba

  it('haftalık nöbeti ayın somut tarihlerine genişletir', () => {
    const events = expandDuties([nobet], 2026, 7, new Set())
    // Temmuz 2026 Çarşambaları: 1, 8, 15, 22, 29
    expect(events.map(e => e.date)).toEqual(['2026-07-01', '2026-07-08', '2026-07-15', '2026-07-22', '2026-07-29'])
    expect(events[0].type).toBe('nobet')
    expect(events[0].title).toBe('Nöbet — A Blok')
    expect(events[0].detail).toBe('08:00-16:00')
  })

  it('tatile denk gelen nöbet günü atlanır', () => {
    const events = expandDuties([nobet], 2026, 7, new Set(['2026-07-15']))
    expect(events.map(e => e.date)).toEqual(['2026-07-01', '2026-07-08', '2026-07-22', '2026-07-29'])
  })

  it('teacherName verilirse başlığa eklenir (müdür görünümü)', () => {
    const events = expandDuties([{ ...nobet, teacherName: 'Ali Veli' }], 2026, 7, new Set())
    expect(events[0].title).toBe('Nöbet — A Blok (Ali Veli)')
  })

  it('1-5 aralığı dışındaki day_of_week üretim yapmaz', () => {
    expect(expandDuties([{ ...nobet, day_of_week: 6 }], 2026, 7, new Set())).toEqual([])
    expect(expandDuties([{ ...nobet, day_of_week: 0 }], 2026, 7, new Set())).toEqual([])
  })
})

describe('groupByDay', () => {
  it('güne gruplar ve gün içinde tatil→etkinlik→nobet→randevu→odev sıralar', () => {
    const events: CalendarEvent[] = [
      { date: '2026-07-10', type: 'odev', title: 'Ödev teslimi — Kesirler' },
      { date: '2026-07-10', type: 'tatil', title: 'Tatil' },
      { date: '2026-07-10', type: 'randevu', title: 'Veli görüşmesi' },
      { date: '2026-07-11', type: 'etkinlik', title: 'Gezi' },
      { date: '2026-07-10', type: 'nobet', title: 'Nöbet — A Blok' },
    ]
    const grouped = groupByDay(events)
    expect(Object.keys(grouped).sort()).toEqual(['2026-07-10', '2026-07-11'])
    expect(grouped['2026-07-10'].map(e => e.type)).toEqual(['tatil', 'nobet', 'randevu', 'odev'])
  })

  it('boş liste → boş nesne', () => {
    expect(groupByDay([])).toEqual({})
  })
})
```

- [ ] **Step 2: Testlerin FAIL ettiğini doğrula**

Run: `npx vitest run tests/vitest/unit/domains/calendar/calendarMath.test.ts`
Expected: FAIL — "Cannot find module '@/src/domains/calendar/calendarMath'"

- [ ] **Step 3: calendarMath.ts'i yaz**

```ts
// Takvim birleştirme çekirdeği — saf fonksiyonlar, DB/IO yok.
// Tarih konvansiyonu: her yerde 'YYYY-MM-DD' string; Date yalnız yerel y/m/d ile kurulur (tz güvenli).

export type CalendarEventType = 'tatil' | 'etkinlik' | 'nobet' | 'randevu' | 'odev'

export interface CalendarEvent {
  date: string
  type: CalendarEventType
  title: string
  detail?: string
  id?: string // yalnız etkinlik (silme için)
}

export interface MonthCell {
  date: string
  day: number
  inMonth: boolean
}

export interface DutyInput {
  day_of_week: number // 1=Pazartesi .. 5=Cuma (dutyMath konvansiyonu)
  time_range: string
  location: string
  teacherName?: string
}

const TYPE_ORDER: Record<CalendarEventType, number> = {
  tatil: 0, etkinlik: 1, nobet: 2, randevu: 3, odev: 4,
}

export function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseAyParam(raw: string | undefined, today: Date): { year: number; month: number } {
  const m = raw?.match(/^(\d{4})-(\d{2})$/)
  if (m) {
    const year = Number(m[1])
    const month = Number(m[2])
    if (month >= 1 && month <= 12) return { year, month }
  }
  return { year: today.getFullYear(), month: today.getMonth() + 1 }
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// JS getDay (0=Pazar) → 1=Pazartesi..7=Pazar
function dowTr(year: number, month: number, day: number): number {
  return ((new Date(year, month - 1, day).getDay() + 6) % 7) + 1
}

export function buildMonthCells(year: number, month: number): MonthCell[] {
  const total = daysInMonth(year, month)
  const cells: MonthCell[] = []

  // Önde dolgu: ayın 1'i Pazartesi değilse önceki ayın taşan günleri.
  const lead = dowTr(year, month, 1) - 1
  for (let i = lead; i > 0; i--) {
    const d = new Date(year, month - 1, 1 - i)
    cells.push({ date: toDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate()), day: d.getDate(), inMonth: false })
  }

  for (let day = 1; day <= total; day++) {
    cells.push({ date: toDateStr(year, month, day), day, inMonth: true })
  }

  // Arkada dolgu: son haftayı 7'ye tamamla.
  const trail = (7 - (cells.length % 7)) % 7
  for (let i = 1; i <= trail; i++) {
    const d = new Date(year, month - 1, total + i)
    cells.push({ date: toDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate()), day: d.getDate(), inMonth: false })
  }

  return cells
}

export function expandDuties(
  duties: DutyInput[],
  year: number,
  month: number,
  holidayDates: Set<string>
): CalendarEvent[] {
  const valid = duties.filter(d => Number.isInteger(d.day_of_week) && d.day_of_week >= 1 && d.day_of_week <= 5)
  const total = daysInMonth(year, month)
  const events: CalendarEvent[] = []

  for (let day = 1; day <= total; day++) {
    const dow = dowTr(year, month, day)
    if (dow > 5) continue
    const date = toDateStr(year, month, day)
    if (holidayDates.has(date)) continue
    for (const duty of valid) {
      if (duty.day_of_week !== dow) continue
      const suffix = duty.teacherName ? ` (${duty.teacherName})` : ''
      events.push({ date, type: 'nobet', title: `Nöbet — ${duty.location}${suffix}`, detail: duty.time_range })
    }
  }
  return events
}

export function groupByDay(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const grouped: Record<string, CalendarEvent[]> = {}
  for (const e of events) {
    ;(grouped[e.date] ??= []).push(e)
  }
  for (const date of Object.keys(grouped)) {
    grouped[date].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type])
  }
  return grouped
}
```

- [ ] **Step 4: Testlerin PASS ettiğini doğrula**

Run: `npx vitest run tests/vitest/unit/domains/calendar/calendarMath.test.ts`
Expected: PASS (tüm testler yeşil)

- [ ] **Step 5: Commit**

```bash
git add src/domains/calendar/calendarMath.ts tests/vitest/unit/domains/calendar/calendarMath.test.ts
git commit -m "feat(takvim): calendarMath — ay hücreleri, nöbet genişletme, güne gruplama (saf çekirdek)"
```

---

### Task 3: CalendarRepository + CalendarService

**Files:**
- Create: `src/domains/calendar/repositories/CalendarRepository.ts`
- Create: `src/domains/calendar/services/CalendarService.ts`

**Interfaces:**
- Consumes: Task 2'nin `calendarMath` fonksiyonları; mevcut `DutyRepository.listByTeacher(teacherId, schoolId)` ve `DutyRepository.listSchoolDuties(schoolId)` (`src/domains/schedule/repositories/DutyRepository.ts`); `SCHOOL_YEAR_HOLIDAYS` (`src/shared/constants/holidays.ts`); `requireAbility()` (`src/shared/authorization/server`); `getCurrentProfile()` (`src/shared/auth`); `isMudurOrAbove()` (`src/shared/types`)
- Produces (Task 4 ve 5 bunları kullanır):

```ts
CalendarService.getMonth(year: number, month: number): Promise<{ days: Record<string, CalendarEvent[]>; canManage: boolean }>
CalendarService.createEvent(input: { title: string; eventDate: string; note: string | null }): Promise<{ error?: string; id?: string }>
CalendarService.removeEvent(id: string): Promise<{ error?: string }>
```

- [ ] **Step 1: CalendarRepository'yi yaz**

```ts
import { createClient } from '@/src/infrastructure/supabase/server'

// Not: createClient (kullanıcı oturumu) → RLS uygular:
//   parent_meetings: öğretmen kendi satırları, müdür/MY okul geneli (20260704120000).
//   school_events: SELECT okul üyeleri, yazma müdür/MY (20260705120000).
export const CalendarRepository = {
  // Ay aralığındaki randevular (iptal hariç). Görünürlüğü RLS kırpar.
  async listMeetings(schoolId: string, from: string, to: string) {
    const db = await createClient()
    return db
      .from('parent_meetings')
      .select('meet_date, period, students(full_name)')
      .eq('school_id', schoolId)
      .gte('meet_date', from)
      .lte('meet_date', to)
      .neq('status', 'iptal')
      .limit(1000)
  },

  // Ay aralığında teslim tarihi olan ödevler. teacherId verilirse yalnız o öğretmenin.
  async listHomeworks(schoolId: string, from: string, to: string, teacherId: string | null) {
    const db = await createClient()
    let q = db
      .from('homeworks')
      .select('title, due_date, classes(name)')
      .eq('school_id', schoolId)
      .eq('is_template', false)
      .is('deleted_at', null)
      .gte('due_date', from)
      .lte('due_date', to)
    if (teacherId) q = q.eq('teacher_id', teacherId)
    return q.limit(1000)
  },

  // Ay aralığındaki okul etkinlikleri.
  async listEvents(schoolId: string, from: string, to: string) {
    const db = await createClient()
    return db
      .from('school_events')
      .select('id, title, event_date, note')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .gte('event_date', from)
      .lte('event_date', to)
      .order('event_date')
      .limit(500)
  },

  async insertEvent(row: { school_id: string; title: string; event_date: string; note: string | null; created_by: string }) {
    const db = await createClient()
    return db.from('school_events').insert(row).select('id').single()
  },

  // Soft-delete (RLS UPDATE policy'si müdür/MY zorlar).
  async softDeleteEvent(id: string, schoolId: string, deletedBy: string) {
    const db = await createClient()
    return db
      .from('school_events')
      .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
      .eq('id', id)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
  },
}
```

- [ ] **Step 2: CalendarService'i yaz**

```ts
import { requireAbility } from '@/src/shared/authorization/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import { logger } from '@/src/infrastructure/observability/logger'
import { SCHOOL_YEAR_HOLIDAYS } from '@/src/shared/constants/holidays'
import { DutyRepository } from '@/src/domains/schedule/repositories/DutyRepository'
import { CalendarRepository } from '../repositories/CalendarRepository'
import { expandDuties, groupByDay, toDateStr, type CalendarEvent, type DutyInput } from '../calendarMath'

type MeetingRow = { meet_date: string; period: number; students: { full_name: string } | null }
type HomeworkRow = { title: string; due_date: string | null; classes: { name: string } | null }
type EventRow = { id: string; title: string; event_date: string; note: string | null }

export const CalendarService = {
  async getMonth(year: number, month: number): Promise<{ days: Record<string, CalendarEvent[]>; canManage: boolean }> {
    const ability = await requireAbility()
    const profile = await getCurrentProfile()
    const canManage = isMudurOrAbove(profile?.role)

    const from = toDateStr(year, month, 1)
    const to = toDateStr(year, month, new Date(year, month, 0).getDate())

    const [meetingsRes, dutiesRes, homeworksRes, eventsRes] = await Promise.all([
      CalendarRepository.listMeetings(ability.schoolId, from, to),
      canManage
        ? DutyRepository.listSchoolDuties(ability.schoolId)
        : DutyRepository.listByTeacher(ability.userId, ability.schoolId),
      CalendarRepository.listHomeworks(ability.schoolId, from, to, canManage ? null : ability.userId),
      CalendarRepository.listEvents(ability.schoolId, from, to),
    ])

    for (const [name, res] of [['randevu', meetingsRes], ['nobet', dutiesRes], ['odev', homeworksRes], ['etkinlik', eventsRes]] as const) {
      if (res.error) {
        logger.error({ event: 'takvim_source_failed', source: name, userId: ability.userId, err: res.error.message }, 'Takvim kaynağı okunamadı')
      }
    }

    const holidays = SCHOOL_YEAR_HOLIDAYS.filter(h => h.date >= from && h.date <= to)
    const holidayDates = new Set(holidays.map(h => h.date))

    const duties = ((dutiesRes.data ?? []) as unknown as DutyInput[])
    const invalid = duties.filter(d => !Number.isInteger(d.day_of_week) || d.day_of_week < 1 || d.day_of_week > 5)
    if (invalid.length) {
      logger.error({ event: 'takvim_invalid_duty_dow', count: invalid.length, userId: ability.userId }, 'Aralık dışı day_of_week nöbet satırı atlandı')
    }

    const events: CalendarEvent[] = [
      ...holidays.map(h => ({ date: h.date, type: 'tatil' as const, title: h.label })),
      ...((eventsRes.data ?? []) as unknown as EventRow[]).map(e => ({
        date: e.event_date, type: 'etkinlik' as const, title: e.title, detail: e.note ?? undefined, id: e.id,
      })),
      ...expandDuties(duties, year, month, holidayDates),
      ...((meetingsRes.data ?? []) as unknown as MeetingRow[]).map(m => ({
        date: m.meet_date, type: 'randevu' as const,
        title: `Veli görüşmesi — ${m.students?.full_name ?? '—'}`, detail: `${m.period}. ders`,
      })),
      ...((homeworksRes.data ?? []) as unknown as HomeworkRow[]).flatMap(h =>
        h.due_date
          ? [{ date: h.due_date, type: 'odev' as const, title: `Ödev teslimi — ${h.title}`, detail: h.classes?.name ?? undefined }]
          : []
      ),
    ]

    return { days: groupByDay(events), canManage }
  },

  async createEvent(input: { title: string; eventDate: string; note: string | null }): Promise<{ error?: string; id?: string }> {
    const ability = await requireAbility()
    const profile = await getCurrentProfile()
    if (!isMudurOrAbove(profile?.role)) return { error: 'Bu işlem için yetkiniz yok' }

    const { data, error } = await CalendarRepository.insertEvent({
      school_id: ability.schoolId,
      title: input.title,
      event_date: input.eventDate,
      note: input.note,
      created_by: ability.userId,
    })
    if (error || !data) {
      logger.error({ event: 'takvim_event_create_failed', userId: ability.userId, err: error?.message }, 'Etkinlik ekleme hatası')
      return { error: 'Etkinlik kaydedilemedi' }
    }
    return { id: (data as { id: string }).id }
  },

  async removeEvent(id: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const profile = await getCurrentProfile()
    if (!isMudurOrAbove(profile?.role)) return { error: 'Bu işlem için yetkiniz yok' }

    const { error } = await CalendarRepository.softDeleteEvent(id, ability.schoolId, ability.userId)
    if (error) {
      logger.error({ event: 'takvim_event_delete_failed', userId: ability.userId, err: error.message }, 'Etkinlik silme hatası')
      return { error: 'Etkinlik silinemedi' }
    }
    return {}
  },
}
```

- [ ] **Step 3: tsc ile doğrula**

Run: `npx tsc --noEmit`
Expected: hatasız. (Not: `students(full_name)` embed'i tipte dizi görünürse `as unknown as` cast'i mevcut desendir — MeetingService.ts:50 ile aynı.)

- [ ] **Step 4: Commit**

```bash
git add src/domains/calendar/repositories/CalendarRepository.ts src/domains/calendar/services/CalendarService.ts
git commit -m "feat(takvim): CalendarRepository + CalendarService (5 kaynak, rol bazlı kapsam)"
```

---

### Task 4: Server actions — etkinlik ekle/sil

**Files:**
- Create: `app/actions/calendar.ts`

**Interfaces:**
- Consumes: `CalendarService.createEvent`, `CalendarService.removeEvent` (Task 3)
- Produces (Task 5'in modal/paneli çağırır):

```ts
createSchoolEvent(input: unknown): Promise<ActionResult<{ id?: string }>>
deleteSchoolEvent(id: unknown): Promise<ActionResult>
```

- [ ] **Step 1: Action dosyasını yaz** (patern: `app/actions/meetings.ts`)

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { CalendarService } from '@/src/domains/calendar/services/CalendarService'
import type { ActionResult } from '@/src/shared/types/index'

const createSchema = z.object({
  title: z.string().trim().min(1, 'Başlık gerekli').max(200, 'Başlık en fazla 200 karakter'),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih'),
  note: z.string().trim().max(1000).nullish(),
})

const idSchema = z.string().uuid('Geçersiz etkinlik kimliği')

export async function createSchoolEvent(input: unknown): Promise<ActionResult<{ id?: string }>> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await CalendarService.createEvent({
    title: parsed.data.title,
    eventDate: parsed.data.eventDate,
    note: parsed.data.note ?? null,
  })
  if (result.error) return { error: result.error }

  revalidatePath('/takvim')
  return { id: result.id }
}

export async function deleteSchoolEvent(id: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await CalendarService.removeEvent(parsed.data)
  if (result.error) return { error: result.error }

  revalidatePath('/takvim')
  return {}
}
```

- [ ] **Step 2: tsc ile doğrula**

Run: `npx tsc --noEmit`
Expected: hatasız

- [ ] **Step 3: Commit**

```bash
git add app/actions/calendar.ts
git commit -m "feat(takvim): etkinlik ekle/sil server action'ları (Zod + revalidate)"
```

---

### Task 5: UI — /takvim sayfası, TakvimClient, Sidebar girişi

**Files:**
- Create: `app/(dashboard)/takvim/page.tsx`
- Create: `app/(dashboard)/takvim/loading.tsx`
- Create: `app/(dashboard)/takvim/TakvimClient.tsx`
- Modify: `components/layout/Sidebar.tsx` (navItems dizisine giriş, `/randevular` girişinden sonra)

**Interfaces:**
- Consumes: `CalendarService.getMonth` (Task 3), `createSchoolEvent`/`deleteSchoolEvent` (Task 4), `buildMonthCells`/`parseAyParam`/`toDateStr`/`CalendarEvent` (Task 2)

- [ ] **Step 1: page.tsx'i yaz**

```tsx
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { CalendarService } from '@/src/domains/calendar/services/CalendarService'
import { parseAyParam, buildMonthCells, toDateStr } from '@/src/domains/calendar/calendarMath'
import TakvimClient from './TakvimClient'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Takvim' }

export default async function TakvimPage({ searchParams }: { searchParams: Promise<{ ay?: string }> }) {
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')

  const { ay } = await searchParams
  const today = new Date()
  const { year, month } = parseAyParam(ay, today)

  const { days, canManage } = await CalendarService.getMonth(year, month)
  const cells = buildMonthCells(year, month)

  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <TakvimClient
        year={year}
        month={month}
        cells={cells}
        days={days}
        canManage={canManage}
        todayStr={toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate())}
        prevHref={`/takvim?ay=${prev.year}-${String(prev.month).padStart(2, '0')}`}
        nextHref={`/takvim?ay=${next.year}-${String(next.month).padStart(2, '0')}`}
      />
    </div>
  )
}
```

- [ ] **Step 2: loading.tsx'i yaz** (mevcut loading iskeleti deseni)

```tsx
export default function TakvimLoading() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-pulse">
      <div className="h-8 w-48 bg-gray-200 dark:bg-slate-700 rounded mb-6" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-slate-800 rounded" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: TakvimClient.tsx'i yaz**

Tek client component: masaüstünde ay ızgarası (`hidden md:grid`), dar ekranda ajanda listesi (`md:hidden`), gün detay paneli, müdür/MY için "+ Etkinlik" modalı. Tam kod:

```tsx
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createSchoolEvent, deleteSchoolEvent } from '@/app/actions/calendar'
import type { CalendarEvent, MonthCell } from '@/src/domains/calendar/calendarMath'

const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const GUN_BASLIKLARI = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

// Kategori işaret renkleri (dataviz uyumlu, açık/koyu temada okunur).
const TYPE_STYLE: Record<CalendarEvent['type'], { dot: string; label: string }> = {
  tatil:    { dot: 'bg-rose-500',    label: 'Tatil' },
  etkinlik: { dot: 'bg-violet-500',  label: 'Etkinlik' },
  nobet:    { dot: 'bg-amber-500',   label: 'Nöbet' },
  randevu:  { dot: 'bg-sky-500',     label: 'Veli randevusu' },
  odev:     { dot: 'bg-emerald-500', label: 'Ödev teslimi' },
}

interface Props {
  year: number
  month: number
  cells: MonthCell[]
  days: Record<string, CalendarEvent[]>
  canManage: boolean
  todayStr: string
  prevHref: string
  nextHref: string
}

function formatTR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${d} ${AY_ADLARI[m - 1]} ${y}`
}

export default function TakvimClient({ year, month, cells, days, canManage, todayStr, prevHref, nextHref }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const selectedEvents = selected ? (days[selected] ?? []) : []
  const eventDates = Object.keys(days).sort()

  function submitEvent(formData: FormData) {
    setFormError(null)
    startTransition(async () => {
      const result = await createSchoolEvent({
        title: String(formData.get('title') ?? ''),
        eventDate: String(formData.get('eventDate') ?? ''),
        note: String(formData.get('note') ?? '') || null,
      })
      if (result.error) { setFormError(result.error); return }
      setModalOpen(false)
    })
  }

  function removeEvent(id: string) {
    startTransition(async () => { await deleteSchoolEvent(id) })
  }

  return (
    <div>
      {/* Başlık + ay gezinme */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Takvim</h1>
        {canManage && (
          <button
            onClick={() => setModalOpen(true)}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            + Etkinlik
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Link href={prevHref} aria-label="Önceki ay" className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800">‹</Link>
        <span className="font-semibold min-w-36 text-center">{AY_ADLARI[month - 1]} {year}</span>
        <Link href={nextHref} aria-label="Sonraki ay" className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800">›</Link>
      </div>

      {/* Kategori lejantı */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-xs text-gray-500 dark:text-slate-400">
        {Object.entries(TYPE_STYLE).map(([type, s]) => (
          <span key={type} className="inline-flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${s.dot}`} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>

      {/* Masaüstü: ay ızgarası */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
          {GUN_BASLIKLARI.map(g => <div key={g} className="px-2 py-1">{g}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map(cell => {
            const events = days[cell.date] ?? []
            const isTatil = events.some(e => e.type === 'tatil')
            const isToday = cell.date === todayStr
            return (
              <button
                key={cell.date}
                onClick={() => setSelected(cell.date === selected ? null : cell.date)}
                disabled={!cell.inMonth}
                aria-label={`${formatTR(cell.date)}${events.length ? `, ${events.length} olay` : ''}`}
                className={[
                  'min-h-20 p-1.5 rounded-lg border text-left align-top transition-colors',
                  cell.inMonth
                    ? 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                    : 'border-transparent opacity-40',
                  isTatil && cell.inMonth ? 'bg-rose-50 dark:bg-rose-950/30' : '',
                  selected === cell.date ? 'ring-2 ring-blue-500' : '',
                ].join(' ')}
              >
                <span className={`text-sm ${isToday ? 'font-bold text-blue-600 dark:text-blue-400' : ''}`}>{cell.day}</span>
                <span className="flex flex-wrap gap-0.5 mt-1">
                  {events.slice(0, 4).map((e, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${TYPE_STYLE[e.type].dot}`} aria-hidden />
                  ))}
                  {events.length > 4 && <span className="text-[10px] text-gray-500 dark:text-slate-400">+{events.length - 4}</span>}
                </span>
              </button>
            )
          })}
        </div>

        {/* Gün detay paneli */}
        {selected && (
          <div className="mt-4 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
            <h2 className="font-semibold mb-2">{formatTR(selected)}</h2>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">Bu günde olay yok.</p>
            ) : (
              <ul className="space-y-2">
                {selectedEvents.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${TYPE_STYLE[e.type].dot}`} aria-hidden />
                    <span className="flex-1">
                      <span className="font-medium">{e.title}</span>
                      {e.detail && <span className="text-gray-500 dark:text-slate-400"> · {e.detail}</span>}
                    </span>
                    {canManage && e.type === 'etkinlik' && e.id && (
                      <button
                        onClick={() => removeEvent(e.id!)}
                        disabled={pending}
                        className="text-xs text-rose-600 dark:text-rose-400 hover:underline"
                      >
                        Sil
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Mobil: ajanda listesi */}
      <div className="md:hidden">
        {eventDates.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400 py-8 text-center">
            Bu ayda takvimde olay yok.
          </p>
        ) : (
          <ul className="space-y-4">
            {eventDates.map(date => (
              <li key={date}>
                <h3 className={`text-sm font-semibold mb-1 ${date === todayStr ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                  {formatTR(date)}
                </h3>
                <ul className="space-y-1.5">
                  {days[date].map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${TYPE_STYLE[e.type].dot}`} aria-hidden />
                      <span className="flex-1">
                        <span className="font-medium">{e.title}</span>
                        {e.detail && <span className="text-gray-500 dark:text-slate-400"> · {e.detail}</span>}
                      </span>
                      {canManage && e.type === 'etkinlik' && e.id && (
                        <button onClick={() => removeEvent(e.id!)} disabled={pending} className="text-xs text-rose-600 dark:text-rose-400">Sil</button>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Masaüstü boş durum (ızgara altında, olaysız ay) */}
      {eventDates.length === 0 && (
        <p className="hidden md:block text-sm text-gray-500 dark:text-slate-400 mt-4 text-center">
          Bu ayda takvimde olay yok.{canManage ? ' "+ Etkinlik" ile ekleyebilirsin.' : ''}
        </p>
      )}

      {/* Yeni etkinlik modalı */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-5">
            <h2 className="text-lg font-semibold mb-4">Yeni Etkinlik</h2>
            <form action={submitEvent} className="space-y-3">
              <div>
                <label htmlFor="ev-title" className="block text-sm font-medium mb-1">Başlık</label>
                <input id="ev-title" name="title" required maxLength={200}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="ev-date" className="block text-sm font-medium mb-1">Tarih</label>
                <input id="ev-date" name="eventDate" type="date" required
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="ev-note" className="block text-sm font-medium mb-1">Not (isteğe bağlı)</label>
                <textarea id="ev-note" name="note" rows={2} maxLength={1000}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
              </div>
              {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="px-3 py-2 rounded-lg text-sm border border-gray-300 dark:border-slate-600">Vazgeç</button>
                <button type="submit" disabled={pending}
                  className="px-3 py-2 rounded-lg text-sm bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50">
                  {pending ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Sidebar'a giriş ekle**

`components/layout/Sidebar.tsx` içinde `navItems` dizisine, `/randevular` girişinden hemen sonra:

```tsx
  {
    href: '/takvim',
    label: 'Takvim',
    mobile: true,
    roles: null,
    icon: <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zm4-6h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01" /></svg>,
  },
```

- [ ] **Step 5: tsc + unit regresyon**

Run: `npx tsc --noEmit ; npm run test:unit`
Expected: tsc hatasız, 763+ test PASS

- [ ] **Step 6: Dev sunucuda gözle doğrula**

Run: `npm run dev` → `http://localhost:3000/takvim` (öğretmen hesabıyla): ızgara render olur, nöbet/randevu/ödev noktaları görünür, ay gezinme çalışır. Müdür hesabıyla: "+ Etkinlik" görünür, ekleme çalışır.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/takvim" components/layout/Sidebar.tsx
git commit -m "feat(takvim): /takvim sayfası — ay ızgarası, mobil ajanda, etkinlik modalı, sidebar girişi"
```

---

### Task 6: E2E testler

**Files:**
- Create: `tests/playwright/e2e/takvim.spec.ts`

**Interfaces:**
- Consumes: Task 5'in `/takvim` sayfası; mevcut auth storage state'leri `tests/playwright/.auth/ogretmen.json` ve `tests/playwright/.auth/mudur.json` (randevular.spec.ts ile aynı desen)

- [ ] **Step 1: E2E testleri yaz**

```ts
import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

test.describe('Takvim — öğretmen', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('sayfa açılır, ızgara render olur, etkinlik butonu GÖRÜNMEZ', async ({ page }) => {
    await page.goto('/takvim')
    await expect(page.getByRole('heading', { name: 'Takvim' })).toBeVisible({ timeout: 10_000 })
    // Gün başlıkları (masaüstü ızgara)
    await expect(page.getByText('Pzt', { exact: true })).toBeVisible()
    // Öğretmen etkinlik ekleyemez
    await expect(page.getByRole('button', { name: '+ Etkinlik' })).toHaveCount(0)
  })

  test('ay gezinme çalışır', async ({ page }) => {
    await page.goto('/takvim?ay=2026-07')
    await expect(page.getByText('Temmuz 2026')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('link', { name: 'Sonraki ay' }).click()
    await expect(page.getByText('Ağustos 2026')).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Takvim — müdür', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'mudur.json') })

  test('etkinlik ekler, takvimde görünür, sonra siler', async ({ page }) => {
    await page.goto('/takvim?ay=2026-09')
    await expect(page.getByRole('heading', { name: 'Takvim' })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: '+ Etkinlik' }).click()
    await expect(page.getByRole('heading', { name: 'Yeni Etkinlik' })).toBeVisible()
    const title = `E2E Gezi ${Date.now()}`
    await page.getByLabel('Başlık').fill(title)
    await page.getByLabel('Tarih').fill('2026-09-15')
    await page.getByRole('button', { name: 'Kaydet' }).click()

    // Modal kapanır, 15 Eylül hücresine tıkla → panelde etkinlik görünür
    await expect(page.getByRole('heading', { name: 'Yeni Etkinlik' })).toHaveCount(0, { timeout: 10_000 })
    await page.getByRole('button', { name: /15 Eylül 2026/ }).click()
    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 })

    // Temizlik: sil (seed kirliliği bırakma)
    await page.getByRole('button', { name: 'Sil' }).first().click()
    await expect(page.getByText(title)).toHaveCount(0, { timeout: 10_000 })
  })
})
```

Not: `tests/playwright/.auth/` altında `ogretmen.json` ve `mudur.json` mevcut (doğrulandı) — global-setup bunları üretiyor.

- [ ] **Step 2: E2E çalıştır**

Run: `npx playwright test tests/playwright/e2e/takvim.spec.ts`
Expected: 3 test PASS (webServer webpack modda başlar — turbopack KULLANMA, bu projede dev sunucusunu çökertiyor)

- [ ] **Step 3: Commit**

```bash
git add tests/playwright/e2e/takvim.spec.ts
git commit -m "test(takvim): e2e — rol bazlı görünürlük, ay gezinme, etkinlik ekle/sil"
```

---

### Task 7: Final doğrulama + push

**Files:** (yalnız doğrulama; dosya değişikliği beklenmez)

- [ ] **Step 1: Tam regresyon**

Run: `npx tsc --noEmit ; npm run test:unit ; npx playwright test`
Expected: tsc hatasız; tüm unit testler PASS; tüm e2e PASS (67+3)

- [ ] **Step 2: Supabase advisor kontrolü**

Supabase MCP `get_advisors` (security): yeni bulgu yalnız `is_mudur_or_my` için 0028/0029 olmalı — bu bilinçli kabul (mevcut helper'larla aynı desen). Başka yeni bulgu ÇIKMAMALI (özellikle `school_events` için rls_enabled_no_policy çıkmamalı — policy'ler var).

- [ ] **Step 3: Push**

```bash
git push origin main
```

Expected: main'e push başarılı; Vercel otomatik deploy alır.
