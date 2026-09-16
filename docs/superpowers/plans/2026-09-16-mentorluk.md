# Mentörlük Ekranı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Öğretmenin mentörlük yaptığı öğrenciler için tanıma kartı, görüşme notları ve sabit mentörlük düzeni metnini tek ekranda toplamak.

**Architecture:** Mevcut `src/domains/mentor` katmanları (repository → service → action) genişletilir. İki yeni tablo (`mentorships`, `mentor_profiles`), mevcut `mentor_reports` tablosu yeniden kullanılır ama okuması mentöre daraltılır. Kullanılmayan `mentor_students` tablosu ve kodu silinir. Yeni rota: `/mentorluk` (liste) ve `/mentorluk/[studentId]` (detay).

**Tech Stack:** Next.js App Router (server components + server actions), Supabase (RLS), TypeScript, Zod, Vitest, Playwright, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-16-mentorluk-design.md`

## Global Constraints

- **Yetki kuralı:** Üç tabloda da satır sahibine aittir — `mentor_id = (select auth.uid()) and school_id = current_school_id()`. Müdür, müdür yardımcısı, zümre başkanı ve veli erişemez.
- **Soft delete yok:** `mentorships` satırı listeden çıkarılınca hard delete edilir; `mentor_profiles` ve `mentor_reports` kalır.
- **Sessiz yazma yasak:** Her `update`/`delete` `.select('id')` ile gerçek satır sayısına bağlanır; 0 satır → açık hata döner (`'Kayıt bulunamadı veya yetkiniz yok.'`). Bu, 2026-09-16'da ödev silmede yaşanan sessiz-başarı hatasının tekrarını önler.
- **Tenant filtresi:** Her sorguda `school_id` filtresi zorunlu.
- **Metin alanı sınırı:** `mentor_profiles` metin alanları en fazla 2000 karakter; `mentor_reports.content` en fazla 2000 karakter (mevcut şema ile aynı).
- **Turbopack yasak:** Dev sunucusu ve Playwright webServer webpack modunda çalışır (`npm run dev`).
- **Migration sonrası DB tipleri regen edilir**, aksi halde `tsc` kırılır.
- **Dil:** Kullanıcıya görünen tüm metinler Türkçe; kod tanımlayıcıları İngilizce.
- **A11y:** Soluk metin için `text-gray-500 dark:text-slate-400` kullanılır, `text-gray-400` kullanılmaz.

---

## File Structure

**Oluşturulacak:**
- `supabase/migrations/20260916140000_mentorluk.sql` — iki yeni tablo, RLS, mentor_students düşürme
- `src/domains/mentor/mentorshipRules.ts` — sabit mentörlük düzeni maddeleri
- `src/domains/mentor/validators/index.ts` — zod şemaları
- `app/(dashboard)/mentorluk/page.tsx` — liste sayfası
- `app/(dashboard)/mentorluk/loading.tsx` — iskelet
- `app/(dashboard)/mentorluk/OgrenciEkleKarti.tsx` — öğrenci arama + ekleme (client)
- `app/(dashboard)/mentorluk/[studentId]/page.tsx` — detay sayfası
- `app/(dashboard)/mentorluk/[studentId]/TanimaKarti.tsx` — 7 alanlı form (client)
- `app/(dashboard)/mentorluk/[studentId]/GorusmeNotlari.tsx` — not ekle/listele (client)
- `app/(dashboard)/mentorluk/[studentId]/MentorlukDuzeni.tsx` — sabit metin + anlatıldı işareti (client)
- `tests/vitest/unit/mentor/mentorship-service.test.ts`
- `tests/vitest/unit/mentor/mentor-profile-service.test.ts`
- `tests/playwright/e2e/mentorluk.spec.ts`

**Değiştirilecek:**
- `src/domains/mentor/repositories/MentorRepository.ts` — yeni sorgular; `mentor_students` fonksiyonları silinir
- `src/domains/mentor/services/MentorService.ts` — yeni servisler; `addMentorReport` yetki kontrolü değişir; `mentor_students` servisleri silinir
- `app/actions/mentor.ts` — yeni action'lar; `mentor_students` action'ları silinir
- `components/layout/Sidebar.tsx` — "Mentörlük" girişi
- `src/infrastructure/supabase/database.types.ts` — regen

**Dokunulmayacak:** `app/(dashboard)/siniflar/[id]/MentorAtamaKarti.tsx` ve `assignClassMentor` (sınıf rehberliği ayrı kavram), `RehberlikRaporlariSection`.

---

### Task 1: Veritabanı — tablolar, RLS, ölü tablonun kaldırılması

**Files:**
- Create: `supabase/migrations/20260916140000_mentorluk.sql`
- Modify: `src/infrastructure/supabase/database.types.ts` (regen)

**Interfaces:**
- Consumes: yok (ilk task)
- Produces: `mentorships(id, mentor_id, student_id, school_id, created_at)`, `mentor_profiles(id, mentor_id, student_id, school_id, goals_short, goals_long, interests, family_info, study_environment, special_note, support_request, rules_explained_at, updated_at)` tabloları ve daraltılmış `mentor_reports` SELECT politikası.

- [ ] **Step 1: Migration dosyasını yaz**

```sql
-- Mentörlük: kişisel öğrenci listesi + tanıma kartı
--
-- Notlar yalnız mentöre aittir; yönetici rolleri dahil kimse okuyamaz.
-- Kullanılmayan mentor_students tablosu (0 kayıt, okul öğrencisine bağlı değil)
-- kaldırılır — iki benzer tablo karışıklık yaratıyordu.

create table if not exists mentorships (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null references profiles(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  school_id  uuid not null references schools(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (mentor_id, student_id)
);

create index if not exists mentorships_mentor_idx on mentorships (mentor_id, school_id);

create table if not exists mentor_profiles (
  id                uuid primary key default gen_random_uuid(),
  mentor_id         uuid not null references profiles(id) on delete cascade,
  student_id        uuid not null references students(id) on delete cascade,
  school_id         uuid not null references schools(id) on delete cascade,
  goals_short       text,
  goals_long        text,
  interests         text,
  family_info       text,
  study_environment text,
  special_note      text,
  support_request   text,
  rules_explained_at date,
  updated_at        timestamptz not null default now(),
  unique (mentor_id, student_id)
);

create index if not exists mentor_profiles_mentor_idx on mentor_profiles (mentor_id, school_id);

alter table mentorships enable row level security;
alter table mentor_profiles enable row level security;

-- Satır sahibine aittir: dört işlem de aynı koşul
create policy mentorships_owner_all on mentorships
  for all
  using (mentor_id = (select auth.uid()) and school_id = current_school_id())
  with check (mentor_id = (select auth.uid()) and school_id = current_school_id());

create policy mentor_profiles_owner_all on mentor_profiles
  for all
  using (mentor_id = (select auth.uid()) and school_id = current_school_id())
  with check (mentor_id = (select auth.uid()) and school_id = current_school_id());

-- Görüşme notları artık yalnız mentöre görünür (yönetici okuma kolu kaldırıldı)
drop policy if exists mentor_reports_select on mentor_reports;
create policy mentor_reports_select on mentor_reports
  for select
  using (mentor_id = (select auth.uid()) and school_id = current_school_id());

-- Ölü tablo: 0 kayıt, UI'sı hiç yapılmadı, okul öğrencisine bağlı değildi
drop table if exists mentor_students;
```

- [ ] **Step 2: Migration'ı canlıya uygula**

Supabase MCP `apply_migration` ile `name: "mentorluk"` olarak uygula. Uygulandıktan sonra doğrula:

```sql
select tablename, policyname, cmd from pg_policies
where tablename in ('mentorships','mentor_profiles','mentor_reports') order by tablename;
```

Beklenen: `mentorships_owner_all` (ALL), `mentor_profiles_owner_all` (ALL), `mentor_reports_select/insert/delete`. `mentor_students` politikaları listede olmamalı.

- [ ] **Step 3: DB tiplerini yeniden üret**

Supabase MCP `generate_typescript_types` çıktısını `src/infrastructure/supabase/database.types.ts` dosyasına yaz (JSON'un `types` alanı). Tablo sayısının azalmadığını doğrula:

```bash
grep -c "mentorships\|mentor_profiles" src/infrastructure/supabase/database.types.ts
```

Beklenen: 0'dan büyük. `mentor_students` artık bulunmamalı.

- [ ] **Step 4: tsc'nin kırıldığını gör (mentor_students kullanan kod)**

Run: `npx tsc --noEmit`
Expected: FAIL — `MentorRepository`/`MentorService`/`app/actions/mentor.ts` içinde `mentor_students` kullanımları hata verir. Bu beklenen durumdur; Task 2'de temizlenecek.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260916140000_mentorluk.sql src/infrastructure/supabase/database.types.ts
git commit -m "feat(mentorluk): mentorships + mentor_profiles tabloları, notlar mentöre daraltıldı"
```

---

### Task 2: Ölü kodun temizlenmesi — mentor_students

**Files:**
- Modify: `src/domains/mentor/repositories/MentorRepository.ts` (satır 52-81 civarı: `getMentorStudents`, `insertMentorStudent`, `deleteMentorStudent`)
- Modify: `src/domains/mentor/services/MentorService.ts` (`getMentorStudents`, `addMentorStudent`, `deleteMentorStudent`)
- Modify: `app/actions/mentor.ts` (`addMentorStudent`, `deleteMentorStudent`, `mentorStudentSchema`)

**Interfaces:**
- Consumes: Task 1'in düşürdüğü `mentor_students` tablosu
- Produces: yok (silme işi)

- [ ] **Step 1: Kullanım olmadığını doğrula**

```bash
grep -rn "addMentorStudent\|deleteMentorStudent\|getMentorStudents\|mentorStudentSchema" app src components tests
```

Beklenen: yalnızca silinecek üç dosyada geçer; hiçbir UI bileşeni bunları çağırmaz. Eğer bir çağrı bulunursa DUR ve bildir.

- [ ] **Step 2: Üç dosyadan da ilgili blokları sil**

`MentorRepository.ts`: `getMentorStudents`, `insertMentorStudent`, `deleteMentorStudent` fonksiyonları.
`MentorService.ts`: `getMentorStudents`, `addMentorStudent`, `deleteMentorStudent` fonksiyonları.
`app/actions/mentor.ts`: `mentorStudentSchema` sabiti ve `addMentorStudent`, `deleteMentorStudent` action'ları ile üstlerindeki `// ── Kişisel Mentor Öğrenci Defteri ──` başlığı.

- [ ] **Step 3: tsc temiz olmalı**

Run: `npx tsc --noEmit`
Expected: hata yok (exit 0)

- [ ] **Step 4: Mevcut testler geçmeli**

Run: `npm run test:unit`
Expected: tüm testler PASS. Bir test `mentor_students` davranışını doğruluyorsa o testi de sil (tablo artık yok).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(mentorluk): kullanılmayan mentor_students kodunu kaldır"
```

---

### Task 3: Mentörlük listesi — repository + service + validator

**Files:**
- Modify: `src/domains/mentor/repositories/MentorRepository.ts`
- Modify: `src/domains/mentor/services/MentorService.ts`
- Create: `src/domains/mentor/validators/index.ts`
- Test: `tests/vitest/unit/mentor/mentorship-service.test.ts`

**Interfaces:**
- Consumes: Task 1'in `mentorships` tablosu
- Produces:
  - `MentorRepository.listMentorships(mentorId, schoolId)` → `{ data: Array<{ id, student_id, students: { id, full_name, class_id, classes: { name } } }>, error }`
  - `MentorRepository.insertMentorship({ mentor_id, student_id, school_id })` → `{ data: { id }, error }`
  - `MentorRepository.deleteMentorship(studentId, mentorId, schoolId)` → `{ error }` (0 satır → `{ error: { message: 'Kayıt bulunamadı veya yetkiniz yok.' } }`)
  - `MentorRepository.findStudentInSchool(studentId, schoolId)` → `{ data: { id, full_name, class_id } | null }`
  - `MentorRepository.lastReportDates(mentorId, schoolId)` → `{ data: Array<{ student_id, report_date }>, error }`
  - `MentorService.getMyMentorships()` → `Promise<MentorshipRow[]>` where `MentorshipRow = { student_id: string; full_name: string; class_name: string | null; last_report_date: string | null }`
  - `MentorService.addMentorship(studentId)` → `Promise<{ error?: string }>`
  - `MentorService.removeMentorship(studentId)` → `Promise<{ error?: string }>`

- [ ] **Step 1: Failing test yaz**

`tests/vitest/unit/mentor/mentorship-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS } from '../../setup/factories'

vi.mock('@/src/shared/authorization/server', () => ({
  requireAbility: vi.fn(),
  getAbility: vi.fn(),
}))
vi.mock('@/src/domains/mentor/repositories/MentorRepository', () => ({
  MentorRepository: {
    listMentorships: vi.fn(),
    insertMentorship: vi.fn(),
    deleteMentorship: vi.fn(),
    findStudentInSchool: vi.fn(),
    lastReportDates: vi.fn(),
  },
}))

const { requireAbility } = await import('@/src/shared/authorization/server')
const { MentorRepository } = await import('@/src/domains/mentor/repositories/MentorRepository')
const { MentorService } = await import('@/src/domains/mentor/services/MentorService')

const TEACHER_ID = 'teacher-1'
const SCHOOL_ID = 'school-1'
const STUDENT_ID = '11111111-1111-4111-8111-111111111111'

function ability() {
  return createAbility({ userId: TEACHER_ID, schoolId: SCHOOL_ID, permissions: OGRETMEN_PERMS })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAbility).mockResolvedValue(ability() as never)
})

describe('MentorService.addMentorship()', () => {
  it('başka okulun öğrencisi eklenemez', async () => {
    vi.mocked(MentorRepository.findStudentInSchool).mockResolvedValue({ data: null } as never)
    const result = await MentorService.addMentorship(STUDENT_ID)
    expect(result.error).toBe('Öğrenci bulunamadı')
    expect(MentorRepository.insertMentorship).not.toHaveBeenCalled()
  })

  it('kendi okulunun öğrencisi mentor_id ile eklenir', async () => {
    vi.mocked(MentorRepository.findStudentInSchool).mockResolvedValue({
      data: { id: STUDENT_ID, full_name: 'Ahmet', class_id: 'c1' },
    } as never)
    vi.mocked(MentorRepository.insertMentorship).mockResolvedValue({ data: { id: 'm1' }, error: null } as never)

    const result = await MentorService.addMentorship(STUDENT_ID)

    expect(result.error).toBeUndefined()
    expect(MentorRepository.insertMentorship).toHaveBeenCalledWith({
      mentor_id: TEACHER_ID, student_id: STUDENT_ID, school_id: SCHOOL_ID,
    })
  })

  it('aynı öğrenci ikinci kez eklenirse anlaşılır hata döner (23505)', async () => {
    vi.mocked(MentorRepository.findStudentInSchool).mockResolvedValue({
      data: { id: STUDENT_ID, full_name: 'Ahmet', class_id: 'c1' },
    } as never)
    vi.mocked(MentorRepository.insertMentorship).mockResolvedValue({
      data: null, error: { code: '23505', message: 'duplicate key' },
    } as never)

    const result = await MentorService.addMentorship(STUDENT_ID)
    expect(result.error).toBe('Bu öğrenci zaten listenizde')
  })
})

describe('MentorService.removeMentorship()', () => {
  it('0 satır etkilenirse sessiz başarı değil hata döner', async () => {
    vi.mocked(MentorRepository.deleteMentorship).mockResolvedValue({
      error: { message: 'Kayıt bulunamadı veya yetkiniz yok.' },
    } as never)
    const result = await MentorService.removeMentorship(STUDENT_ID)
    expect(result.error).toBe('Kayıt bulunamadı veya yetkiniz yok.')
  })
})

describe('MentorService.getMyMentorships()', () => {
  it('son görüşme tarihini öğrenciyle eşleştirir, hiç görüşülmeyende null verir', async () => {
    vi.mocked(MentorRepository.listMentorships).mockResolvedValue({
      data: [
        { id: 'm1', student_id: 's1', students: { id: 's1', full_name: 'Ahmet', class_id: 'c1', classes: { name: '11-B' } } },
        { id: 'm2', student_id: 's2', students: { id: 's2', full_name: 'Elif', class_id: 'c1', classes: { name: '11-B' } } },
      ],
      error: null,
    } as never)
    vi.mocked(MentorRepository.lastReportDates).mockResolvedValue({
      data: [{ student_id: 's1', report_date: '2026-09-12' }],
      error: null,
    } as never)

    const rows = await MentorService.getMyMentorships()

    expect(rows).toEqual([
      { student_id: 's1', full_name: 'Ahmet', class_name: '11-B', last_report_date: '2026-09-12' },
      { student_id: 's2', full_name: 'Elif', class_name: '11-B', last_report_date: null },
    ])
  })
})
```

- [ ] **Step 2: Testin kırmızı olduğunu gör**

Run: `npx vitest run tests/vitest/unit/mentor/mentorship-service.test.ts`
Expected: FAIL — `MentorService.addMentorship is not a function`

- [ ] **Step 3: Validator dosyasını yaz**

`src/domains/mentor/validators/index.ts`:

```typescript
import { z } from 'zod'

const metin = z.string().trim().max(2000, 'En fazla 2000 karakter').optional()

/** Tanıma kartı — tüm alanlar isteğe bağlı, görüşme ilerledikçe doldurulur */
export const mentorProfileSchema = z.object({
  goals_short:       metin,
  goals_long:        metin,
  interests:         metin,
  family_info:       metin,
  study_environment: metin,
  special_note:      metin,
  support_request:   metin,
})

export type MentorProfileInput = z.infer<typeof mentorProfileSchema>
```

- [ ] **Step 4: Repository fonksiyonlarını ekle**

`MentorRepository.ts` içine (mevcut `insertMentorReport`'un üstüne):

```typescript
  // ── Mentörlük listesi ────────────────────────────────────────────────────

  async listMentorships(mentorId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('mentorships')
      .select('id, student_id, students(id, full_name, class_id, classes(name))')
      .eq('mentor_id', mentorId)
      .eq('school_id', schoolId)
      .order('created_at')
  },

  async insertMentorship(data: { mentor_id: string; student_id: string; school_id: string }) {
    const supabase = await createClient()
    return supabase.from('mentorships').insert(data).select('id').single()
  },

  async deleteMentorship(studentId: string, mentorId: string, schoolId: string) {
    const supabase = await createClient()
    const { data: rows, error } = await supabase
      .from('mentorships')
      .delete()
      .eq('student_id', studentId)
      .eq('mentor_id', mentorId)
      .eq('school_id', schoolId)
      .select('id')
    if (error) return { error }
    if (!rows || rows.length === 0) return { error: { message: 'Kayıt bulunamadı veya yetkiniz yok.' } }
    return { error: null }
  },

  async findStudentInSchool(studentId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('students')
      .select('id, full_name, class_id')
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .maybeSingle()
  },

  // Her öğrencinin en son görüşme tarihi (mentöre ait notlar üzerinden)
  async lastReportDates(mentorId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('mentor_reports')
      .select('student_id, report_date')
      .eq('mentor_id', mentorId)
      .eq('school_id', schoolId)
      .order('report_date', { ascending: false })
  },
```

- [ ] **Step 5: Service fonksiyonlarını ekle**

`MentorService.ts` içine:

```typescript
  // ── Mentörlük listesi ────────────────────────────────────────────────────

  async getMyMentorships(): Promise<MentorshipRow[]> {
    const ability = await requireAbility()
    const [listRes, dateRes] = await Promise.all([
      MentorRepository.listMentorships(ability.userId, ability.schoolId),
      MentorRepository.lastReportDates(ability.userId, ability.schoolId),
    ])
    if (listRes.error) {
      logger.error({ event: 'mentorship_list_failed', userId: ability.userId, err: listRes.error.message }, 'Mentörlük listesi okunamadı')
      return []
    }
    // report_date'e göre azalan sıralı geldiği için ilk görülen en yenisidir
    const sonGorusme = new Map<string, string>()
    for (const r of dateRes.data ?? []) {
      if (!sonGorusme.has(r.student_id)) sonGorusme.set(r.student_id, r.report_date)
    }
    return (listRes.data ?? []).map(row => {
      const s = row.students as unknown as { full_name: string; classes: { name: string } | null } | null
      return {
        student_id:       row.student_id,
        full_name:        s?.full_name ?? '—',
        class_name:       s?.classes?.name ?? null,
        last_report_date: sonGorusme.get(row.student_id) ?? null,
      }
    })
  },

  async addMentorship(studentId: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    // Cross-tenant koruması: öğrenci gerçekten bu okulda mı?
    const { data: student } = await MentorRepository.findStudentInSchool(studentId, ability.schoolId)
    if (!student) return { error: 'Öğrenci bulunamadı' }

    const { error } = await MentorRepository.insertMentorship({
      mentor_id: ability.userId, student_id: studentId, school_id: ability.schoolId,
    })
    if (error) {
      if ((error as { code?: string }).code === '23505') return { error: 'Bu öğrenci zaten listenizde' }
      return { error: error.message }
    }
    return {}
  },

  async removeMentorship(studentId: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { error } = await MentorRepository.deleteMentorship(studentId, ability.userId, ability.schoolId)
    if (error) return { error: error.message }
    return {}
  },
```

Dosyanın üstüne tip ve logger importu ekle:

```typescript
import { logger } from '@/src/infrastructure/observability/logger'

export type MentorshipRow = {
  student_id:       string
  full_name:        string
  class_name:       string | null
  last_report_date: string | null
}
```

- [ ] **Step 6: Testin yeşil olduğunu gör**

Run: `npx vitest run tests/vitest/unit/mentor/mentorship-service.test.ts`
Expected: PASS (5 test)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(mentorluk): kişisel öğrenci listesi servisi"
```

---

### Task 4: Tanıma kartı — repository + service

**Files:**
- Modify: `src/domains/mentor/repositories/MentorRepository.ts`
- Modify: `src/domains/mentor/services/MentorService.ts`
- Test: `tests/vitest/unit/mentor/mentor-profile-service.test.ts`

**Interfaces:**
- Consumes: Task 1'in `mentor_profiles` tablosu, Task 3'ün `MentorRepository.findStudentInSchool`
- Produces:
  - `MentorRepository.getMentorProfile(studentId, mentorId, schoolId)` → `{ data: MentorProfileRow | null }`
  - `MentorRepository.upsertMentorProfile(row)` → `{ error }`
  - `MentorService.getMentorProfile(studentId)` → `Promise<MentorProfileRow | null>`
  - `MentorService.saveMentorProfile(studentId, input: MentorProfileInput)` → `Promise<{ error?: string }>`
  - `MentorService.markRulesExplained(studentId)` → `Promise<{ error?: string }>`
  - `MentorProfileRow = { goals_short, goals_long, interests, family_info, study_environment, special_note, support_request: string | null; rules_explained_at: string | null }`

- [ ] **Step 1: Failing test yaz**

`tests/vitest/unit/mentor/mentor-profile-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS } from '../../setup/factories'

vi.mock('@/src/shared/authorization/server', () => ({
  requireAbility: vi.fn(),
  getAbility: vi.fn(),
}))
vi.mock('@/src/domains/mentor/repositories/MentorRepository', () => ({
  MentorRepository: {
    getMentorProfile: vi.fn(),
    upsertMentorProfile: vi.fn(),
    findStudentInSchool: vi.fn(),
  },
}))

const { requireAbility } = await import('@/src/shared/authorization/server')
const { MentorRepository } = await import('@/src/domains/mentor/repositories/MentorRepository')
const { MentorService } = await import('@/src/domains/mentor/services/MentorService')

const TEACHER_ID = 'teacher-1'
const SCHOOL_ID = 'school-1'
const STUDENT_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAbility).mockResolvedValue(
    createAbility({ userId: TEACHER_ID, schoolId: SCHOOL_ID, permissions: OGRETMEN_PERMS }) as never,
  )
  vi.mocked(MentorRepository.findStudentInSchool).mockResolvedValue({
    data: { id: STUDENT_ID, full_name: 'Ahmet', class_id: 'c1' },
  } as never)
})

describe('MentorService.saveMentorProfile()', () => {
  it('mentor_id ve school_id sunucudan konur, istemciden alınmaz', async () => {
    vi.mocked(MentorRepository.upsertMentorProfile).mockResolvedValue({ error: null } as never)

    await MentorService.saveMentorProfile(STUDENT_ID, { goals_short: 'TYT netini artırmak' })

    const arg = vi.mocked(MentorRepository.upsertMentorProfile).mock.calls[0][0] as Record<string, unknown>
    expect(arg.mentor_id).toBe(TEACHER_ID)
    expect(arg.school_id).toBe(SCHOOL_ID)
    expect(arg.student_id).toBe(STUDENT_ID)
    expect(arg.goals_short).toBe('TYT netini artırmak')
  })

  it('2000 karakteri aşan alan reddedilir', async () => {
    const result = await MentorService.saveMentorProfile(STUDENT_ID, { interests: 'a'.repeat(2001) })
    expect(result.error).toBeTruthy()
    expect(MentorRepository.upsertMentorProfile).not.toHaveBeenCalled()
  })

  it('başka okulun öğrencisine profil yazılamaz', async () => {
    vi.mocked(MentorRepository.findStudentInSchool).mockResolvedValue({ data: null } as never)
    const result = await MentorService.saveMentorProfile(STUDENT_ID, { goals_short: 'x' })
    expect(result.error).toBe('Öğrenci bulunamadı')
    expect(MentorRepository.upsertMentorProfile).not.toHaveBeenCalled()
  })
})

describe('MentorService.markRulesExplained()', () => {
  it('rules_explained_at bugünün tarihiyle yazılır', async () => {
    vi.mocked(MentorRepository.upsertMentorProfile).mockResolvedValue({ error: null } as never)

    await MentorService.markRulesExplained(STUDENT_ID)

    const arg = vi.mocked(MentorRepository.upsertMentorProfile).mock.calls[0][0] as Record<string, unknown>
    expect(arg.rules_explained_at).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(arg.mentor_id).toBe(TEACHER_ID)
  })
})
```

- [ ] **Step 2: Testin kırmızı olduğunu gör**

Run: `npx vitest run tests/vitest/unit/mentor/mentor-profile-service.test.ts`
Expected: FAIL — `MentorService.saveMentorProfile is not a function`

- [ ] **Step 3: Repository fonksiyonlarını ekle**

```typescript
  // ── Tanıma kartı ─────────────────────────────────────────────────────────

  async getMentorProfile(studentId: string, mentorId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('mentor_profiles')
      .select('goals_short, goals_long, interests, family_info, study_environment, special_note, support_request, rules_explained_at')
      .eq('student_id', studentId)
      .eq('mentor_id', mentorId)
      .eq('school_id', schoolId)
      .maybeSingle()
  },

  async upsertMentorProfile(row: {
    mentor_id:  string
    student_id: string
    school_id:  string
    updated_at: string
    [alan: string]: string | null
  }) {
    const supabase = await createClient()
    return supabase
      .from('mentor_profiles')
      .upsert(row as never, { onConflict: 'mentor_id,student_id' })
  },
```

- [ ] **Step 4: Service fonksiyonlarını ekle**

```typescript
  // ── Tanıma kartı ─────────────────────────────────────────────────────────

  async getMentorProfile(studentId: string): Promise<MentorProfileRow | null> {
    const ability = await requireAbility()
    const { data } = await MentorRepository.getMentorProfile(studentId, ability.userId, ability.schoolId)
    return (data as MentorProfileRow | null) ?? null
  },

  async saveMentorProfile(studentId: string, input: MentorProfileInput): Promise<{ error?: string }> {
    const ability = await requireAbility()

    const parsed = mentorProfileSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

    const { data: student } = await MentorRepository.findStudentInSchool(studentId, ability.schoolId)
    if (!student) return { error: 'Öğrenci bulunamadı' }

    // Boş string -> null; "silindi" ile "hiç girilmedi" aynı kabul edilir
    const alanlar = Object.fromEntries(
      Object.entries(parsed.data).map(([k, v]) => [k, v?.trim() ? v.trim() : null]),
    )

    const { error } = await MentorRepository.upsertMentorProfile({
      mentor_id:  ability.userId,
      student_id: studentId,
      school_id:  ability.schoolId,
      updated_at: new Date().toISOString(),
      ...alanlar,
    })
    if (error) return { error: error.message }
    return {}
  },

  async markRulesExplained(studentId: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { data: student } = await MentorRepository.findStudentInSchool(studentId, ability.schoolId)
    if (!student) return { error: 'Öğrenci bulunamadı' }

    const { error } = await MentorRepository.upsertMentorProfile({
      mentor_id:          ability.userId,
      student_id:         studentId,
      school_id:          ability.schoolId,
      updated_at:         new Date().toISOString(),
      rules_explained_at: todayLocalISO(),
    })
    if (error) return { error: error.message }
    return {}
  },
```

Importlar:

```typescript
import { mentorProfileSchema, type MentorProfileInput } from '../validators'
import { todayLocalISO } from '@/src/shared/date'

export type MentorProfileRow = {
  goals_short:       string | null
  goals_long:        string | null
  interests:         string | null
  family_info:       string | null
  study_environment: string | null
  special_note:      string | null
  support_request:   string | null
  rules_explained_at: string | null
}
```

- [ ] **Step 5: Testin yeşil olduğunu gör**

Run: `npx vitest run tests/vitest/unit/mentor/mentor-profile-service.test.ts`
Expected: PASS (4 test)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(mentorluk): öğrenci tanıma kartı servisi"
```

---

### Task 5: Görüşme notu yetkisinin yeni modele uyarlanması

**Files:**
- Modify: `src/domains/mentor/services/MentorService.ts` (`addMentorReport`, `getMentorReportsByStudent`)
- Modify: `src/domains/mentor/repositories/MentorRepository.ts` (`findMentorship` ekle)
- Test: `tests/vitest/unit/mentor/mentorship-service.test.ts` (aynı dosyaya ekle)

**Interfaces:**
- Consumes: Task 3'ün `mentorships` tablosu
- Produces: `MentorRepository.findMentorship(studentId, mentorId, schoolId)` → `{ data: { id } | null }`

**Neden:** Mevcut `addMentorReport`, notun yazılabilmesi için `classes.mentor_teacher_id === userId` (sınıf rehberliği) şartını arıyor. Yeni modelde mentörlük kişisel listeyle kuruluyor; bu şart sağlanamayacağı için not eklenemez. Kontrol "öğrenci benim mentörlük listemde mi" olarak değişir.

- [ ] **Step 1: Failing test yaz** (mentorship-service.test.ts sonuna ekle)

```typescript
describe('MentorService.addMentorReport() — yeni yetki modeli', () => {
  it('öğrenci mentörlük listemde değilse not eklenemez', async () => {
    vi.mocked(MentorRepository.findMentorship).mockResolvedValue({ data: null } as never)
    const result = await MentorService.addMentorReport({
      student_id: STUDENT_ID, class_id: 'c1', content: 'Görüşme yapıldı', report_date: '2026-09-16',
    })
    expect(result.error).toBe('Bu öğrenci mentörlük listenizde değil')
    expect(MentorRepository.insertMentorReport).not.toHaveBeenCalled()
  })

  it('listemdeki öğrenciye not eklenir, mentor_id sunucudan konur', async () => {
    vi.mocked(MentorRepository.findMentorship).mockResolvedValue({ data: { id: 'm1' } } as never)
    vi.mocked(MentorRepository.insertMentorReport).mockResolvedValue({ data: { id: 'r1' }, error: null } as never)

    const result = await MentorService.addMentorReport({
      student_id: STUDENT_ID, class_id: 'c1', content: 'Görüşme yapıldı', report_date: '2026-09-16',
    })

    expect(result.error).toBeUndefined()
    const arg = vi.mocked(MentorRepository.insertMentorReport).mock.calls[0][0] as Record<string, unknown>
    expect(arg.mentor_id).toBe(TEACHER_ID)
    expect(arg.school_id).toBe(SCHOOL_ID)
  })
})
```

Bu testin çalışması için dosyanın başındaki `MentorRepository` mock nesnesine `findMentorship: vi.fn()` ve `insertMentorReport: vi.fn()` alanlarını ekle.

- [ ] **Step 2: Testin kırmızı olduğunu gör**

Run: `npx vitest run tests/vitest/unit/mentor/mentorship-service.test.ts`
Expected: FAIL — mevcut kod `classes` sorgusu yapıyor, `findMentorship` çağrılmıyor.

- [ ] **Step 3: Repository'ye findMentorship ekle**

```typescript
  async findMentorship(studentId: string, mentorId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('mentorships')
      .select('id')
      .eq('student_id', studentId)
      .eq('mentor_id', mentorId)
      .eq('school_id', schoolId)
      .maybeSingle()
  },
```

- [ ] **Step 4: addMentorReport yetki kontrolünü değiştir**

`MentorService.addMentorReport` içindeki `classes` sorgusunu ve `mentor_teacher_id` kontrolünü sil, yerine:

```typescript
    // Yetki: öğrenci mentörün kişisel listesinde olmalı
    const { data: mentorship } = await MentorRepository.findMentorship(
      data.student_id, ability.userId, ability.schoolId,
    )
    if (!mentorship) return { error: 'Bu öğrenci mentörlük listenizde değil' }
```

Artık kullanılmıyorsa `createClient` importunu da kaldır.

- [ ] **Step 5: Testin yeşil olduğunu gör**

Run: `npx vitest run tests/vitest/unit/mentor/`
Expected: PASS (tüm mentor testleri)

- [ ] **Step 6: Tam test + tsc**

Run: `npx tsc --noEmit && npm run test:unit`
Expected: tsc temiz, tüm unit testler PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(mentorluk): görüşme notu yetkisi kişisel listeye bağlandı"
```

---

### Task 6: Server action'lar

**Files:**
- Modify: `app/actions/mentor.ts`

**Interfaces:**
- Consumes: Task 3, 4, 5 servisleri
- Produces:
  - `addMentorship(studentId: string): Promise<ActionResult>`
  - `removeMentorship(studentId: string): Promise<ActionResult>`
  - `saveMentorProfile(studentId: string, formData: FormData): Promise<ActionResult>`
  - `markRulesExplained(studentId: string): Promise<ActionResult>`
  - `addMentorReport` / `deleteMentorReport` — mevcut, `revalidatePath('/mentorluk/<id>')` eklenir

- [ ] **Step 1: Yeni action'ları yaz**

`app/actions/mentor.ts` sonuna:

```typescript
// ── Mentörlük listesi ────────────────────────────────────────────────────────

export async function addMentorship(studentId: string): Promise<ActionResult> {
  try { UUID.parse(studentId) } catch { return { error: 'Geçersiz ID' } }

  const result = await MentorService.addMentorship(studentId)
  if (result.error) return { error: result.error }

  revalidatePath('/mentorluk')
  return {}
}

export async function removeMentorship(studentId: string): Promise<ActionResult> {
  try { UUID.parse(studentId) } catch { return { error: 'Geçersiz ID' } }

  const result = await MentorService.removeMentorship(studentId)
  if (result.error) return { error: result.error }

  revalidatePath('/mentorluk')
  return {}
}

// ── Tanıma kartı ─────────────────────────────────────────────────────────────

export async function saveMentorProfile(studentId: string, formData: FormData): Promise<ActionResult> {
  try { UUID.parse(studentId) } catch { return { error: 'Geçersiz ID' } }

  const result = await MentorService.saveMentorProfile(studentId, {
    goals_short:       String(formData.get('goals_short') ?? ''),
    goals_long:        String(formData.get('goals_long') ?? ''),
    interests:         String(formData.get('interests') ?? ''),
    family_info:       String(formData.get('family_info') ?? ''),
    study_environment: String(formData.get('study_environment') ?? ''),
    special_note:      String(formData.get('special_note') ?? ''),
    support_request:   String(formData.get('support_request') ?? ''),
  })
  if (result.error) return { error: result.error }

  revalidatePath(`/mentorluk/${studentId}`)
  return {}
}

export async function markRulesExplained(studentId: string): Promise<ActionResult> {
  try { UUID.parse(studentId) } catch { return { error: 'Geçersiz ID' } }

  const result = await MentorService.markRulesExplained(studentId)
  if (result.error) return { error: result.error }

  revalidatePath(`/mentorluk/${studentId}`)
  return {}
}
```

- [ ] **Step 2: Mevcut not action'larına mentörlük yolunu ekle**

`addMentorReport` ve `deleteMentorReport` içindeki `revalidatePath` satırlarının yanına ekle:

```typescript
  revalidatePath(`/mentorluk/${studentId}`)
```

- [ ] **Step 3: tsc temiz olmalı**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add app/actions/mentor.ts
git commit -m "feat(mentorluk): server action'lar"
```

---

### Task 7: Mentörlük düzeni metni + liste sayfası

**Files:**
- Create: `src/domains/mentor/mentorshipRules.ts`
- Create: `app/(dashboard)/mentorluk/page.tsx`
- Create: `app/(dashboard)/mentorluk/loading.tsx`
- Create: `app/(dashboard)/mentorluk/OgrenciEkleKarti.tsx`
- Modify: `components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `MentorService.getMyMentorships()`, `addMentorship`, `removeMentorship`
- Produces: `MENTORSHIP_RULES: readonly string[]`

- [ ] **Step 1: Sabit metni yaz**

`src/domains/mentor/mentorshipRules.ts`:

```typescript
/**
 * Mentörlük çalışma düzeni — her öğrenci için aynı olduğundan veri değil içerik.
 * Görüşmede öğrenciye okunur; öğrenci başına yalnız "anlatıldı" tarihi saklanır.
 */
export const MENTORSHIP_RULES: readonly string[] = [
  'Ödev ve deneme kontrolleri yapılır; sonuca göre etüt veya ekstra ders tanımlanır.',
  'Ödev defteri tutmak zorunludur.',
  'Veli bilgilendirmesi en fazla iki haftada bir yapılır.',
  'Her ödev, ödev kaşesiyle mentör tarafından kontrol edilir.',
  'Her dersten en az bir ana kaynak getirilir; haftada bir gün kontrol edilir.',
]
```

- [ ] **Step 2: Liste sayfasını yaz**

`app/(dashboard)/mentorluk/page.tsx`:

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { MentorService } from '@/src/domains/mentor/services/MentorService'
import { createClient } from '@/src/infrastructure/supabase/server'
import { format, parseISO, todayLocalISO } from '@/src/shared/date'
import OgrenciEkleKarti from './OgrenciEkleKarti'

export const metadata = { title: 'Mentörlük' }

// Bir öğrenciyle en son ne zaman görüşüldüğünü gün cinsinden verir
function gunFarki(dateISO: string): number {
  const bugun = new Date(todayLocalISO() + 'T00:00:00').getTime()
  const o = new Date(dateISO + 'T00:00:00').getTime()
  return Math.round((bugun - o) / 86_400_000)
}

export default async function MentorlukPage() {
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/anasayfa')
  if (!isTeachingRole(profile.role)) redirect('/anasayfa')

  const [rows, supabase] = await Promise.all([MentorService.getMyMentorships(), createClient()])

  // Ekleme kutusu için okul öğrencileri (zaten listede olanlar çıkarılır)
  const { data: ogrenciler } = await supabase
    .from('students')
    .select('id, full_name, classes(name)')
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .order('full_name')
    .limit(500)

  const listedekiler = new Set(rows.map(r => r.student_id))
  const eklenebilir = (ogrenciler ?? [])
    .filter(o => !listedekiler.has(o.id))
    .map(o => ({
      id: o.id,
      full_name: o.full_name,
      class_name: (o.classes as { name: string } | null)?.name ?? null,
    }))

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Mentörlüğüm</h1>
        <span className="text-sm text-gray-500 dark:text-slate-400">{rows.length} öğrenci</span>
      </div>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-5">
        Mentörlük yaptığın öğrenciler. Notların yalnızca sana görünür.
      </p>

      <OgrenciEkleKarti ogrenciler={eklenebilir} />

      {rows.length === 0 ? (
        <div className="mt-6 text-center border border-dashed border-gray-200 dark:border-slate-700 rounded-2xl p-8">
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">Henüz öğrenci eklemedin</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Yukarıdan öğrenci ekleyerek tanıma kartını doldurmaya ve görüşme notu tutmaya başlayabilirsin.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {rows.map(r => {
            const fark = r.last_report_date ? gunFarki(r.last_report_date) : null
            return (
              <li key={r.student_id}>
                <Link
                  href={`/mentorluk/${r.student_id}`}
                  className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-200 dark:hover:border-slate-600 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-slate-100 truncate">{r.full_name}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{r.class_name ?? '—'}</p>
                  </div>
                  {r.last_report_date ? (
                    <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full border ${
                      fark !== null && fark > 30
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900'
                        : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700'
                    }`}>
                      son görüşme {format(parseISO(r.last_report_date), 'd MMM')}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs font-medium px-2 py-1 rounded-full border bg-gray-50 text-gray-500 border-gray-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700">
                      henüz görüşülmedi
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Öğrenci ekleme bileşenini yaz**

`app/(dashboard)/mentorluk/OgrenciEkleKarti.tsx`:

```tsx
'use client'

import { useState, useTransition, useMemo } from 'react'
import { addMentorship } from '@/app/actions/mentor'

type Ogrenci = { id: string; full_name: string; class_name: string | null }

export default function OgrenciEkleKarti({ ogrenciler }: { ogrenciler: Ogrenci[] }) {
  const [acik, setAcik] = useState(false)
  const [arama, setArama] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sonuclar = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr')
    if (!q) return ogrenciler.slice(0, 8)
    return ogrenciler.filter(o => o.full_name.toLocaleLowerCase('tr').includes(q)).slice(0, 8)
  }, [arama, ogrenciler])

  function ekle(id: string) {
    setHata(null)
    startTransition(async () => {
      const r = await addMentorship(id)
      if (r.error) setHata(r.error)
      else { setArama(''); setAcik(false) }
    })
  }

  if (!acik) {
    return (
      <button
        onClick={() => setAcik(true)}
        className="w-full min-h-[44px] rounded-2xl border border-dashed border-gray-300 dark:border-slate-600 text-sm font-medium text-gray-600 dark:text-slate-300 hover:border-gray-400 dark:hover:border-slate-500 transition-colors"
      >
        + Öğrenci ekle
      </button>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <input
        autoFocus
        value={arama}
        onChange={e => setArama(e.target.value)}
        placeholder="Öğrenci adı ara…"
        aria-label="Öğrenci ara"
        className="w-full min-h-[44px] text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {hata && <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-2">{hata}</p>}
      <ul className="mt-3 space-y-1">
        {sonuclar.map(o => (
          <li key={o.id}>
            <button
              onClick={() => ekle(o.id)}
              disabled={isPending}
              className="w-full flex items-center justify-between gap-2 min-h-[44px] px-3 rounded-xl text-sm text-left hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <span className="text-gray-800 dark:text-slate-200 truncate">{o.full_name}</span>
              <span className="text-xs text-gray-500 dark:text-slate-400 shrink-0">{o.class_name ?? '—'}</span>
            </button>
          </li>
        ))}
        {sonuclar.length === 0 && (
          <li className="text-sm text-gray-500 dark:text-slate-400 px-3 py-2">Eşleşen öğrenci yok.</li>
        )}
      </ul>
      <button
        onClick={() => { setAcik(false); setArama(''); setHata(null) }}
        className="mt-2 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
      >
        Kapat
      </button>
    </div>
  )
}
```

- [ ] **Step 4: loading.tsx yaz**

```tsx
export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto animate-pulse">
      <div className="h-6 w-40 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      <div className="h-11 bg-gray-100 dark:bg-slate-800 rounded-2xl mb-6" />
      <div className="space-y-2">
        {[0, 1, 2].map(i => <div key={i} className="h-[72px] bg-gray-100 dark:bg-slate-800 rounded-2xl" />)}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Sidebar'a giriş ekle**

`components/layout/Sidebar.tsx` içinde `/randevular` girişinin hemen ardına:

```tsx
  {
    href: '/mentorluk',
    label: 'Mentörlük',
    mobile: false,
    roles: ['ogretmen', 'zumre_baskani'],
    icon: <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  },
```

- [ ] **Step 6: tsc + build**

Run: `npx tsc --noEmit && npm run build`
Expected: ikisi de exit 0

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(mentorluk): liste sayfası, öğrenci ekleme ve sidebar girişi"
```

---

### Task 8: Öğrenci detay sayfası

**Files:**
- Create: `app/(dashboard)/mentorluk/[studentId]/page.tsx`
- Create: `app/(dashboard)/mentorluk/[studentId]/TanimaKarti.tsx`
- Create: `app/(dashboard)/mentorluk/[studentId]/GorusmeNotlari.tsx`
- Create: `app/(dashboard)/mentorluk/[studentId]/MentorlukDuzeni.tsx`
- Create: `app/(dashboard)/mentorluk/[studentId]/ListedenCikarButonu.tsx`

**Interfaces:**
- Consumes: `MentorService.getMentorProfile`, `getMentorReportsByStudent`, `MENTORSHIP_RULES`, action'lar
- Produces: yok (son UI katmanı)

- [ ] **Step 1: Detay sayfasını yaz**

`app/(dashboard)/mentorluk/[studentId]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { MentorService } from '@/src/domains/mentor/services/MentorService'
import { createClient } from '@/src/infrastructure/supabase/server'
import TanimaKarti from './TanimaKarti'
import GorusmeNotlari from './GorusmeNotlari'
import MentorlukDuzeni from './MentorlukDuzeni'
import ListedenCikarButonu from './ListedenCikarButonu'

export const metadata = { title: 'Mentörlük' }

export default async function MentorlukDetayPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params
  const profile = await getCurrentProfile()
  if (!profile?.school_id) redirect('/anasayfa')
  if (!isTeachingRole(profile.role)) redirect('/anasayfa')

  // Öğrenci gerçekten mentörlük listemde mi? Değilse sayfa yok.
  const rows = await MentorService.getMyMentorships()
  const satir = rows.find(r => r.student_id === studentId)
  if (!satir) notFound()

  const supabase = await createClient()
  const [karte, notlar, ogrenciRes] = await Promise.all([
    MentorService.getMentorProfile(studentId),
    MentorService.getMentorReportsByStudent(studentId),
    supabase.from('students').select('class_id').eq('id', studentId).eq('school_id', profile.school_id).single(),
  ])

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <Link href="/mentorluk" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
        ← Mentörlüğüm
      </Link>

      <div className="mt-3 mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{satir.full_name}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{satir.class_name ?? '—'}</p>
        </div>
        <ListedenCikarButonu studentId={studentId} ad={satir.full_name} />
      </div>

      <div className="space-y-6">
        <TanimaKarti studentId={studentId} profil={karte} />
        <GorusmeNotlari
          studentId={studentId}
          classId={ogrenciRes.data?.class_id ?? ''}
          notlar={notlar}
        />
        <MentorlukDuzeni studentId={studentId} anlatildiTarihi={karte?.rules_explained_at ?? null} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Tanıma kartı bileşenini yaz**

`app/(dashboard)/mentorluk/[studentId]/TanimaKarti.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { saveMentorProfile } from '@/app/actions/mentor'

type Profil = {
  goals_short: string | null
  goals_long: string | null
  interests: string | null
  family_info: string | null
  study_environment: string | null
  special_note: string | null
  support_request: string | null
} | null

const ALANLAR = [
  { ad: 'goals_short',       etiket: 'Kısa vadeli hedefleri' },
  { ad: 'goals_long',        etiket: 'Uzun vadeli hedefleri' },
  { ad: 'interests',         etiket: 'Hobi, spor, sanat, ilgi alanları' },
  { ad: 'family_info',       etiket: 'Aile durumu, anne-baba iş, kardeşler' },
  { ad: 'study_environment', etiket: 'Ders çalışma ortamı' },
  { ad: 'special_note',      etiket: 'Aktarmak istediği özel bir durum' },
  { ad: 'support_request',   etiket: 'İstediği destek / özel isteği' },
] as const

export default function TanimaKarti({ studentId, profil }: { studentId: string; profil: Profil }) {
  const [duzenle, setDuzenle] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function kaydet(formData: FormData) {
    setHata(null)
    startTransition(async () => {
      const r = await saveMentorProfile(studentId, formData)
      if (r.error) setHata(r.error)
      else setDuzenle(false)
    })
  }

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-gray-900 dark:text-slate-100">Tanıma kartı</h2>
        {!duzenle && (
          <button
            onClick={() => setDuzenle(true)}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Düzenle
          </button>
        )}
      </div>

      {hata && <p role="alert" className="text-xs text-red-600 dark:text-red-400 mb-3">{hata}</p>}

      {duzenle ? (
        <form action={kaydet} className="space-y-4">
          {ALANLAR.map(a => (
            <div key={a.ad}>
              <label htmlFor={a.ad} className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">
                {a.etiket}
              </label>
              <textarea
                id={a.ad}
                name={a.ad}
                rows={2}
                maxLength={2000}
                defaultValue={profil?.[a.ad] ?? ''}
                className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={() => { setDuzenle(false); setHata(null) }}
              className="min-h-[44px] px-4 rounded-xl text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              Vazgeç
            </button>
          </div>
        </form>
      ) : (
        <dl className="space-y-3">
          {ALANLAR.map(a => (
            <div key={a.ad}>
              <dt className="text-xs font-medium text-gray-500 dark:text-slate-400">{a.etiket}</dt>
              <dd className="text-sm text-gray-800 dark:text-slate-200 mt-0.5 whitespace-pre-wrap">
                {profil?.[a.ad] || '—'}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Görüşme notları bileşenini yaz**

`app/(dashboard)/mentorluk/[studentId]/GorusmeNotlari.tsx`:

```tsx
'use client'

import { useRef, useState, useTransition } from 'react'
import { addMentorReport, deleteMentorReport } from '@/app/actions/mentor'
import { format, parseISO } from '@/src/shared/date'

type Not = { id: string; content: string; report_date: string }

export default function GorusmeNotlari({
  studentId, classId, notlar,
}: { studentId: string; classId: string; notlar: Not[] }) {
  const [hata, setHata] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const bugun = new Date().toISOString().split('T')[0]

  function ekle(formData: FormData) {
    setHata(null)
    startTransition(async () => {
      const r = await addMentorReport(studentId, classId, formData)
      if (r.error) setHata(r.error)
      else formRef.current?.reset()
    })
  }

  function sil(id: string) {
    startTransition(async () => {
      const r = await deleteMentorReport(id, classId, studentId)
      if (r.error) setHata(r.error)
    })
  }

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Görüşme notları</h2>

      <form ref={formRef} action={ekle} className="space-y-2 mb-5">
        <input
          type="date"
          name="report_date"
          defaultValue={bugun}
          aria-label="Görüşme tarihi"
          className="text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 min-h-[44px] bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200"
        />
        <textarea
          name="content"
          rows={3}
          maxLength={2000}
          placeholder="Görüşmede konuşulanlar…"
          aria-label="Görüşme notu"
          className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {hata && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{hata}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          {isPending ? 'Kaydediliyor…' : 'Not ekle'}
        </button>
      </form>

      {notlar.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">Henüz görüşme notu yok.</p>
      ) : (
        <ul className="space-y-3">
          {notlar.map(n => (
            <li key={n.id} className="border-t border-gray-100 dark:border-slate-700 pt-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  {format(parseISO(n.report_date), 'd MMMM yyyy')}
                </p>
                <button
                  onClick={() => sil(n.id)}
                  disabled={isPending}
                  aria-label="Notu sil"
                  className="text-xs text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                >
                  Sil
                </button>
              </div>
              <p className="text-sm text-gray-800 dark:text-slate-200 mt-1 whitespace-pre-wrap">{n.content}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Mentörlük düzeni bileşenini yaz**

`app/(dashboard)/mentorluk/[studentId]/MentorlukDuzeni.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { markRulesExplained } from '@/app/actions/mentor'
import { MENTORSHIP_RULES } from '@/src/domains/mentor/mentorshipRules'
import { format, parseISO } from '@/src/shared/date'

export default function MentorlukDuzeni({
  studentId, anlatildiTarihi,
}: { studentId: string; anlatildiTarihi: string | null }) {
  const [hata, setHata] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function isaretle() {
    setHata(null)
    startTransition(async () => {
      const r = await markRulesExplained(studentId)
      if (r.error) setHata(r.error)
    })
  }

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-5">
      <h2 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">Mentörlük düzenimiz</h2>
      <ul className="space-y-2 mb-4">
        {MENTORSHIP_RULES.map(madde => (
          <li key={madde} className="flex gap-2 text-sm text-gray-700 dark:text-slate-300">
            <span aria-hidden="true" className="text-gray-400 dark:text-slate-500">•</span>
            <span>{madde}</span>
          </li>
        ))}
      </ul>

      {hata && <p role="alert" className="text-xs text-red-600 dark:text-red-400 mb-2">{hata}</p>}

      {anlatildiTarihi ? (
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
          ✓ Öğrenciye anlatıldı — {format(parseISO(anlatildiTarihi), 'd MMMM yyyy')}
        </p>
      ) : (
        <button
          onClick={isaretle}
          disabled={isPending}
          className="min-h-[44px] px-4 rounded-xl border border-gray-300 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Kaydediliyor…' : 'Öğrenciye anlattım olarak işaretle'}
        </button>
      )}
    </section>
  )
}
```

- [ ] **Step 5: Listeden çıkar düğmesini yaz**

Yanlış eklenen öğrencinin listeden çıkarılması için. Tanıma kartı ve notlar silinmez —
yalnız mentörlük bağı kaldırılır; öğrenci tekrar eklenirse geçmişi yerinde durur.

`app/(dashboard)/mentorluk/[studentId]/ListedenCikarButonu.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { removeMentorship } from '@/app/actions/mentor'

export default function ListedenCikarButonu({ studentId, ad }: { studentId: string; ad: string }) {
  const [onay, setOnay] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function cikar() {
    setHata(null)
    startTransition(async () => {
      const r = await removeMentorship(studentId)
      if (r.error) { setHata(r.error); setOnay(false); return }
      router.push('/mentorluk')
    })
  }

  if (!onay) {
    return (
      <div className="shrink-0 text-right">
        <button
          onClick={() => setOnay(true)}
          className="text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          Listeden çıkar
        </button>
        {hata && <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-1">{hata}</p>}
      </div>
    )
  }

  return (
    <div className="shrink-0 text-right">
      <p className="text-xs text-gray-600 dark:text-slate-300 mb-1">
        {ad} listeden çıkarılsın mı?
      </p>
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={() => setOnay(false)}
          className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
        >
          Vazgeç
        </button>
        <button
          onClick={cikar}
          disabled={isPending}
          className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
        >
          {isPending ? 'Çıkarılıyor…' : 'Çıkar'}
        </button>
      </div>
    </div>
  )
}
```

Not: notlar ve tanıma kartı korunduğu için bu işlem veri kaybı değildir; onay adımı
yine de yanlış tıklamayı önler.

- [ ] **Step 6: tsc + build**

Run: `npx tsc --noEmit && npm run build`
Expected: ikisi de exit 0

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(mentorluk): öğrenci detay ekranı — tanıma kartı, notlar, düzen metni"
```

---

### Task 9: E2E testi ve tam doğrulama

**Files:**
- Create: `tests/playwright/e2e/mentorluk.spec.ts`

**Interfaces:**
- Consumes: Task 7 ve 8'in ekranları
- Produces: yok

- [ ] **Step 1: E2E testini yaz**

Oturum, `tests/playwright/setup/global-setup.ts` tarafından hazırlanan storageState
dosyasıyla açılır; `homework.spec.ts` ile aynı desen kullanılır. Mentörlük yalnız
öğretmen/zümre başkanı rolleriyle açıldığı için `ogretmen.json` kullanılır.

`tests/playwright/e2e/mentorluk.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'
import path from 'path'

const AUTH_DIR = path.join(process.cwd(), 'tests/playwright/.auth')

test.describe('Mentörlük', () => {
  test.use({ storageState: path.join(AUTH_DIR, 'ogretmen.json') })
  test('mentörlük sayfası açılır ve boş durum görünür', async ({ page }) => {
    await page.goto('/mentorluk')
    await expect(page.getByRole('heading', { name: 'Mentörlüğüm' })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Öğrenci ekle' })).toBeVisible()
  })

  test('öğrenci eklenir ve listede görünür', async ({ page }) => {
    await page.goto('/mentorluk')
    await page.getByRole('button', { name: '+ Öğrenci ekle' }).click()

    const arama = page.getByLabel('Öğrenci ara')
    await expect(arama).toBeVisible()

    // İlk öneriyi seç
    const ilkOneri = page.locator('ul button').first()
    const ad = (await ilkOneri.locator('span').first().textContent())?.trim() ?? ''
    await ilkOneri.click()

    // Liste yenilenince öğrenci görünür
    await expect(page.getByRole('link', { name: new RegExp(ad) })).toBeVisible({ timeout: 10_000 })
  })

  test('detay sayfasında üç bölüm de görünür', async ({ page }) => {
    await page.goto('/mentorluk')
    const ilkOgrenci = page.locator('ul li a').first()
    if (await ilkOgrenci.count() === 0) test.skip()
    await ilkOgrenci.click()

    await expect(page.getByRole('heading', { name: 'Tanıma kartı' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Görüşme notları' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mentörlük düzenimiz' })).toBeVisible()
  })
})
```

**Test verisi temizliği — zorunlu.** İkinci test okulun gerçek öğrencilerinden birini
mentörlük listesine ekler; temizlenmezse her koşuda canlı veriye satır birikir
(2026-09-10'da `school_events` ile yaşanan durum). Testin sonunda eklediği öğrenciyi
UI üzerinden geri çıkar: detay sayfasına gidip "Listeden çıkar" düğmesini kullan.

Bu yüzden Task 8'deki detay sayfasına **"Listeden çıkar"** düğmesi de eklenir
(`removeMentorship` action'ını çağırır, onay ister, ardından `/mentorluk`'e döner).
Bu düğme yalnız test için değil: kullanıcının yanlış eklediği öğrenciyi çıkarması
için de gereklidir — spec'teki "öğrenci listeden çıkarılırsa satır silinir" davranışının
UI karşılığıdır.

- [ ] **Step 2: E2E'yi çalıştır**

Run: `npx playwright test tests/playwright/e2e/mentorluk.spec.ts`
Expected: 3 test PASS

- [ ] **Step 3: Tam doğrulama**

```bash
npx tsc --noEmit
npm run test:unit
npm run build
npx playwright test
```

Expected: tsc exit 0, tüm unit testler PASS, build exit 0, e2e tamamı PASS.

Not: tek bir e2e testi zaman aşımıyla düşerse tek başına yeniden çalıştır — soğuk derleme kaynaklı flake olabilir. İki koşuda da düşüyorsa gerçek hatadır.

- [ ] **Step 4: Canlı doğrulama (iki katman)**

DB katmanı — Supabase MCP ile:

```sql
select m.student_id, s.full_name, p.rules_explained_at,
       (select count(*) from mentor_reports r where r.student_id = m.student_id and r.mentor_id = m.mentor_id) as not_sayisi
from mentorships m
join students s on s.id = m.student_id
left join mentor_profiles p on p.student_id = m.student_id and p.mentor_id = m.mentor_id
where m.mentor_id = '97264c3f-5920-4d42-a98f-ba2fe39ed025';
```

UI katmanı — kullanıcıdan `/mentorluk` ekranını açıp öğrenci eklemesini, tanıma kartını doldurmasını ve bir not yazmasını iste; sonuçların yukarıdaki sorguda göründüğünü doğrula.

- [ ] **Step 5: Commit ve push**

```bash
git add -A
git commit -m "test(mentorluk): e2e — liste, öğrenci ekleme, detay bölümleri"
git push origin main
```

---

### Task 10: Final review

- [ ] **Step 1: Tüm dalın gözden geçirilmesi**

`superpowers:requesting-code-review` skill'ini kullanarak baştan sona incele. Özellikle kontrol et:
- Her tabloda `school_id` filtresi var mı
- Hiçbir yazma işlemi 0 satırda sessiz başarı dönüyor mu
- `mentor_id` istemciden alınıp DB'ye yazılan bir yol var mı (olmamalı — hepsi `ability.userId`)
- Silinen `mentor_students` koduna kalan referans var mı

- [ ] **Step 2: Memory güncellemesi**

`C:\Users\mehme\.claude\projects\C--Users-mehme\memory\project_zumre_takip.md` dosyasına iş özetini, `MEMORY.md` index satırına tek cümlelik özeti ekle. Tarihler mutlak yazılır.
