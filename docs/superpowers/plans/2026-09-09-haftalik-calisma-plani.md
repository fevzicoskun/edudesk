# Haftalık Çalışma Planı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 12. sınıf öğrencilerine öğrenciye özel haftalık çalışma planı (kaynak + talimat + durum) girmeyi ve takip etmeyi, ödev sistemine dokunmadan sağlamak.

**Architecture:** İki yeni tablo (`student_sources`, `study_plan_items`) + saf `planMath` + `StudyPlanRepository/Service` + `app/actions/study-plan.ts`. Yüzeyler: `/siniflar/[id]/plan` sınıf haftalık tablosu (native `<details>` ile satır açılır, JS drawer yok) ve Öğrenci 360'ta aynı `HaftaEditoru` bileşeni. Yetki: mevcut `P.HOMEWORK.*` + `teacher_classes` kontrolü serviste; RLS okul-kapsamlı.

**Tech Stack:** Next.js 16 App Router (server actions, `useActionState`), Supabase tipli client (`createClient<Database>`), zod, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-09-haftalik-calisma-plani-design.md`

## Global Constraints

- Branch: `feat/haftalik-calisma-plani` (main'e merge kullanıcı kararı — "geri alınabilir" isteği). Her task sonunda commit + `git push -u origin feat/haftalik-calisma-plani`.
- Migration yalnız **yeni tablo** ekler, mevcut tabloya dokunmaz; dosya sonunda yorumlu `-- ROLLBACK` bloğu.
- DB tipleri (`src/infrastructure/supabase/database.types.ts`) migration sonrası güncellenmeden `db.from('study_plan_items')` tsc'de TS2769 verir → Task 2 bunu çözer, Task 3+ ona bağımlıdır.
- Statü sözlüğü: `'planlandi' | 'yapildi' | 'eksik' | 'yapilmadi'` (DB check ile aynı).
- Ders: `getCurrentProfile().subject ?? 'Genel'`.
- Türkçe UI metinleri, WCAG: soluk metin `text-gray-500 dark:text-slate-400` (asla `text-gray-400`).
- Ödev listesi, widget'lar, veli portalı, bildirimler, featureMap **değişmez**.
- Kanıt: her task `npx tsc --noEmit` temiz + ilgili `npx vitest run <dosya>` yeşil; son task `npm run test:unit` + `npm run build` + `npx playwright test`.

---

## Dosya Haritası

| Dosya | Sorumluluk |
|---|---|
| `src/domains/studyPlan/planMath.ts` | Saf hafta/kopya/özet mantığı + tip ve etiket sabitleri |
| `supabase/migrations/20260909120000_study_plan.sql` | İki tablo + RLS + index + rollback yorumu |
| `src/infrastructure/supabase/database.types.ts` | İki tablonun tip girdileri |
| `src/domains/studyPlan/repositories/StudyPlanRepository.ts` | Supabase sorguları (RLS'li user client) |
| `src/domains/studyPlan/services/StudyPlanService.ts` | Yetki (ability + teacher_classes), iş kuralları, Türkçe hata |
| `app/actions/study-plan.ts` | zod doğrulama → servis → revalidatePath |
| `app/(dashboard)/siniflar/[id]/plan/page.tsx` | Sınıf haftalık tablosu (server) |
| `app/(dashboard)/siniflar/[id]/plan/loading.tsx` | İskelet |
| `app/(dashboard)/siniflar/[id]/plan/HaftaEditoru.tsx` | Client editör (madde ekle/durum/sil/kaynak/kopyala) |
| `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/HaftalikPlanSection.tsx` | Öğrenci 360 bölümü (server, editörü sarar) |
| `tests/vitest/unit/studyPlan/planMath.test.ts` | Saf mantık testleri |
| `tests/vitest/unit/studyPlan/study-plan-service.test.ts` | Servis yetki/iş kuralı testleri |
| `tests/playwright/e2e/plan.spec.ts` | Uçtan uca akış |

---

### Task 1: planMath — saf hafta mantığı

**Files:**
- Create: `src/domains/studyPlan/planMath.ts`
- Test: `tests/vitest/unit/studyPlan/planMath.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type PlanStatus = 'planlandi' | 'yapildi' | 'eksik' | 'yapilmadi'
  export const PLAN_STATUSES: readonly PlanStatus[]
  export const PLAN_STATUS_LABELS: Record<PlanStatus, string>
  export const DAY_LABELS: readonly string[]            // ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz']
  export function weekStartOf(iso: string): string       // 'YYYY-MM-DD' → o haftanın Pazartesi'si
  export function shiftWeek(weekStart: string, delta: number): string
  export function weekDays(weekStart: string): string[]  // 7 eleman
  export function isInWeek(iso: string, weekStart: string): boolean
  export function dayLabel(iso: string | null): string   // null → 'Hafta', aksi 'Pzt'..'Paz'
  export function formatWeekLabel(weekStart: string): string // '7 – 13 Eylül 2026'
  export function copyWeek<T extends CopySource>(items: T[], fromWeek: string, toWeek: string): CopiedItem[]
  export function weekSummary(items: { status: PlanStatus }[]): WeekSummary
  export function groupBySubject<T extends { subject: string }>(items: T[]): { subject: string; items: T[] }[]
  ```

- [ ] **Step 1: Failing testleri yaz**

`tests/vitest/unit/studyPlan/planMath.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  weekStartOf, shiftWeek, weekDays, isInWeek, dayLabel, formatWeekLabel,
  copyWeek, weekSummary, groupBySubject,
} from '@/src/domains/studyPlan/planMath'

describe('weekStartOf()', () => {
  it('Pazartesi kendisi', () => expect(weekStartOf('2026-09-07')).toBe('2026-09-07'))
  it('Çarşamba → Pazartesi', () => expect(weekStartOf('2026-09-09')).toBe('2026-09-07'))
  it('Pazar → önceki Pazartesi (JS getDay=0 tuzağı)', () => expect(weekStartOf('2026-09-13')).toBe('2026-09-07'))
  it('yıl geçişi: 2027-01-01 (Cuma) → 2026-12-28', () => expect(weekStartOf('2027-01-01')).toBe('2026-12-28'))
})

describe('shiftWeek() / weekDays() / isInWeek()', () => {
  it('+1 hafta', () => expect(shiftWeek('2026-09-07', 1)).toBe('2026-09-14'))
  it('-1 hafta yıl geçişi', () => expect(shiftWeek('2027-01-04', -1)).toBe('2026-12-28'))
  it('weekDays 7 gün Pzt..Paz', () => {
    const d = weekDays('2026-09-07')
    expect(d).toHaveLength(7)
    expect(d[0]).toBe('2026-09-07'); expect(d[6]).toBe('2026-09-13')
  })
  it('isInWeek sınırlar dahil, dışı hariç', () => {
    expect(isInWeek('2026-09-07', '2026-09-07')).toBe(true)
    expect(isInWeek('2026-09-13', '2026-09-07')).toBe(true)
    expect(isInWeek('2026-09-14', '2026-09-07')).toBe(false)
    expect(isInWeek('2026-09-06', '2026-09-07')).toBe(false)
  })
})

describe('dayLabel() / formatWeekLabel()', () => {
  it('null → Hafta', () => expect(dayLabel(null)).toBe('Hafta'))
  it('Pazar → Paz', () => expect(dayLabel('2026-09-13')).toBe('Paz'))
  it('aynı ay', () => expect(formatWeekLabel('2026-09-07')).toBe('7 – 13 Eylül 2026'))
  it('ay geçişi', () => expect(formatWeekLabel('2026-09-28')).toBe('28 Eylül – 4 Ekim 2026'))
  it('yıl geçişi', () => expect(formatWeekLabel('2026-12-28')).toBe('28 Aralık 2026 – 3 Ocak 2027'))
})

describe('copyWeek()', () => {
  const items = [
    { plan_date: '2026-09-09', source: 'Apotemi', description: 'Türev 40 soru', subject: 'Matematik', status: 'yapildi' as const, note: 'iyi' },
    { plan_date: null,         source: null,      description: 'Deneme çöz',    subject: 'Matematik', status: 'eksik'   as const, note: null },
  ]
  it('aynı haftagününe kaydırır, durum/notu sıfırlar', () => {
    const out = copyWeek(items, '2026-09-07', '2026-09-14')
    expect(out).toEqual([
      { plan_date: '2026-09-16', source: 'Apotemi', description: 'Türev 40 soru', subject: 'Matematik', status: 'planlandi', note: null },
      { plan_date: null,         source: null,      description: 'Deneme çöz',    subject: 'Matematik', status: 'planlandi', note: null },
    ])
  })
  it('boş liste → boş', () => expect(copyWeek([], '2026-09-07', '2026-09-14')).toEqual([]))
})

describe('weekSummary()', () => {
  it('0 madde → yüzde 0', () => expect(weekSummary([])).toEqual({ toplam: 0, yapildi: 0, eksik: 0, yapilmadi: 0, yuzde: 0 }))
  it('sayar ve yüzdeyi yuvarlar', () => {
    const s = weekSummary([{ status: 'yapildi' }, { status: 'yapildi' }, { status: 'eksik' }, { status: 'planlandi' }])
    expect(s).toEqual({ toplam: 4, yapildi: 2, eksik: 1, yapilmadi: 0, yuzde: 50 })
  })
})

describe('groupBySubject()', () => {
  it('ilk görülme sırasıyla gruplar', () => {
    const g = groupBySubject([{ subject: 'Fizik', id: 1 }, { subject: 'Matematik', id: 2 }, { subject: 'Fizik', id: 3 }])
    expect(g.map(x => x.subject)).toEqual(['Fizik', 'Matematik'])
    expect(g[0].items.map(i => i.id)).toEqual([1, 3])
  })
})
```

- [ ] **Step 2: Testin düştüğünü gör**

Run: `npx vitest run tests/vitest/unit/studyPlan/planMath.test.ts`
Expected: FAIL — modül bulunamadı.

- [ ] **Step 3: planMath'i yaz**

`src/domains/studyPlan/planMath.ts`:

```ts
// Haftalık çalışma planı — saf mantık. Tarihler 'YYYY-MM-DD' string; TZ'siz UTC aritmetiği.

export type PlanStatus = 'planlandi' | 'yapildi' | 'eksik' | 'yapilmadi'
export const PLAN_STATUSES: readonly PlanStatus[] = ['planlandi', 'yapildi', 'eksik', 'yapilmadi']
export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  planlandi: 'Planlandı', yapildi: 'Yapıldı', eksik: 'Eksik', yapilmadi: 'Yapılmadı',
}
export const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

const MS_DAY = 86_400_000

function toUTC(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
function toISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}
/** 0=Pzt … 6=Paz */
function dayIndex(iso: string): number {
  return (new Date(toUTC(iso)).getUTCDay() + 6) % 7
}

export function weekStartOf(iso: string): string {
  return toISO(toUTC(iso) - dayIndex(iso) * MS_DAY)
}
export function shiftWeek(weekStart: string, delta: number): string {
  return toISO(toUTC(weekStart) + delta * 7 * MS_DAY)
}
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => toISO(toUTC(weekStart) + i * MS_DAY))
}
export function isInWeek(iso: string, weekStart: string): boolean {
  const diff = (toUTC(iso) - toUTC(weekStart)) / MS_DAY
  return diff >= 0 && diff <= 6
}
export function dayLabel(iso: string | null): string {
  return iso ? DAY_LABELS[dayIndex(iso)] : 'Hafta'
}
export function formatWeekLabel(weekStart: string): string {
  const a = new Date(toUTC(weekStart)), b = new Date(toUTC(weekStart) + 6 * MS_DAY)
  const da = a.getUTCDate(), db = b.getUTCDate()
  const ma = MONTHS[a.getUTCMonth()], mb = MONTHS[b.getUTCMonth()]
  const ya = a.getUTCFullYear(), yb = b.getUTCFullYear()
  if (ya !== yb) return `${da} ${ma} ${ya} – ${db} ${mb} ${yb}`
  if (ma !== mb) return `${da} ${ma} – ${db} ${mb} ${ya}`
  return `${da} – ${db} ${ma} ${ya}`
}

export interface CopySource {
  plan_date: string | null
  source: string | null
  description: string
  subject: string
}
export interface CopiedItem extends CopySource {
  status: 'planlandi'
  note: null
}
/** Önceki haftanın maddelerini yeni haftaya taşır: aynı haftagünü, durum/not sıfır. */
export function copyWeek<T extends CopySource>(items: T[], fromWeek: string, toWeek: string): CopiedItem[] {
  const offset = toUTC(toWeek) - toUTC(fromWeek)
  return items.map(i => ({
    plan_date: i.plan_date ? toISO(toUTC(i.plan_date) + offset) : null,
    source: i.source,
    description: i.description,
    subject: i.subject,
    status: 'planlandi',
    note: null,
  }))
}

export interface WeekSummary { toplam: number; yapildi: number; eksik: number; yapilmadi: number; yuzde: number }
export function weekSummary(items: { status: PlanStatus }[]): WeekSummary {
  const s = { toplam: items.length, yapildi: 0, eksik: 0, yapilmadi: 0, yuzde: 0 }
  for (const i of items) {
    if (i.status === 'yapildi') s.yapildi++
    else if (i.status === 'eksik') s.eksik++
    else if (i.status === 'yapilmadi') s.yapilmadi++
  }
  s.yuzde = s.toplam ? Math.round((s.yapildi / s.toplam) * 100) : 0
  return s
}

export function groupBySubject<T extends { subject: string }>(items: T[]): { subject: string; items: T[] }[] {
  const map = new Map<string, T[]>()
  for (const i of items) {
    const arr = map.get(i.subject)
    if (arr) arr.push(i); else map.set(i.subject, [i])
  }
  return [...map.entries()].map(([subject, items]) => ({ subject, items }))
}
```

- [ ] **Step 4: Testler geçsin**

Run: `npx vitest run tests/vitest/unit/studyPlan/planMath.test.ts`
Expected: 17 passed.

- [ ] **Step 5: Commit + push**

```bash
git add src/domains/studyPlan/planMath.ts tests/vitest/unit/studyPlan/planMath.test.ts
git commit -m "feat(plan): planMath — hafta aritmetiği, kopyalama, özet"
git push -u origin feat/haftalik-calisma-plani
```

---

### Task 2: Migration + DB tipleri

**Files:**
- Create: `supabase/migrations/20260909120000_study_plan.sql`
- Modify: `src/infrastructure/supabase/database.types.ts` (Tables altına iki girdi)

**Interfaces:**
- Produces: `Database['public']['Tables']['study_plan_items']` ve `['student_sources']` tipleri; Task 3 repository `db.from('study_plan_items')` bunlara dayanır.

- [ ] **Step 1: Migration dosyasını yaz**

```sql
-- Haftalık çalışma planı (öğrenciye özel kaynak + talimat + durum).
-- Spec: docs/superpowers/specs/2026-09-09-haftalik-calisma-plani-design.md
-- Yalnız YENİ tablo ekler; mevcut tablolara dokunmaz. Geri alma: dosya sonundaki ROLLBACK bloğu.

create table if not exists public.student_sources (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null,
  student_id uuid not null references public.students(id) on delete cascade,
  subject    text not null,
  name       text not null check (char_length(name) between 1 and 120),
  active     boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.study_plan_items (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null,
  student_id  uuid not null references public.students(id) on delete cascade,
  teacher_id  uuid not null references public.profiles(id) on delete cascade,
  subject     text not null,
  week_start  date not null,
  plan_date   date,
  source      text check (source is null or char_length(source) <= 120),
  description text not null check (char_length(description) between 1 and 300),
  status      text not null default 'planlandi'
              check (status in ('planlandi', 'yapildi', 'eksik', 'yapilmadi')),
  note        text check (note is null or char_length(note) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint spi_week_monday    check (extract(isodow from week_start) = 1),
  constraint spi_date_in_week   check (plan_date is null or (plan_date >= week_start and plan_date <= week_start + 6))
);

alter table public.student_sources  enable row level security;
alter table public.study_plan_items enable row level security;

drop policy if exists student_sources_school_all on public.student_sources;
create policy student_sources_school_all on public.student_sources
  for all to authenticated
  using      (school_id = (select profiles.school_id from public.profiles where profiles.id = (select auth.uid())))
  with check (school_id = (select profiles.school_id from public.profiles where profiles.id = (select auth.uid())));

drop policy if exists spi_school_all on public.study_plan_items;
create policy spi_school_all on public.study_plan_items
  for all to authenticated
  using      (school_id = (select profiles.school_id from public.profiles where profiles.id = (select auth.uid())))
  with check (school_id = (select profiles.school_id from public.profiles where profiles.id = (select auth.uid())));

create index if not exists idx_spi_student_week on public.study_plan_items (student_id, week_start);
create index if not exists idx_spi_teacher_week on public.study_plan_items (teacher_id, week_start);
create index if not exists idx_student_sources_student on public.student_sources (student_id) where active;

-- updated_at bakımı
create or replace function public.spi_touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_spi_touch on public.study_plan_items;
create trigger trg_spi_touch before update on public.study_plan_items
  for each row execute function public.spi_touch_updated_at();

-- ROLLBACK (özellik geri alınırsa SQL editöründe çalıştır):
-- drop trigger if exists trg_spi_touch on public.study_plan_items;
-- drop function if exists public.spi_touch_updated_at();
-- drop table if exists public.study_plan_items;
-- drop table if exists public.student_sources;
```

- [ ] **Step 2: Canlıya uygula**

Tercih: Supabase MCP `apply_migration(project_id: 'agijvfrcudpzsofgfogu', name: 'study_plan', query: <SQL>)`. MCP OAuth tamamlanmamışsa (bkz memory): SQL'i kullanıcıya ver, Supabase Dashboard → SQL Editor'de çalıştırmasını iste; **bu adım bloklayıcıdır** (e2e ve Task 3 sorguları canlı tabloya ihtiyaç duyar).
Expected: iki tablo + policy'ler oluşur; `select count(*) from study_plan_items` → 0.

- [ ] **Step 3: DB tiplerini güncelle**

Tercih: MCP `generate_typescript_types` → dosyaya yaz (JSON sarmalı: `types` alanını unescape et). Fallback: `database.types.ts` içinde `Tables:` altına, alfabetik sırada (`student_notes` sonrası `student_sources`, `students` sonrası `study_plan_items`) mevcut girdi biçiminde el ile ekle:

```ts
      student_sources: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          school_id: string
          student_id: string
          subject: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          school_id: string
          student_id: string
          subject: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          school_id?: string
          student_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_sources_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plan_items: {
        Row: {
          created_at: string
          description: string
          id: string
          note: string | null
          plan_date: string | null
          school_id: string
          source: string | null
          status: string
          student_id: string
          subject: string
          teacher_id: string
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          note?: string | null
          plan_date?: string | null
          school_id: string
          source?: string | null
          status?: string
          student_id: string
          subject: string
          teacher_id: string
          updated_at?: string
          week_start: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          note?: string | null
          plan_date?: string | null
          school_id?: string
          source?: string | null
          status?: string
          student_id?: string
          subject?: string
          teacher_id?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_plan_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_plan_items_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
```

Not: `students` tablosuna işaret eden mevcut girdilerde `referencedRelation: "students"` dışında view'lar da listelenebilir (ör. `active_homeworks` gibi); el ile eklemede yalnız yukarıdaki ikisi yeterli — join `profiles(full_name)` bu FK üzerinden çözülür.

- [ ] **Step 4: tsc**

Run: `npx tsc --noEmit`
Expected: temiz (henüz tabloyu kullanan kod yok; sadece tip dosyası sözdizimi doğrulanır).

- [ ] **Step 5: Commit + push**

```bash
git add supabase/migrations/20260909120000_study_plan.sql src/infrastructure/supabase/database.types.ts
git commit -m "feat(plan): study_plan_items + student_sources migration ve DB tipleri"
git push
```

---

### Task 3: Repository + Service (yetki ve iş kuralları)

**Files:**
- Create: `src/domains/studyPlan/repositories/StudyPlanRepository.ts`
- Create: `src/domains/studyPlan/services/StudyPlanService.ts`
- Test: `tests/vitest/unit/studyPlan/study-plan-service.test.ts`

**Interfaces:**
- Consumes: Task 1 `planMath` (`PlanStatus`, `copyWeek`, `shiftWeek`), Task 2 tipleri.
- Produces:
  ```ts
  export interface PlanItem { id: string; student_id: string; teacher_id: string; subject: string; week_start: string; plan_date: string | null; source: string | null; description: string; status: PlanStatus; note: string | null }
  export interface PlanItemWithTeacher extends PlanItem { teacher_name: string }
  export interface StudentSource { id: string; name: string; subject: string }
  export interface StudentPlanRow { id: string; full_name: string; student_number: string | null; items: PlanItem[] }
  StudyPlanService.getClassWeek(classId, weekStart): Promise<{ students: StudentPlanRow[]; error?: string }>
  StudyPlanService.getStudentWeek(studentId, weekStart): Promise<{ items: PlanItemWithTeacher[]; error?: string }>
  StudyPlanService.getSources(studentId): Promise<StudentSource[]>
  StudyPlanService.canWriteFor(studentId): Promise<boolean>
  StudyPlanService.addSource(studentId, name): Promise<{ error?: string; id?: string }>
  StudyPlanService.removeSource(id): Promise<{ error?: string }>
  StudyPlanService.addItem(input: { studentId; weekStart; planDate: string | null; source: string | null; description }): Promise<{ error?: string; id?: string }>
  StudyPlanService.updateItem(id, patch: { description?; source?: string | null; planDate?: string | null; status?: PlanStatus; note?: string | null }): Promise<{ error?: string }>
  StudyPlanService.deleteItem(id): Promise<{ error?: string }>
  StudyPlanService.copyPreviousWeek(studentId, weekStart): Promise<{ error?: string; count?: number }>
  ```

- [ ] **Step 1: Failing servis testlerini yaz**

`tests/vitest/unit/studyPlan/study-plan-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS, MUDUR_PERMS } from '../../setup/factories'
import type { GrantedPermission } from '@/src/shared/permissions'

vi.mock('@/src/shared/authorization/server', () => ({ requireAbility: vi.fn(), getAbility: vi.fn() }))
vi.mock('@/src/shared/auth', () => ({ getCurrentProfile: vi.fn() }))
vi.mock('@/src/infrastructure/observability/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/src/domains/studyPlan/repositories/StudyPlanRepository', () => ({
  StudyPlanRepository: {
    studentClassId:      vi.fn(),
    isTeacherOfClass:    vi.fn(),
    listStudentsOfClass: vi.fn(),
    listTeacherItems:    vi.fn(),
    listStudentItems:    vi.fn(),
    listSources:         vi.fn(),
    insertSource:        vi.fn(),
    deactivateSource:    vi.fn(),
    insertItems:         vi.fn(),
    updateItem:          vi.fn(),
    deleteItem:          vi.fn(),
  },
}))

const { requireAbility }     = await import('@/src/shared/authorization/server')
const { getCurrentProfile }  = await import('@/src/shared/auth')
const { StudyPlanRepository } = await import('@/src/domains/studyPlan/repositories/StudyPlanRepository')
const { StudyPlanService }   = await import('@/src/domains/studyPlan/services/StudyPlanService')

const SCHOOL = 'school-1', TEACHER = 'teacher-1', STUDENT = 'student-1', CLASS = 'class-1'
const NO_WRITE: GrantedPermission[] = OGRETMEN_PERMS.filter(p => !(p.resource === 'homework' && p.action !== 'read'))

function ability(perms = OGRETMEN_PERMS, userId = TEACHER) {
  return createAbility({ userId, schoolId: SCHOOL, permissions: perms })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAbility).mockResolvedValue(ability())
  vi.mocked(getCurrentProfile).mockResolvedValue({ id: TEACHER, subject: 'Matematik', role: 'ogretmen', school_id: SCHOOL, full_name: 'T' } as never)
  vi.mocked(StudyPlanRepository.studentClassId).mockResolvedValue({ data: { class_id: CLASS }, error: null } as never)
  vi.mocked(StudyPlanRepository.isTeacherOfClass).mockResolvedValue(true)
  vi.mocked(StudyPlanRepository.insertItems).mockResolvedValue({ data: [{ id: 'item-1' }], error: null } as never)
  vi.mocked(StudyPlanRepository.updateItem).mockResolvedValue({ data: [{ id: 'item-1' }], error: null } as never)
  vi.mocked(StudyPlanRepository.deleteItem).mockResolvedValue({ data: [{ id: 'item-1' }], error: null } as never)
  vi.mocked(StudyPlanRepository.listTeacherItems).mockResolvedValue({ data: [], error: null } as never)
})

describe('StudyPlanService.addItem', () => {
  it('teacher_id/school_id/subject ability ve profilden yazılır', async () => {
    const r = await StudyPlanService.addItem({ studentId: STUDENT, weekStart: '2026-09-07', planDate: null, source: 'Apotemi', description: 'Türev 40 soru' })
    expect(r).toEqual({ id: 'item-1' })
    expect(StudyPlanRepository.insertItems).toHaveBeenCalledWith([expect.objectContaining({
      teacher_id: TEACHER, school_id: SCHOOL, student_id: STUDENT, subject: 'Matematik',
      week_start: '2026-09-07', status: 'planlandi',
    })])
  })
  it('profil subject null → Genel', async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue({ id: TEACHER, subject: null } as never)
    await StudyPlanService.addItem({ studentId: STUDENT, weekStart: '2026-09-07', planDate: null, source: null, description: 'x' })
    expect(StudyPlanRepository.insertItems).toHaveBeenCalledWith([expect.objectContaining({ subject: 'Genel' })])
  })
  it('homework.create izni yoksa reddeder', async () => {
    vi.mocked(requireAbility).mockResolvedValue(ability(NO_WRITE))
    const r = await StudyPlanService.addItem({ studentId: STUDENT, weekStart: '2026-09-07', planDate: null, source: null, description: 'x' })
    expect(r.error).toBe('Bu işlem için yetkiniz yok.')
    expect(StudyPlanRepository.insertItems).not.toHaveBeenCalled()
  })
  it('öğrencinin sınıfı teacher_classes dışındaysa reddeder (müdür bile olsa)', async () => {
    vi.mocked(requireAbility).mockResolvedValue(ability(MUDUR_PERMS, 'mudur-1'))
    vi.mocked(StudyPlanRepository.isTeacherOfClass).mockResolvedValue(false)
    const r = await StudyPlanService.addItem({ studentId: STUDENT, weekStart: '2026-09-07', planDate: null, source: null, description: 'x' })
    expect(r.error).toBe('Bu öğrencinin sınıfına atanmış değilsiniz.')
  })
  it('plan_date hafta dışındaysa reddeder', async () => {
    const r = await StudyPlanService.addItem({ studentId: STUDENT, weekStart: '2026-09-07', planDate: '2026-09-14', source: null, description: 'x' })
    expect(r.error).toBe('Gün seçilen haftanın içinde olmalı.')
  })
  it('öğrenci başka okulda/silinmişse reddeder', async () => {
    vi.mocked(StudyPlanRepository.studentClassId).mockResolvedValue({ data: null, error: null } as never)
    const r = await StudyPlanService.addItem({ studentId: STUDENT, weekStart: '2026-09-07', planDate: null, source: null, description: 'x' })
    expect(r.error).toBe('Öğrenci bulunamadı.')
  })
})

describe('StudyPlanService.updateItem / deleteItem', () => {
  it('yalnız kendi maddesi: repo teacherId ile kısıtlanır, 0 satır → hata', async () => {
    vi.mocked(StudyPlanRepository.updateItem).mockResolvedValue({ data: [], error: null } as never)
    const r = await StudyPlanService.updateItem('item-9', { status: 'yapildi' })
    expect(StudyPlanRepository.updateItem).toHaveBeenCalledWith('item-9', TEACHER, SCHOOL, { status: 'yapildi' })
    expect(r.error).toBe('Madde bulunamadı veya size ait değil.')
  })
  it('update izni yoksa reddeder', async () => {
    vi.mocked(requireAbility).mockResolvedValue(ability(NO_WRITE))
    const r = await StudyPlanService.updateItem('item-1', { note: 'n' })
    expect(r.error).toBe('Bu işlem için yetkiniz yok.')
  })
  it('delete 0 satır → hata', async () => {
    vi.mocked(StudyPlanRepository.deleteItem).mockResolvedValue({ data: [], error: null } as never)
    const r = await StudyPlanService.deleteItem('item-9')
    expect(r.error).toBe('Madde bulunamadı veya size ait değil.')
  })
})

describe('StudyPlanService.copyPreviousWeek', () => {
  it('hedef hafta doluysa hata', async () => {
    vi.mocked(StudyPlanRepository.listTeacherItems).mockResolvedValueOnce({ data: [{ id: 'x' }], error: null } as never)
    const r = await StudyPlanService.copyPreviousWeek(STUDENT, '2026-09-14')
    expect(r.error).toBe('Bu hafta boş değil.')
  })
  it('önceki hafta boşsa hata', async () => {
    vi.mocked(StudyPlanRepository.listTeacherItems)
      .mockResolvedValueOnce({ data: [], error: null } as never)   // hedef
      .mockResolvedValueOnce({ data: [], error: null } as never)   // kaynak
    const r = await StudyPlanService.copyPreviousWeek(STUDENT, '2026-09-14')
    expect(r.error).toBe('Geçen hafta plan yok.')
  })
  it('kopyalar: tarih kayar, durum sıfırlanır, count döner', async () => {
    vi.mocked(StudyPlanRepository.listTeacherItems)
      .mockResolvedValueOnce({ data: [], error: null } as never)
      .mockResolvedValueOnce({ data: [
        { plan_date: '2026-09-09', source: 'A', description: 'd', subject: 'Matematik', status: 'yapildi', note: 'n' },
      ], error: null } as never)
    vi.mocked(StudyPlanRepository.insertItems).mockResolvedValue({ data: [{ id: 'new-1' }], error: null } as never)
    const r = await StudyPlanService.copyPreviousWeek(STUDENT, '2026-09-14')
    expect(r).toEqual({ count: 1 })
    expect(StudyPlanRepository.insertItems).toHaveBeenCalledWith([expect.objectContaining({
      plan_date: '2026-09-16', status: 'planlandi', note: null, week_start: '2026-09-14', teacher_id: TEACHER,
    })])
  })
})

describe('StudyPlanService okuma', () => {
  it('getClassWeek: öğrencileri maddeleriyle eşler; sınıf dışı öğretmene boş+hata', async () => {
    vi.mocked(StudyPlanRepository.listStudentsOfClass).mockResolvedValue({ data: [
      { id: 's1', full_name: 'Ali', student_number: '1' }, { id: 's2', full_name: 'Ayşe', student_number: '2' },
    ], error: null } as never)
    vi.mocked(StudyPlanRepository.listTeacherItems).mockResolvedValue({ data: [
      { id: 'i1', student_id: 's2', teacher_id: TEACHER, subject: 'Matematik', week_start: '2026-09-07', plan_date: null, source: null, description: 'd', status: 'planlandi', note: null },
    ], error: null } as never)
    const r = await StudyPlanService.getClassWeek(CLASS, '2026-09-07')
    expect(r.students.map(s => s.items.length)).toEqual([0, 1])

    vi.mocked(StudyPlanRepository.isTeacherOfClass).mockResolvedValue(false)
    const r2 = await StudyPlanService.getClassWeek(CLASS, '2026-09-07')
    expect(r2.students).toEqual([])
    expect(r2.error).toBe('Bu sınıfa atanmış değilsiniz.')
  })
  it('getStudentWeek: profiles join → teacher_name', async () => {
    vi.mocked(StudyPlanRepository.listStudentItems).mockResolvedValue({ data: [
      { id: 'i1', student_id: STUDENT, teacher_id: 't2', subject: 'Fizik', week_start: '2026-09-07', plan_date: null, source: null, description: 'd', status: 'eksik', note: null, profiles: { full_name: 'Fizikçi' } },
    ], error: null } as never)
    const r = await StudyPlanService.getStudentWeek(STUDENT, '2026-09-07')
    expect(r.items[0].teacher_name).toBe('Fizikçi')
  })
  it('canWriteFor: izin + sınıf ataması', async () => {
    expect(await StudyPlanService.canWriteFor(STUDENT)).toBe(true)
    vi.mocked(StudyPlanRepository.isTeacherOfClass).mockResolvedValue(false)
    expect(await StudyPlanService.canWriteFor(STUDENT)).toBe(false)
  })
})
```

- [ ] **Step 2: Düştüğünü gör**

Run: `npx vitest run tests/vitest/unit/studyPlan/study-plan-service.test.ts`
Expected: FAIL — modül yok.

- [ ] **Step 3: Repository'yi yaz**

`src/domains/studyPlan/repositories/StudyPlanRepository.ts`:

```ts
import { createClient } from '@/src/infrastructure/supabase/server'

const ITEM_COLS = 'id, student_id, teacher_id, subject, week_start, plan_date, source, description, status, note'

export interface PlanItemInsert {
  school_id: string
  student_id: string
  teacher_id: string
  subject: string
  week_start: string
  plan_date: string | null
  source: string | null
  description: string
  status: string
  note: string | null
}

export interface PlanItemPatch {
  description?: string
  source?: string | null
  plan_date?: string | null
  status?: string
  note?: string | null
}

// RLS okul-kapsamlı; öğretmen/sınıf kısıtı serviste + teacher_id filtreleriyle.
export const StudyPlanRepository = {
  async studentClassId(studentId: string, schoolId: string) {
    const db = await createClient()
    return db.from('students').select('class_id').eq('id', studentId).eq('school_id', schoolId).is('deleted_at', null).maybeSingle()
  },

  async isTeacherOfClass(teacherId: string, classId: string): Promise<boolean> {
    const db = await createClient()
    const { data } = await db.from('teacher_classes').select('class_id').eq('teacher_id', teacherId).eq('class_id', classId).maybeSingle()
    return !!data
  },

  async listStudentsOfClass(classId: string, schoolId: string) {
    const db = await createClient()
    return db.from('students').select('id, full_name, student_number')
      .eq('class_id', classId).eq('school_id', schoolId).is('deleted_at', null).order('full_name').limit(500)
  },

  async listTeacherItems(teacherId: string, schoolId: string, weekStart: string, studentIds?: string[]) {
    const db = await createClient()
    let q = db.from('study_plan_items').select(ITEM_COLS)
      .eq('teacher_id', teacherId).eq('school_id', schoolId).eq('week_start', weekStart)
      .order('plan_date', { ascending: true, nullsFirst: true }).order('created_at')
    if (studentIds) q = q.in('student_id', studentIds)
    return q.limit(2000)
  },

  async listStudentItems(studentId: string, schoolId: string, weekStart: string) {
    const db = await createClient()
    return db.from('study_plan_items').select(`${ITEM_COLS}, profiles(full_name)`)
      .eq('student_id', studentId).eq('school_id', schoolId).eq('week_start', weekStart)
      .order('plan_date', { ascending: true, nullsFirst: true }).order('created_at').limit(500)
  },

  async listSources(studentId: string, schoolId: string) {
    const db = await createClient()
    return db.from('student_sources').select('id, name, subject')
      .eq('student_id', studentId).eq('school_id', schoolId).eq('active', true).order('name')
  },

  async insertSource(row: { school_id: string; student_id: string; subject: string; name: string; created_by: string }) {
    const db = await createClient()
    return db.from('student_sources').insert(row).select('id').single()
  },

  async deactivateSource(id: string, schoolId: string) {
    const db = await createClient()
    return db.from('student_sources').update({ active: false }).eq('id', id).eq('school_id', schoolId).select('id')
  },

  async insertItems(rows: PlanItemInsert[]) {
    const db = await createClient()
    return db.from('study_plan_items').insert(rows).select('id')
  },

  async updateItem(id: string, teacherId: string, schoolId: string, patch: PlanItemPatch) {
    const db = await createClient()
    return db.from('study_plan_items').update(patch).eq('id', id).eq('teacher_id', teacherId).eq('school_id', schoolId).select('id')
  },

  async deleteItem(id: string, teacherId: string, schoolId: string) {
    const db = await createClient()
    return db.from('study_plan_items').delete().eq('id', id).eq('teacher_id', teacherId).eq('school_id', schoolId).select('id')
  },
}
```

- [ ] **Step 4: Service'i yaz**

`src/domains/studyPlan/services/StudyPlanService.ts`:

```ts
import { requireAbility } from '@/src/shared/authorization/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { P } from '@/src/shared/permissions'
import { logger } from '@/src/infrastructure/observability/logger'
import { StudyPlanRepository } from '../repositories/StudyPlanRepository'
import { copyWeek, isInWeek, shiftWeek, type PlanStatus } from '../planMath'

export interface PlanItem {
  id: string; student_id: string; teacher_id: string; subject: string
  week_start: string; plan_date: string | null; source: string | null
  description: string; status: PlanStatus; note: string | null
}
export interface PlanItemWithTeacher extends PlanItem { teacher_name: string }
export interface StudentSource { id: string; name: string; subject: string }
export interface StudentPlanRow { id: string; full_name: string; student_number: string | null; items: PlanItem[] }

const YETKI_YOK = 'Bu işlem için yetkiniz yok.'
const SINIF_DISI = 'Bu öğrencinin sınıfına atanmış değilsiniz.'
const KENDI_DEGIL = 'Madde bulunamadı veya size ait değil.'

// Yazma kapısı: izin + öğrencinin sınıfı öğretmene atanmış olmalı (müdür de dahil — v1 bilinçli).
async function writeGate(studentId: string, perm: typeof P.HOMEWORK.CREATE) {
  const ability = await requireAbility()
  if (ability.cannot(perm)) return { error: YETKI_YOK } as const
  const { data, error } = await StudyPlanRepository.studentClassId(studentId, ability.schoolId)
  if (error) {
    logger.error({ event: 'plan_student_lookup_failed', userId: ability.userId, err: error.message }, 'Öğrenci sınıfı okunamadı')
    return { error: 'Öğrenci bulunamadı.' } as const
  }
  if (!data) return { error: 'Öğrenci bulunamadı.' } as const
  if (!(await StudyPlanRepository.isTeacherOfClass(ability.userId, data.class_id))) return { error: SINIF_DISI } as const
  return { ability, classId: data.class_id } as const
}

async function currentSubject(): Promise<string> {
  const profile = await getCurrentProfile()
  return profile?.subject?.trim() || 'Genel'
}

export const StudyPlanService = {
  async getClassWeek(classId: string, weekStart: string): Promise<{ students: StudentPlanRow[]; error?: string }> {
    const ability = await requireAbility()
    if (ability.cannot(P.HOMEWORK.READ)) return { students: [], error: YETKI_YOK }
    if (!(await StudyPlanRepository.isTeacherOfClass(ability.userId, classId))) return { students: [], error: 'Bu sınıfa atanmış değilsiniz.' }
    const studentsRes = await StudyPlanRepository.listStudentsOfClass(classId, ability.schoolId)
    if (studentsRes.error) {
      logger.error({ event: 'plan_students_failed', userId: ability.userId, err: studentsRes.error.message }, 'Plan öğrenci listesi hatası')
      return { students: [], error: 'Öğrenciler yüklenemedi.' }
    }
    const students = studentsRes.data ?? []
    const itemsRes = await StudyPlanRepository.listTeacherItems(ability.userId, ability.schoolId, weekStart, students.map(s => s.id))
    if (itemsRes.error) {
      logger.error({ event: 'plan_items_failed', userId: ability.userId, err: itemsRes.error.message }, 'Plan maddeleri hatası')
      return { students: [], error: 'Plan yüklenemedi.' }
    }
    const byStudent = new Map<string, PlanItem[]>()
    for (const raw of itemsRes.data ?? []) {
      const it = raw as unknown as PlanItem
      const arr = byStudent.get(it.student_id)
      if (arr) arr.push(it); else byStudent.set(it.student_id, [it])
    }
    return { students: students.map(s => ({ ...s, items: byStudent.get(s.id) ?? [] })) }
  },

  async getStudentWeek(studentId: string, weekStart: string): Promise<{ items: PlanItemWithTeacher[]; error?: string }> {
    const ability = await requireAbility()
    if (ability.cannot(P.HOMEWORK.READ)) return { items: [], error: YETKI_YOK }
    const { data, error } = await StudyPlanRepository.listStudentItems(studentId, ability.schoolId, weekStart)
    if (error) {
      logger.error({ event: 'plan_student_items_failed', userId: ability.userId, err: error.message }, 'Öğrenci plan hatası')
      return { items: [], error: 'Plan yüklenemedi.' }
    }
    type Raw = PlanItem & { profiles: { full_name: string } | null }
    return { items: ((data ?? []) as unknown as Raw[]).map(({ profiles, ...it }) => ({ ...it, teacher_name: profiles?.full_name ?? 'Öğretmen' })) }
  },

  async getSources(studentId: string): Promise<StudentSource[]> {
    const ability = await requireAbility()
    const { data, error } = await StudyPlanRepository.listSources(studentId, ability.schoolId)
    if (error) {
      logger.error({ event: 'plan_sources_failed', userId: ability.userId, err: error.message }, 'Kaynak defteri hatası')
      return []
    }
    return data ?? []
  },

  async canWriteFor(studentId: string): Promise<boolean> {
    const gate = await writeGate(studentId, P.HOMEWORK.CREATE)
    return !('error' in gate)
  },

  async addSource(studentId: string, name: string): Promise<{ error?: string; id?: string }> {
    const gate = await writeGate(studentId, P.HOMEWORK.CREATE)
    if ('error' in gate) return { error: gate.error }
    const { data, error } = await StudyPlanRepository.insertSource({
      school_id: gate.ability.schoolId, student_id: studentId, subject: await currentSubject(), name, created_by: gate.ability.userId,
    })
    if (error || !data) {
      logger.error({ event: 'plan_source_insert_failed', userId: gate.ability.userId, err: error?.message }, 'Kaynak ekleme hatası')
      return { error: 'Kaynak eklenemedi.' }
    }
    return { id: data.id }
  },

  async removeSource(id: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    if (ability.cannot(P.HOMEWORK.DELETE)) return { error: YETKI_YOK }
    const { data, error } = await StudyPlanRepository.deactivateSource(id, ability.schoolId)
    if (error) {
      logger.error({ event: 'plan_source_delete_failed', userId: ability.userId, err: error.message }, 'Kaynak silme hatası')
      return { error: 'Kaynak silinemedi.' }
    }
    if (!data?.length) return { error: 'Kaynak bulunamadı.' }
    return {}
  },

  async addItem(input: { studentId: string; weekStart: string; planDate: string | null; source: string | null; description: string }): Promise<{ error?: string; id?: string }> {
    if (input.planDate && !isInWeek(input.planDate, input.weekStart)) return { error: 'Gün seçilen haftanın içinde olmalı.' }
    const gate = await writeGate(input.studentId, P.HOMEWORK.CREATE)
    if ('error' in gate) return { error: gate.error }
    const { data, error } = await StudyPlanRepository.insertItems([{
      school_id: gate.ability.schoolId, student_id: input.studentId, teacher_id: gate.ability.userId,
      subject: await currentSubject(), week_start: input.weekStart, plan_date: input.planDate,
      source: input.source, description: input.description, status: 'planlandi', note: null,
    }])
    if (error || !data?.length) {
      logger.error({ event: 'plan_item_insert_failed', userId: gate.ability.userId, err: error?.message }, 'Plan maddesi ekleme hatası')
      return { error: 'Madde eklenemedi.' }
    }
    return { id: data[0].id }
  },

  async updateItem(id: string, patch: { description?: string; source?: string | null; planDate?: string | null; status?: PlanStatus; note?: string | null }): Promise<{ error?: string }> {
    const ability = await requireAbility()
    if (ability.cannot(P.HOMEWORK.UPDATE)) return { error: YETKI_YOK }
    const { planDate, ...rest } = patch
    const dbPatch = planDate === undefined ? rest : { ...rest, plan_date: planDate }
    const { data, error } = await StudyPlanRepository.updateItem(id, ability.userId, ability.schoolId, dbPatch)
    if (error) {
      // 23514 = check ihlali (gün hafta dışı vb.)
      if (error.code === '23514') return { error: 'Gün seçilen haftanın içinde olmalı.' }
      logger.error({ event: 'plan_item_update_failed', userId: ability.userId, err: error.message }, 'Plan maddesi güncelleme hatası')
      return { error: 'Madde güncellenemedi.' }
    }
    if (!data?.length) return { error: KENDI_DEGIL }
    return {}
  },

  async deleteItem(id: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    if (ability.cannot(P.HOMEWORK.DELETE)) return { error: YETKI_YOK }
    const { data, error } = await StudyPlanRepository.deleteItem(id, ability.userId, ability.schoolId)
    if (error) {
      logger.error({ event: 'plan_item_delete_failed', userId: ability.userId, err: error.message }, 'Plan maddesi silme hatası')
      return { error: 'Madde silinemedi.' }
    }
    if (!data?.length) return { error: KENDI_DEGIL }
    return {}
  },

  async copyPreviousWeek(studentId: string, weekStart: string): Promise<{ error?: string; count?: number }> {
    const gate = await writeGate(studentId, P.HOMEWORK.CREATE)
    if ('error' in gate) return { error: gate.error }
    const { ability } = gate
    const target = await StudyPlanRepository.listTeacherItems(ability.userId, ability.schoolId, weekStart, [studentId])
    if (target.error) return { error: 'Plan yüklenemedi.' }
    if (target.data?.length) return { error: 'Bu hafta boş değil.' }
    const prevWeek = shiftWeek(weekStart, -1)
    const prev = await StudyPlanRepository.listTeacherItems(ability.userId, ability.schoolId, prevWeek, [studentId])
    if (prev.error) return { error: 'Plan yüklenemedi.' }
    if (!prev.data?.length) return { error: 'Geçen hafta plan yok.' }
    const copies = copyWeek(prev.data as unknown as PlanItem[], prevWeek, weekStart)
    const { data, error } = await StudyPlanRepository.insertItems(copies.map(c => ({
      ...c, school_id: ability.schoolId, student_id: studentId, teacher_id: ability.userId, week_start: weekStart,
    })))
    if (error) {
      logger.error({ event: 'plan_copy_failed', userId: ability.userId, err: error.message }, 'Plan kopyalama hatası')
      return { error: 'Kopyalanamadı.' }
    }
    return { count: data?.length ?? 0 }
  },
}
```

- [ ] **Step 5: Testler + tsc**

Run: `npx vitest run tests/vitest/unit/studyPlan/study-plan-service.test.ts && npx tsc --noEmit`
Expected: 15 passed; tsc temiz. (`as unknown as PlanItem` cast'ı: `status: string` → `PlanStatus` daralması için; DERS notu: önce cast'sız dene, tsc kırılırsa ekle.)

- [ ] **Step 6: Commit + push**

```bash
git add src/domains/studyPlan tests/vitest/unit/studyPlan/study-plan-service.test.ts
git commit -m "feat(plan): StudyPlanRepository + StudyPlanService (yetki, kopyalama)"
git push
```

---

### Task 4: Server action'lar

**Files:**
- Create: `app/actions/study-plan.ts`

**Interfaces:**
- Consumes: Task 3 `StudyPlanService`, Task 1 `PLAN_STATUSES`.
- Produces (client bileşenler bunları çağırır; hepsi `Promise<ActionResult<...>>`):
  ```ts
  addPlanItem(input: unknown)            // { studentId, weekStart, planDate?, source?, description }
  updatePlanItem(input: unknown)         // { id, description?, source?, planDate?, status?, note? }
  deletePlanItem(id: unknown)
  copyPreviousWeekPlan(input: unknown)   // { studentId, weekStart } → { count }
  addStudentSource(input: unknown)       // { studentId, name } → { id }
  removeStudentSource(id: unknown)
  ```

- [ ] **Step 1: Dosyayı yaz**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { StudyPlanService } from '@/src/domains/studyPlan/services/StudyPlanService'
import { PLAN_STATUSES } from '@/src/domains/studyPlan/planMath'
import type { ActionResult } from '@/src/shared/types'

const ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih')
const uuid = (msg: string) => z.string().uuid(msg)

const addSchema = z.object({
  studentId:   uuid('Geçersiz öğrenci'),
  weekStart:   ISO,
  planDate:    ISO.nullish(),
  source:      z.string().trim().max(120, 'Kaynak en fazla 120 karakter').nullish(),
  description: z.string().trim().min(1, 'Talimat boş olamaz').max(300, 'Talimat en fazla 300 karakter'),
})
const updateSchema = z.object({
  id:          uuid('Geçersiz madde'),
  description: z.string().trim().min(1, 'Talimat boş olamaz').max(300).optional(),
  source:      z.string().trim().max(120).nullable().optional(),
  planDate:    ISO.nullable().optional(),
  status:      z.enum(PLAN_STATUSES as [string, ...string[]]).optional(),
  note:        z.string().trim().max(300, 'Not en fazla 300 karakter').nullable().optional(),
})
const copySchema   = z.object({ studentId: uuid('Geçersiz öğrenci'), weekStart: ISO })
const sourceSchema = z.object({ studentId: uuid('Geçersiz öğrenci'), name: z.string().trim().min(1, 'Kaynak adı boş olamaz').max(120) })
const idSchema     = uuid('Geçersiz kimlik')

function revalidate() {
  revalidatePath('/siniflar/[id]/plan', 'page')
  revalidatePath('/siniflar/[id]/ogrenciler/[studentId]', 'page')
}
function invalid(e: z.ZodError) { return { error: e.issues[0]?.message ?? 'Geçersiz veri' } }

export async function addPlanItem(input: unknown): Promise<ActionResult<{ id?: string }>> {
  const p = addSchema.safeParse(input)
  if (!p.success) return invalid(p.error)
  const r = await StudyPlanService.addItem({
    studentId: p.data.studentId, weekStart: p.data.weekStart,
    planDate: p.data.planDate ?? null, source: p.data.source || null, description: p.data.description,
  })
  if (r.error) return { error: r.error }
  revalidate()
  return { id: r.id }
}

export async function updatePlanItem(input: unknown): Promise<ActionResult> {
  const p = updateSchema.safeParse(input)
  if (!p.success) return invalid(p.error)
  const { id, status, ...rest } = p.data
  const r = await StudyPlanService.updateItem(id, { ...rest, status: status as (typeof PLAN_STATUSES)[number] | undefined })
  if (r.error) return { error: r.error }
  revalidate()
  return {}
}

export async function deletePlanItem(id: unknown): Promise<ActionResult> {
  const p = idSchema.safeParse(id)
  if (!p.success) return invalid(p.error)
  const r = await StudyPlanService.deleteItem(p.data)
  if (r.error) return { error: r.error }
  revalidate()
  return {}
}

export async function copyPreviousWeekPlan(input: unknown): Promise<ActionResult<{ count?: number }>> {
  const p = copySchema.safeParse(input)
  if (!p.success) return invalid(p.error)
  const r = await StudyPlanService.copyPreviousWeek(p.data.studentId, p.data.weekStart)
  if (r.error) return { error: r.error }
  revalidate()
  return { count: r.count }
}

export async function addStudentSource(input: unknown): Promise<ActionResult<{ id?: string }>> {
  const p = sourceSchema.safeParse(input)
  if (!p.success) return invalid(p.error)
  const r = await StudyPlanService.addSource(p.data.studentId, p.data.name)
  if (r.error) return { error: r.error }
  revalidate()
  return { id: r.id }
}

export async function removeStudentSource(id: unknown): Promise<ActionResult> {
  const p = idSchema.safeParse(id)
  if (!p.success) return invalid(p.error)
  const r = await StudyPlanService.removeSource(p.data)
  if (r.error) return { error: r.error }
  revalidate()
  return {}
}
```

- [ ] **Step 2: tsc**

Run: `npx tsc --noEmit`
Expected: temiz. (`z.enum(PLAN_STATUSES as [...])` zod 4'te readonly tuple kabul etmezse `z.enum(['planlandi','yapildi','eksik','yapilmadi'])` literal'e düş.)

- [ ] **Step 3: Commit + push**

```bash
git add app/actions/study-plan.ts
git commit -m "feat(plan): server action'lar (zod → StudyPlanService → revalidate)"
git push
```

---

### Task 5: HaftaEditoru + sınıf haftalık plan sayfası

**Files:**
- Create: `app/(dashboard)/siniflar/[id]/plan/HaftaEditoru.tsx`
- Create: `app/(dashboard)/siniflar/[id]/plan/page.tsx`
- Create: `app/(dashboard)/siniflar/[id]/plan/loading.tsx`
- Modify: `app/(dashboard)/siniflar/[id]/page.tsx` (başlık satırının yanına "Haftalık Plan" linki; `SinifExportButton`'ın hemen öncesi)

**Interfaces:**
- Consumes: Task 3 tipleri (`PlanItem`, `PlanItemWithTeacher`, `StudentSource`, `StudentPlanRow`), Task 4 action'ları, Task 1 `planMath`.
- Produces: `HaftaEditoru` props — Task 6 aynı bileşeni kullanır:
  ```ts
  { studentId: string; weekStart: string; items: PlanItemWithTeacher[]; sources: StudentSource[];
    currentUserId: string; canWrite: boolean; showTeacher?: boolean }
  ```

- [ ] **Step 1: HaftaEditoru (client)**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { addPlanItem, updatePlanItem, deletePlanItem, copyPreviousWeekPlan, addStudentSource, removeStudentSource } from '@/app/actions/study-plan'
import { PLAN_STATUS_LABELS, weekDays, dayLabel, groupBySubject, type PlanStatus } from '@/src/domains/studyPlan/planMath'
import type { PlanItemWithTeacher, StudentSource } from '@/src/domains/studyPlan/services/StudyPlanService'

const STATUS_CLS: Record<PlanStatus, string> = {
  planlandi: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  yapildi:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  eksik:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  yapilmadi: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}
const CYCLE: PlanStatus[] = ['yapildi', 'eksik', 'yapilmadi']
const input = 'px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'

export default function HaftaEditoru({
  studentId, weekStart, items, sources, currentUserId, canWrite, showTeacher = false,
}: {
  studentId: string; weekStart: string; items: PlanItemWithTeacher[]; sources: StudentSource[]
  currentUserId: string; canWrite: boolean; showTeacher?: boolean
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [desc, setDesc] = useState('')
  const [source, setSource] = useState('')
  const [day, setDay] = useState('')
  const [newSource, setNewSource] = useState('')

  const days = weekDays(weekStart)
  const listId = `kaynaklar-${studentId}`
  const mine = items.filter(i => i.teacher_id === currentUserId)

  function run(fn: () => Promise<{ error?: string }>, after?: () => void) {
    setError(null)
    start(async () => {
      const r = await fn()
      if (r.error) setError(r.error); else after?.()
    })
  }

  const groups = showTeacher ? groupBySubject(items) : [{ subject: '', items }]

  return (
    <div className="space-y-3" data-hafta-editoru>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {items.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-slate-400">Bu hafta için plan yok.</p>
      )}

      {groups.map(g => (
        <div key={g.subject}>
          {g.subject && <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1">{g.subject}</p>}
          <ul className="space-y-1.5">
            {g.items.map(it => {
              const own = it.teacher_id === currentUserId
              return (
                <li key={it.id} className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <span className="text-xs w-10 shrink-0 text-gray-500 dark:text-slate-400">{dayLabel(it.plan_date)}</span>
                  <span className="flex-1 min-w-0 text-sm text-gray-900 dark:text-slate-100">
                    {it.source && <span className="font-medium">{it.source} · </span>}{it.description}
                    {showTeacher && !own && <span className="text-xs text-gray-500 dark:text-slate-400"> — {it.teacher_name}</span>}
                    {it.note && <span className="block text-xs text-gray-500 dark:text-slate-400">Not: {it.note}</span>}
                  </span>
                  {own && canWrite ? (
                    <span className="flex items-center gap-1">
                      {CYCLE.map(s => (
                        <button key={s} type="button" disabled={pending}
                          aria-pressed={it.status === s}
                          onClick={() => run(() => updatePlanItem({ id: it.id, status: it.status === s ? 'planlandi' : s }))}
                          className={`text-xs px-2 py-1 rounded-full ${it.status === s ? STATUS_CLS[s] + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-50 text-gray-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                          {PLAN_STATUS_LABELS[s]}
                        </button>
                      ))}
                      <button type="button" disabled={pending} aria-label="Maddeyi sil"
                        onClick={() => run(() => deletePlanItem(it.id))}
                        className="text-xs text-gray-500 dark:text-slate-400 hover:text-red-600 px-1">✕</button>
                    </span>
                  ) : (
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_CLS[it.status]}`}>{PLAN_STATUS_LABELS[it.status]}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      {canWrite && (
        <form
          className="flex flex-wrap gap-2 items-end"
          onSubmit={e => {
            e.preventDefault()
            run(() => addPlanItem({ studentId, weekStart, planDate: day || null, source: source || null, description: desc }),
              () => { setDesc(''); setSource('') })
          }}
        >
          <label className="text-xs text-gray-500 dark:text-slate-400">
            Gün
            <select value={day} onChange={e => setDay(e.target.value)} className={`${input} block mt-1`}>
              <option value="">Hafta</option>
              {days.map(d => <option key={d} value={d}>{dayLabel(d)}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-500 dark:text-slate-400">
            Kaynak
            <input list={listId} value={source} onChange={e => setSource(e.target.value)} placeholder="Kitap / kaynak" maxLength={120} className={`${input} block mt-1 w-40`} />
            <datalist id={listId}>{sources.map(s => <option key={s.id} value={s.name} />)}</datalist>
          </label>
          <label className="text-xs text-gray-500 dark:text-slate-400 flex-1 min-w-[12rem]">
            Talimat
            <input value={desc} onChange={e => setDesc(e.target.value)} required maxLength={300} placeholder="Türev 40 soru" className={`${input} block mt-1 w-full`} />
          </label>
          <button type="submit" disabled={pending || !desc.trim()} className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Ekle</button>
          {mine.length === 0 && (
            <button type="button" disabled={pending} onClick={() => run(() => copyPreviousWeekPlan({ studentId, weekStart }))}
              className="px-3 py-2 text-sm text-blue-700 dark:text-blue-300 hover:underline">Geçen haftayı kopyala</button>
          )}
        </form>
      )}

      {canWrite && (
        <details className="text-xs">
          <summary className="cursor-pointer text-gray-500 dark:text-slate-400">Kaynak defteri ({sources.length})</summary>
          <ul className="mt-1 flex flex-wrap gap-1">
            {sources.map(s => (
              <li key={s.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200">
                {s.name}
                <button type="button" aria-label={`${s.name} kaynağını sil`} disabled={pending}
                  onClick={() => run(() => removeStudentSource(s.id))} className="hover:text-red-600">✕</button>
              </li>
            ))}
          </ul>
          <form className="mt-1 flex gap-1" onSubmit={e => { e.preventDefault(); run(() => addStudentSource({ studentId, name: newSource }), () => setNewSource('')) }}>
            <input value={newSource} onChange={e => setNewSource(e.target.value)} placeholder="Yeni kitap" maxLength={120} className={`${input} w-40`} aria-label="Yeni kaynak adı" />
            <button type="submit" disabled={pending || !newSource.trim()} className="px-2 py-1 rounded-lg bg-gray-200 dark:bg-slate-600 text-gray-800 dark:text-slate-100">+ Kitap ekle</button>
          </form>
        </details>
      )}
    </div>
  )
}
```

Not: Server action'lar `revalidatePath` çağırdığı için Next client router'ı otomatik yeniler; optimistic state yok (spec kararı).

- [ ] **Step 2: Sınıf haftalık plan sayfası**

`app/(dashboard)/siniflar/[id]/plan/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { todayLocalISO } from '@/src/shared/date'
import { weekStartOf, shiftWeek, formatWeekLabel, weekSummary } from '@/src/domains/studyPlan/planMath'
import { StudyPlanService } from '@/src/domains/studyPlan/services/StudyPlanService'
import HaftaEditoru from './HaftaEditoru'

export const metadata = { title: 'Haftalık Plan' }

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export default async function SinifPlanPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ hafta?: string }> }) {
  const { id: classId } = await params
  const { hafta } = await searchParams
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/login')

  const supabase = await createClient()
  const { data: cls } = await supabase.from('classes').select('id, name').eq('id', classId).eq('school_id', profile.school_id).is('deleted_at', null).single()
  if (!cls) notFound()

  const weekStart = weekStartOf(hafta && ISO_RE.test(hafta) ? hafta : todayLocalISO())
  const { students, error } = await StudyPlanService.getClassWeek(classId, weekStart)

  // Kaynak defterleri: öğrenci başına tek sorgu yerine tüm sınıf için toplu (RLS okul-kapsamlı).
  const { data: sourceRows } = await supabase.from('student_sources').select('id, name, subject, student_id')
    .in('student_id', students.map(s => s.id)).eq('active', true).order('name')
  const sourcesByStudent = new Map<string, { id: string; name: string; subject: string }[]>()
  for (const s of sourceRows ?? []) {
    const arr = sourcesByStudent.get(s.student_id)
    const row = { id: s.id, name: s.name, subject: s.subject }
    if (arr) arr.push(row); else sourcesByStudent.set(s.student_id, [row])
  }

  const nav = (delta: number) => `/siniflar/${classId}/plan?hafta=${shiftWeek(weekStart, delta)}`

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Link href={`/siniflar/${classId}`} className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 mb-3 inline-block">← {cls.name}</Link>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Haftalık Çalışma Planı</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">{cls.name} · {formatWeekLabel(weekStart)}</p>
        </div>
        <nav className="flex gap-1" aria-label="Hafta gezinme">
          <Link href={nav(-1)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200">← Önceki</Link>
          <Link href={`/siniflar/${classId}/plan`} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200">Bu hafta</Link>
          <Link href={nav(1)} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200">Sonraki →</Link>
        </nav>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : students.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">Bu sınıfta öğrenci yok.</p>
      ) : (
        <div className="space-y-2">
          {students.map(s => {
            const sum = weekSummary(s.items)
            return (
              <details key={s.id} className="group bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl" data-ogrenci-plan={s.id}>
                <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-3">
                  <span className="text-xs w-8 shrink-0 text-gray-500 dark:text-slate-400">{s.student_number ?? ''}</span>
                  <span className="flex-1 text-sm font-medium text-gray-900 dark:text-slate-100">{s.full_name}</span>
                  <span className="text-xs text-gray-500 dark:text-slate-400">{sum.toplam === 0 ? 'Plan yok' : `${sum.yapildi}/${sum.toplam} · %${sum.yuzde}`}</span>
                  <span className="w-24 h-1.5 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden" aria-hidden>
                    <span className="block h-full bg-green-500" style={{ width: `${sum.yuzde}%` }} />
                  </span>
                </summary>
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-slate-700 pt-3">
                  <HaftaEditoru
                    studentId={s.id} weekStart={weekStart}
                    items={s.items.map(i => ({ ...i, teacher_name: profile.full_name }))}
                    sources={sourcesByStudent.get(s.id) ?? []}
                    currentUserId={profile.id} canWrite
                  />
                </div>
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

`canWrite` burada sabit `true`: `getClassWeek` zaten `teacher_classes` dışı öğretmene `error` döndürür ve liste hiç render edilmez; yazma yine serviste ikinci kez denetlenir.

- [ ] **Step 3: loading.tsx**

```tsx
function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}
export default function SinifPlanLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Sk className="h-4 w-20 mb-3" />
      <div className="mb-5 space-y-1.5"><Sk className="h-6 w-56" /><Sk className="h-4 w-40" /></div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => <Sk key={i} className="h-12 w-full rounded-xl" />)}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Sınıf sayfasına link**

`app/(dashboard)/siniflar/[id]/page.tsx` içinde `<SinifExportButton classId={id} className={cls.name} />` satırını şu blokla değiştir:

```tsx
        <div className="flex items-center gap-2">
          <Link href={`/siniflar/${id}/plan`} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700">
            Haftalık Plan
          </Link>
          <SinifExportButton classId={id} className={cls.name} />
        </div>
```

- [ ] **Step 5: tsc + manuel duman**

Run: `npx tsc --noEmit`
Expected: temiz.
Manuel: `npm run dev` → öğretmen olarak `/siniflar/<id>/plan` aç → öğrenci satırını aç → madde ekle → durum chip'i → sil. Tarayıcıda görünen sonuç + Supabase'de satır (iki katmanlı kanıt).

- [ ] **Step 6: Commit + push**

```bash
git add "app/(dashboard)/siniflar/[id]/plan" "app/(dashboard)/siniflar/[id]/page.tsx"
git commit -m "feat(plan): sınıf haftalık plan sayfası + HaftaEditoru"
git push
```

---

### Task 6: Öğrenci 360 bölümü

**Files:**
- Create: `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/HaftalikPlanSection.tsx`
- Modify: `app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx` (`<NotGecmisiSection grades={grades} />` satırının hemen öncesine ekle; import listesine ekle)

**Interfaces:**
- Consumes: Task 5 `HaftaEditoru`, Task 3 servisi.

- [ ] **Step 1: Bölüm bileşeni (server)**

```tsx
import { todayLocalISO } from '@/src/shared/date'
import { weekStartOf, formatWeekLabel } from '@/src/domains/studyPlan/planMath'
import { StudyPlanService } from '@/src/domains/studyPlan/services/StudyPlanService'
import HaftaEditoru from '../../plan/HaftaEditoru'

// Öğrenci 360: bu haftanın çalışma planı (tüm öğretmenler; yalnız kendi maddeleri düzenlenir).
export default async function HaftalikPlanSection({ studentId, currentUserId }: { studentId: string; currentUserId: string }) {
  const weekStart = weekStartOf(todayLocalISO())
  const [{ items, error }, sources, canWrite] = await Promise.all([
    StudyPlanService.getStudentWeek(studentId, weekStart),
    StudyPlanService.getSources(studentId),
    StudyPlanService.canWriteFor(studentId),
  ])
  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Haftalık Çalışma Planı</h2>
        <span className="text-xs text-gray-500 dark:text-slate-400">{formatWeekLabel(weekStart)}</span>
      </div>
      {error ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">{error}</p>
      ) : (
        <HaftaEditoru studentId={studentId} weekStart={weekStart} items={items} sources={sources} currentUserId={currentUserId} canWrite={canWrite} showTeacher />
      )}
    </section>
  )
}
```

- [ ] **Step 2: Sayfaya ekle**

`page.tsx` import'larına: `import HaftalikPlanSection from './HaftalikPlanSection'`
`<NotGecmisiSection grades={grades} />` satırının hemen üstüne:

```tsx
      <HaftalikPlanSection studentId={studentId} currentUserId={currentProfile.id} />
```

- [ ] **Step 3: tsc + manuel duman**

Run: `npx tsc --noEmit`
Expected: temiz. Manuel: Öğrenci 360'ta bölüm görünür; Task 5'te eklenen madde listelenir; müdür hesabında salt-okunur (chip yok, rozet var).

- [ ] **Step 4: Commit + push**

```bash
git add "app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/HaftalikPlanSection.tsx" "app/(dashboard)/siniflar/[id]/ogrenciler/[studentId]/page.tsx"
git commit -m "feat(plan): Öğrenci 360'a Haftalık Çalışma Planı bölümü"
git push
```

---

### Task 7: E2E + final doğrulama

**Files:**
- Create: `tests/playwright/e2e/plan.spec.ts`

- [ ] **Step 1: Spec'i yaz**

```ts
import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')
const MADDE = `PW Plan ${Date.now()}`

test.describe('Haftalık Çalışma Planı', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })

  test('sınıf planında madde ekle → durum → Öğrenci 360 → sil', async ({ page }) => {
    await page.goto('/siniflar')
    await page.getByRole('link', { name: /__PW_TEST__ 9-A/ }).first().click()
    await expect(page).toHaveURL(/\/siniflar\/[0-9a-f-]+$/, { timeout: 15_000 })
    const classUrl = page.url()

    await page.getByRole('link', { name: 'Haftalık Plan' }).click()
    await expect(page.getByRole('heading', { name: 'Haftalık Çalışma Planı' })).toBeVisible({ timeout: 15_000 })

    // İlk öğrenci satırını aç (native <details>)
    const row = page.locator('[data-ogrenci-plan]').first()
    await row.locator('summary').click()
    const talimat = row.getByLabel('Talimat')
    await expect(talimat).toBeVisible()

    // Hydration yarışı: tıklama sessizce kaybolabilir → toPass deseni
    await expect(async () => {
      await talimat.fill(MADDE)
      await row.getByRole('button', { name: 'Ekle' }).click()
      await expect(row.getByText(MADDE)).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 20_000 })

    const item = row.locator('li', { hasText: MADDE })
    await item.getByRole('button', { name: 'Yapıldı' }).click()
    await expect(item.getByRole('button', { name: 'Yapıldı' })).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 })
    await expect(row.locator('summary')).toContainText('1/', { timeout: 10_000 })

    // Öğrenci 360
    const studentId = await row.getAttribute('data-ogrenci-plan')
    await page.goto(`${classUrl}/ogrenciler/${studentId}`)
    const section = page.locator('section', { hasText: 'Haftalık Çalışma Planı' })
    await expect(section.getByText(MADDE)).toBeVisible({ timeout: 15_000 })

    // Temizlik: sil
    await section.locator('li', { hasText: MADDE }).getByRole('button', { name: 'Maddeyi sil' }).click()
    await expect(section.getByText(MADDE)).toHaveCount(0, { timeout: 10_000 })
  })
})
```

- [ ] **Step 2: Temiz sunucuyla e2e**

Port 3000'de çalışan dev sunucusu varsa öldür (DERS: uzun ömürlü dev sunucu worker'ları flake üretir). Sonra:
Run: `npx playwright test tests/playwright/e2e/plan.spec.ts`
Expected: 1 passed.

- [ ] **Step 3: Tam doğrulama**

Run: `npx tsc --noEmit && npm run test:unit && npm run build && npx playwright test`
Expected: tsc temiz; unit = 1033 + 17 + 15 = **1065 passed**; build exit 0; **76/76 e2e**.

- [ ] **Step 4: Commit + push**

```bash
git add tests/playwright/e2e/plan.spec.ts
git commit -m "test(plan): haftalık plan e2e"
git push
```

- [ ] **Step 5: Kapanış**

- Memory: `project_zumre_takip.md` başına 2026-09-09 girdisi (branch adı, kanıt sayıları, migration canlıda uygulandı mı, "geri alma = ROLLBACK bloğu + branch silme") + `MEMORY.md` satırı güncelle.
- Kullanıcıya rapor: branch push'lu, main'e merge KARARI onun ("geri alınabilir" isteği); merge için `git checkout main && git merge --ff-only feat/haftalik-calisma-plani && git push`.

---

## Self-review notları

- Spec kapsamı: kaynak defteri (T2/T3/T5), plan maddeleri (T2/T3), sınıf tablosu + editör (T5), Öğrenci 360 (T6), kopyalama (T3/T5), durum sözlüğü (T1/T2), yetki/RLS (T2/T3), loading+title (T5), e2e (T7) — tümü karşılandı. Spec'teki "server action'lar `src/domains/studyPlan/actions`" ifadesi repo konvansiyonuna (`app/actions/*.ts`) uyarlandı; homework gibi domain altına re-export gerekmedi.
- Tip tutarlılığı: `PlanItemWithTeacher.teacher_name` T3'te üretilir, T5 sınıf sayfası kendi adını enjekte eder, T6 servisten alır. `updateItem` patch anahtarı `planDate` (servis) ↔ `plan_date` (repo) dönüşümü T3'te tek yerde.
- Bilinçli sadeleştirmeler: drawer yerine native `<details>`; optimistic UI yok (revalidatePath + router refresh); müdür yazamaz (v1).
