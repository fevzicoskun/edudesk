# Öğretmen Dosyası (Denetim Paketi) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/profil/dosyam` sekmesi ekleyerek öğretmenin müfettiş denetiminde gerekli tüm belgelerini (günlük plan, yıllık plan, ŞÖK tutanağı, defter kontrolü) tek yerden yönetebilmesini sağlamak.

**Architecture:** 4 yeni Supabase tablosu + `src/domains/inspection/` domain klasörü (types → repository → services) + server actions + App Router sayfaları. Mevcut `profil/page.tsx` genişletilip "Dosyam" sekmesi eklenir; tümünü PDF butonu mevcut jsPDF altyapısını kullanır.

**Tech Stack:** Next.js 16 App Router, Supabase SSR, TypeScript, Zod v4, Tailwind v4, jsPDF 4.2.1 + jsPDF-autotable 5.0.8, Vitest

---

## File Map

| Dosya | İşlem | Sorumluluk |
|---|---|---|
| `supabase/migrations/20260527000000_inspection_tables.sql` | Oluştur | 4 tablo + RLS |
| `src/domains/inspection/types/index.ts` | Oluştur | DB tipleri + standart metin sabitleri |
| `src/domains/inspection/repositories/InspectionRepository.ts` | Oluştur | 4 tablo CRUD |
| `src/domains/inspection/services/AnnualPlanService.ts` | Oluştur | MEB konu listesi + 36-hafta dağılım |
| `src/domains/inspection/services/InspectionService.ts` | Oluştur | Tamamlanma skoru |
| `app/actions/inspection.ts` | Oluştur | Server actions (create/update/delete) |
| `app/(dashboard)/profil/page.tsx` | Değiştir | "Dosyam" sekmesi ekle |
| `app/(dashboard)/profil/dosyam/page.tsx` | Oluştur | Genel bakış — tamamlanma yüzdesi + belge listesi |
| `app/(dashboard)/profil/dosyam/gunluk-plan/page.tsx` | Oluştur | Planların listesi |
| `app/(dashboard)/profil/dosyam/gunluk-plan/yeni/page.tsx` | Oluştur | Yeni plan sayfası |
| `app/(dashboard)/profil/dosyam/gunluk-plan/yeni/GunlukPlanForm.tsx` | Oluştur | Yeni plan formu (client) |
| `app/(dashboard)/profil/dosyam/gunluk-plan/[id]/page.tsx` | Oluştur | Plan düzenleme |
| `app/(dashboard)/profil/dosyam/yillik-plan/page.tsx` | Oluştur | Yıllık plan görüntüleme + onaylama |
| `app/(dashboard)/profil/dosyam/sok/page.tsx` | Oluştur | ŞÖK tutanaklarının listesi |
| `app/(dashboard)/profil/dosyam/sok/yeni/page.tsx` | Oluştur | Yeni tutanak sayfası |
| `app/(dashboard)/profil/dosyam/sok/yeni/SokForm.tsx` | Oluştur | Yeni tutanak formu (client) |
| `app/(dashboard)/profil/dosyam/sok/[id]/page.tsx` | Oluştur | Tutanak detay |
| `app/(dashboard)/profil/dosyam/defter-kontrolu/page.tsx` | Oluştur | Log listesi + yeni kayıt |
| `app/(dashboard)/profil/dosyam/defter-kontrolu/NotebookCheckClient.tsx` | Oluştur | Defter kontrolü formu (client) |
| `tests/vitest/unit/inspection/annual-plan-service.test.ts` | Oluştur | AnnualPlanService unit testleri |
| `tests/vitest/unit/inspection/inspection-service.test.ts` | Oluştur | InspectionService unit testleri |

---

## Task 1: Veritabanı Migrasyonu

**Files:**
- Create: `supabase/migrations/20260527000000_inspection_tables.sql`

- [ ] **Step 1: Migrasyon dosyasını oluştur**

```sql
-- supabase/migrations/20260527000000_inspection_tables.sql

-- ── daily_plans ──────────────────────────────────────────────────────────────
CREATE TABLE daily_plans (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id        uuid        NOT NULL REFERENCES schools(id)    ON DELETE CASCADE,
  class_id         uuid        NOT NULL REFERENCES classes(id)    ON DELETE CASCADE,
  plan_date        date        NOT NULL,
  lesson_hour      smallint    NOT NULL CHECK (lesson_hour BETWEEN 1 AND 8),
  unit             text        NOT NULL,
  topic            text        NOT NULL,
  objectives       text[]      NOT NULL DEFAULT '{}',
  methods          text[]      NOT NULL DEFAULT '{}',
  materials        text[]      NOT NULL DEFAULT '{}',
  intro_text       text        NOT NULL,
  development_text text        NOT NULL,
  conclusion_text  text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX ON daily_plans (teacher_id, plan_date DESC);
CREATE INDEX ON daily_plans (school_id, class_id);

ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_plans_own_select" ON daily_plans
  FOR SELECT USING (teacher_id = auth.uid() AND school_id = current_school_id() AND deleted_at IS NULL);

CREATE POLICY "daily_plans_own_insert" ON daily_plans
  FOR INSERT WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "daily_plans_own_update" ON daily_plans
  FOR UPDATE USING (teacher_id = auth.uid() AND school_id = current_school_id());

-- ── annual_plans ─────────────────────────────────────────────────────────────
CREATE TABLE annual_plans (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id     uuid        NOT NULL REFERENCES schools(id)    ON DELETE CASCADE,
  academic_year text        NOT NULL,
  subject       text        NOT NULL,
  weekly_plan   jsonb       NOT NULL DEFAULT '[]',
  approved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ON annual_plans (teacher_id, academic_year, subject);

ALTER TABLE annual_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "annual_plans_own_select" ON annual_plans
  FOR SELECT USING (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "annual_plans_own_insert" ON annual_plans
  FOR INSERT WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "annual_plans_own_update" ON annual_plans
  FOR UPDATE USING (teacher_id = auth.uid() AND school_id = current_school_id());

-- ── sok_reports ───────────────────────────────────────────────────────────────
CREATE TABLE sok_reports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id     uuid        NOT NULL REFERENCES schools(id)    ON DELETE CASCADE,
  class_id      uuid        NOT NULL REFERENCES classes(id)    ON DELETE CASCADE,
  meeting_date  date        NOT NULL,
  term          smallint    NOT NULL CHECK (term IN (1, 2)),
  academic_year text        NOT NULL,
  participants  jsonb       NOT NULL DEFAULT '[]',
  agenda_items  jsonb       NOT NULL DEFAULT '[]',
  decisions     jsonb       NOT NULL DEFAULT '[]',
  student_notes jsonb       NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE INDEX ON sok_reports (teacher_id, meeting_date DESC);

ALTER TABLE sok_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sok_reports_own_select" ON sok_reports
  FOR SELECT USING (teacher_id = auth.uid() AND school_id = current_school_id() AND deleted_at IS NULL);

CREATE POLICY "sok_reports_own_insert" ON sok_reports
  FOR INSERT WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "sok_reports_own_update" ON sok_reports
  FOR UPDATE USING (teacher_id = auth.uid() AND school_id = current_school_id());

-- ── notebook_checks ───────────────────────────────────────────────────────────
CREATE TABLE notebook_checks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id   uuid        NOT NULL REFERENCES schools(id)    ON DELETE CASCADE,
  class_id    uuid        NOT NULL REFERENCES classes(id)    ON DELETE CASCADE,
  check_date  date        NOT NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON notebook_checks (teacher_id, check_date DESC);

ALTER TABLE notebook_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notebook_checks_own_select" ON notebook_checks
  FOR SELECT USING (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "notebook_checks_own_insert" ON notebook_checks
  FOR INSERT WITH CHECK (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "notebook_checks_own_update" ON notebook_checks
  FOR UPDATE USING (teacher_id = auth.uid() AND school_id = current_school_id());

CREATE POLICY "notebook_checks_own_delete" ON notebook_checks
  FOR DELETE USING (teacher_id = auth.uid() AND school_id = current_school_id());
```

- [ ] **Step 2: Migrasyonu uygula**

```bash
npx supabase db push
```

Beklenen çıktı: 4 tablo oluşturuldu, hata yok.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260527000000_inspection_tables.sql
git commit -m "feat: inspection tables migration (daily_plans, annual_plans, sok_reports, notebook_checks)"
```

---

## Task 2: Types + Sabit Metinler

**Files:**
- Create: `src/domains/inspection/types/index.ts`

- [ ] **Step 1: Types dosyasını oluştur**

```typescript
// src/domains/inspection/types/index.ts

export interface DailyPlan {
  id:               string
  teacher_id:       string
  school_id:        string
  class_id:         string
  plan_date:        string
  lesson_hour:      number
  unit:             string
  topic:            string
  objectives:       string[]
  methods:          string[]
  materials:        string[]
  intro_text:       string
  development_text: string
  conclusion_text:  string
  created_at:       string
  deleted_at:       string | null
}

export interface AnnualPlan {
  id:            string
  teacher_id:    string
  school_id:     string
  academic_year: string
  subject:       string
  weekly_plan:   WeeklyEntry[]
  approved_at:   string | null
  created_at:    string
}

export interface WeeklyEntry {
  week:       number
  dates:      string
  topics:     string[]
  objectives: string[]
}

export interface SokReport {
  id:            string
  teacher_id:    string
  school_id:     string
  class_id:      string
  meeting_date:  string
  term:          1 | 2
  academic_year: string
  participants:  Participant[]
  agenda_items:  AgendaItem[]
  decisions:     Decision[]
  student_notes: StudentNote[]
  created_at:    string
  deleted_at:    string | null
}

export interface Participant {
  user_id:   string
  full_name: string
  subject:   string
}

export interface AgendaItem {
  order:     number
  text:      string
  discussed: boolean
  note:      string
}

export interface Decision {
  order: number
  text:  string
  note:  string
}

export interface StudentNote {
  student_id:   string
  student_name: string
  status:       'basarili' | 'basarisiz' | 'riskli'
  note:         string
}

export interface NotebookCheck {
  id:         string
  teacher_id: string
  school_id:  string
  class_id:   string
  check_date: string
  notes:      string | null
  created_at: string
}

// ── Standart metin sabitleri ──────────────────────────────────────────────────

export const DEFAULT_INTRO_TEXT =
  'Bir önceki dersin konusu kısaca hatırlatılır, günlük konuya motivasyon sorusu yöneltilir.'

export const DEFAULT_DEVELOPMENT_TEXT =
  'Konu öğretmen tarafından anlatılır, örnek problemler çözülür, öğrencilerden aktif katılım beklenir.'

export const DEFAULT_CONCLUSION_TEXT =
  'Öğrencilere sınıf içi değerlendirme soruları yöneltilir. Ev ödevi verilir.'

export const DEFAULT_AGENDA_ITEMS: Omit<AgendaItem, 'discussed' | 'note'>[] = [
  { order: 1, text: 'Sınıfın genel akademik durumunun değerlendirilmesi' },
  { order: 2, text: 'Öğrencilerin devamsızlık durumlarının görüşülmesi' },
  { order: 3, text: 'Öğrencilerin davranış ve disiplin durumlarının değerlendirilmesi' },
  { order: 4, text: 'Başarısız ve başarılı öğrencilerin belirlenmesi, gerekli tedbirlerin alınması' },
  { order: 5, text: 'Öğrencilerin rehberlik ihtiyaçlarının belirlenmesi' },
  { order: 6, text: 'Ders dışı etkinliklere ve sosyal faaliyetlere katılımın değerlendirilmesi' },
  { order: 7, text: 'Sınıfın temizlik, düzen ve fiziki ortamının değerlendirilmesi' },
  { order: 8, text: 'Velilerle işbirliği ve iletişimin değerlendirilmesi' },
  { order: 9, text: 'Dilek ve temenniler' },
]

export const DEFAULT_DECISIONS: Omit<Decision, 'note'>[] = [
  { order: 1, text: 'Başarısız öğrencilerin velileri okula davet edilecektir.' },
  { order: 2, text: 'Devamsızlığı yüksek öğrenciler için veli bildirimi yapılacaktır.' },
  { order: 3, text: 'Rehberlik servisine yönlendirilmesi gereken öğrenciler bildirilecektir.' },
]

export const LESSON_METHODS = [
  'Anlatım', 'Soru-Cevap', 'Grup Çalışması', 'Problem Çözme', 'Beyin Fırtınası',
] as const

export const LESSON_MATERIALS = [
  'Akıllı Tahta', 'Ders Kitabı', 'Projeksiyon', 'Cetvel', 'Pergel',
] as const

export interface CompletionStatus {
  dailyPlans:     boolean
  annualPlan:     boolean
  zumreMeetings:  boolean
  commonExams:    boolean
  sokReports:     boolean
  notebookChecks: boolean
  score:          number  // 0–100, 6 belgeden kaç tanesi mevcut
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/inspection/types/index.ts
git commit -m "feat: inspection domain types and default text constants"
```

---

## Task 3: Repository

**Files:**
- Create: `src/domains/inspection/repositories/InspectionRepository.ts`

- [ ] **Step 1: Repository oluştur**

```typescript
// src/domains/inspection/repositories/InspectionRepository.ts
import { createClient } from '@/src/infrastructure/supabase/server'
import type { DailyPlan, AnnualPlan, SokReport, NotebookCheck } from '../types'

export const InspectionRepository = {
  // ── DailyPlan ──────────────────────────────────────────────────────────────
  async findDailyPlans(teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('daily_plans')
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('plan_date', { ascending: false })
      .returns<DailyPlan[]>()
  },

  async findDailyPlan(id: string, teacherId: string) {
    const supabase = await createClient()
    return supabase
      .from('daily_plans')
      .select('*')
      .eq('id', id)
      .eq('teacher_id', teacherId)
      .is('deleted_at', null)
      .single<DailyPlan>()
  },

  async insertDailyPlan(data: Omit<DailyPlan, 'id' | 'created_at' | 'deleted_at'>) {
    const supabase = await createClient()
    return supabase.from('daily_plans').insert(data).select().single<DailyPlan>()
  },

  async updateDailyPlan(id: string, teacherId: string, data: Partial<DailyPlan>) {
    const supabase = await createClient()
    return supabase
      .from('daily_plans')
      .update(data)
      .eq('id', id)
      .eq('teacher_id', teacherId)
  },

  async softDeleteDailyPlan(id: string, teacherId: string) {
    const supabase = await createClient()
    return supabase
      .from('daily_plans')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('teacher_id', teacherId)
  },

  async countDailyPlansThisTerm(teacherId: string, schoolId: string, termStart: string) {
    const supabase = await createClient()
    return supabase
      .from('daily_plans')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .gte('plan_date', termStart)
      .is('deleted_at', null)
  },

  // ── AnnualPlan ─────────────────────────────────────────────────────────────
  async findAnnualPlan(teacherId: string, academicYear: string, subject: string) {
    const supabase = await createClient()
    return supabase
      .from('annual_plans')
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('academic_year', academicYear)
      .eq('subject', subject)
      .maybeSingle<AnnualPlan>()
  },

  async upsertAnnualPlan(data: Omit<AnnualPlan, 'id' | 'created_at'>) {
    const supabase = await createClient()
    return supabase
      .from('annual_plans')
      .upsert(data, { onConflict: 'teacher_id,academic_year,subject' })
      .select()
      .single<AnnualPlan>()
  },

  // ── SokReport ──────────────────────────────────────────────────────────────
  async findSokReports(teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('sok_reports')
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('meeting_date', { ascending: false })
      .returns<SokReport[]>()
  },

  async findSokReport(id: string, teacherId: string) {
    const supabase = await createClient()
    return supabase
      .from('sok_reports')
      .select('*')
      .eq('id', id)
      .eq('teacher_id', teacherId)
      .is('deleted_at', null)
      .single<SokReport>()
  },

  async insertSokReport(data: Omit<SokReport, 'id' | 'created_at' | 'deleted_at'>) {
    const supabase = await createClient()
    return supabase.from('sok_reports').insert(data).select().single<SokReport>()
  },

  async updateSokReport(id: string, teacherId: string, data: Partial<SokReport>) {
    const supabase = await createClient()
    return supabase
      .from('sok_reports')
      .update(data)
      .eq('id', id)
      .eq('teacher_id', teacherId)
  },

  async countSokReportsThisTerm(teacherId: string, schoolId: string, term: 1 | 2, academicYear: string) {
    const supabase = await createClient()
    return supabase
      .from('sok_reports')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .eq('term', term)
      .eq('academic_year', academicYear)
      .is('deleted_at', null)
  },

  // ── NotebookCheck ──────────────────────────────────────────────────────────
  async findNotebookChecks(teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('notebook_checks')
      .select('*, classes(name)')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .order('check_date', { ascending: false })
      .returns<(NotebookCheck & { classes: { name: string } | null })[]>()
  },

  async insertNotebookCheck(data: Omit<NotebookCheck, 'id' | 'created_at'>) {
    const supabase = await createClient()
    return supabase.from('notebook_checks').insert(data).select().single<NotebookCheck>()
  },

  async deleteNotebookCheck(id: string, teacherId: string) {
    const supabase = await createClient()
    return supabase
      .from('notebook_checks')
      .delete()
      .eq('id', id)
      .eq('teacher_id', teacherId)
  },

  async countNotebookChecksThisTerm(teacherId: string, schoolId: string, termStart: string) {
    const supabase = await createClient()
    return supabase
      .from('notebook_checks')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .gte('check_date', termStart)
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/domains/inspection/repositories/InspectionRepository.ts
git commit -m "feat: InspectionRepository CRUD for 4 inspection tables"
```

---

## Task 4: AnnualPlanService (MEB Konu Listesi + 36-Hafta Dağılımı)

**Files:**
- Create: `src/domains/inspection/services/AnnualPlanService.ts`
- Create: `tests/vitest/unit/inspection/annual-plan-service.test.ts`

- [ ] **Step 1: Failing test yaz**

```typescript
// tests/vitest/unit/inspection/annual-plan-service.test.ts
import { describe, it, expect } from 'vitest'
import { AnnualPlanService } from '@/src/domains/inspection/services/AnnualPlanService'

describe('generateWeeklyPlan', () => {
  it('9. sınıf için 36 haftalık plan üretir', () => {
    const plan = AnnualPlanService.generateWeeklyPlan(9, '2025-2026')
    expect(plan).toHaveLength(36)
  })

  it('her haftada week, dates, topics, objectives alanları var', () => {
    const plan = AnnualPlanService.generateWeeklyPlan(10, '2025-2026')
    const first = plan[0]
    expect(first).toHaveProperty('week', 1)
    expect(first).toHaveProperty('dates')
    expect(first.topics.length).toBeGreaterThan(0)
    expect(Array.isArray(first.objectives)).toBe(true)
  })

  it('hafta numaraları 1–36 sıralı', () => {
    const plan = AnnualPlanService.generateWeeklyPlan(11, '2025-2026')
    plan.forEach((entry, i) => expect(entry.week).toBe(i + 1))
  })

  it('12. sınıf için konu listesi 9. sınıftan farklı', () => {
    const plan9  = AnnualPlanService.generateWeeklyPlan(9,  '2025-2026')
    const plan12 = AnnualPlanService.generateWeeklyPlan(12, '2025-2026')
    expect(plan9[0].topics[0]).not.toBe(plan12[0].topics[0])
  })

  it('desteklenmeyen sınıf seviyesi hata fırlatır', () => {
    expect(() => AnnualPlanService.generateWeeklyPlan(8, '2025-2026')).toThrow()
  })
})
```

- [ ] **Step 2: Testi çalıştır — hata bekleniyor**

```bash
npx vitest run tests/vitest/unit/inspection/annual-plan-service.test.ts
```

Beklenen: FAIL — "Cannot find module"

- [ ] **Step 3: AnnualPlanService oluştur**

```typescript
// src/domains/inspection/services/AnnualPlanService.ts
import type { WeeklyEntry } from '../types'
import { InspectionRepository } from '../repositories/InspectionRepository'
import { getAbility } from '@/src/shared/authorization/server'

// MEB matematik müfredatı — sınıf seviyesine göre konu listesi
const CURRICULUM: Record<number, string[]> = {
  9: [
    'Kümeler', 'Doğal Sayılar', 'Bölünebilme Kuralları', 'EBOB-EKOK',
    'Tam Sayılar', 'Rasyonel Sayılar', 'Gerçek Sayılar', 'Üslü Sayılar',
    'Köklü Sayılar', 'Çarpanlara Ayırma', 'Oran-Orantı', 'Denklemler',
    'Eşitsizlikler', 'Mutlak Değer', 'Koordinat Sistemi', 'Doğrusal Fonksiyonlar',
    'Üçgenler', 'Özel Üçgenler', 'Çokgenler', 'Çember ve Daire',
    'Permütasyon', 'Kombinasyon', 'Olasılık', 'Veri Analizi',
    'Ortalama-Medyan-Mod', 'Standart Sapma', 'Trigonometriye Giriş',
    'Sinüs-Kosinüs-Tanjant', 'Trigonometrik Denklemler', 'Doğrunun Analitik İncelenmesi',
    'Çemberin Analitik İncelenmesi', 'Logaritma', 'Üstel Fonksiyonlar',
    'Logaritmik Fonksiyonlar', 'Dönem Sonu Tekrar', 'Değerlendirme ve Sınav Hazırlık',
  ],
  10: [
    'Polinomlar', 'Polinom Bölmesi', 'Çarpanlara Ayırma', 'Rasyonel İfadeler',
    'İkinci Dereceden Denklemler', 'Parabol', 'İkinci Dereceden Eşitsizlikler',
    'Fonksiyonlar', 'Bileşke Fonksiyon', 'Ters Fonksiyon', 'Trigonometrik Fonksiyonlar',
    'Trigonometrik Dönüşümler', 'Sinüs Teoremi', 'Kosinüs Teoremi',
    'Çember', 'Daire', 'Çember-Doğru İlişkisi', 'Üçgenlerde Alan',
    'Vektörler', 'Vektörel İşlemler', 'Analitik Geometri',
    'Noktanın Doğruya Uzaklığı', 'İki Doğrunun Kesişimi', 'Permütasyon',
    'Kombinasyon', 'Binom Açılımı', 'Olasılık', 'Koşullu Olasılık',
    'İstatistik', 'Normal Dağılım', 'Karmaşık Sayılar', 'Karmaşık Sayılarda İşlemler',
    'Modüler Aritmetik', 'Diziler', 'Dönem Sonu Tekrar', 'Değerlendirme',
  ],
  11: [
    'Diziler ve Seriler', 'Aritmetik Dizi', 'Geometrik Dizi', 'Sonsuz Seri',
    'Limit Kavramı', 'Fonksiyonlarda Limit', 'Süreklilik', 'Türevin Tanımı',
    'Türev Alma Kuralları', 'Bileşke Fonksiyonun Türevi', 'Üstel-Logaritmik Türev',
    'Trigonometrik Türev', 'Uygulamalar: Teğet-Normal', 'Monotonluk',
    'Ekstremum Noktaları', 'Grafik Çizimi', 'Optimizasyon', 'İntegrale Giriş',
    'Belirsiz İntegral', 'İntegral Alma Kuralları', 'Parça Parça İntegrasyon',
    'Değişken Değiştirme', 'Belirli İntegral', 'Alan Hesabı',
    'Hacim Hesabı', 'Trigonometrik İntegral', 'Diferansiyel Denklemler',
    'Matrisler', 'Determinant', 'Lineer Denklem Sistemleri',
    'Analitik Geometri — Elips', 'Analitik Geometri — Hiperbol', 'Analitik Geometri — Parabol',
    'Kompleks Analiz Giriş', 'Dönem Sonu Tekrar', 'Değerlendirme',
  ],
  12: [
    'YKS Analitik Geometri Tekrar', 'YKS Denklemler Tekrar', 'Türev Hızlı Tekrar',
    'İntegral Hızlı Tekrar', 'Kombinatorik Tekrar', 'Olasılık Tekrar',
    'YKS Soru Tipleri — Temel Matematik', 'YKS Soru Tipleri — Cebir',
    'YKS Soru Tipleri — Fonksiyon', 'YKS Soru Tipleri — Trigonometri',
    'YKS Soru Tipleri — Limit-Türev', 'YKS Soru Tipleri — İntegral',
    'YKS Deneme Analizi 1', 'Zayıf Konuların Tekrarı 1',
    'YKS Deneme Analizi 2', 'Zayıf Konuların Tekrarı 2',
    'YKS Deneme Analizi 3', 'Zayıf Konuların Tekrarı 3',
    'Tüm Konular Süpürme 1', 'Tüm Konular Süpürme 2',
    'Tüm Konular Süpürme 3', 'Son Hafta Sorular',
    'Karma Soru Çözümü', 'Hız-Doğruluk Egzersizleri',
    'TYT Matematik Deneme', 'AYT Matematik Deneme',
    'Hata Analizi', 'Motivasyon + Soru Stratejisi',
    'Son Tekrar 1', 'Son Tekrar 2', 'Son Tekrar 3', 'Son Tekrar 4',
    'Sınav Öncesi Hazırlık', 'YKS Haftası', 'Değerlendirme', 'Dönem Kapanış',
  ],
}

function getAcademicYearStart(academicYear: string): Date {
  const year = parseInt(academicYear.split('-')[0], 10)
  const sep15 = new Date(year, 8, 15) // Eylül = ay indeksi 8
  const day = sep15.getDay()
  const daysToMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  sep15.setDate(sep15.getDate() + daysToMonday)
  return sep15
}

function formatWeekDates(startDate: Date): string {
  const end = new Date(startDate)
  end.setDate(end.getDate() + 4)
  const fmt = (d: Date) =>
    `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`
  return `${fmt(startDate)}–${fmt(end)}`
}

export const AnnualPlanService = {
  generateWeeklyPlan(grade: number, academicYear: string): WeeklyEntry[] {
    const topics = CURRICULUM[grade]
    if (!topics) throw new Error(`Desteklenmeyen sınıf seviyesi: ${grade}`)

    const start = getAcademicYearStart(academicYear)
    const TOTAL_WEEKS = 36

    return Array.from({ length: TOTAL_WEEKS }, (_, i) => {
      const weekStart = new Date(start)
      weekStart.setDate(weekStart.getDate() + i * 7)

      const topicIndex = Math.floor((i * topics.length) / TOTAL_WEEKS)
      const topicCount = Math.ceil(topics.length / TOTAL_WEEKS)
      const weekTopics = topics.slice(topicIndex, topicIndex + topicCount)

      return {
        week:       i + 1,
        dates:      formatWeekDates(weekStart),
        topics:     weekTopics.length > 0 ? weekTopics : [topics[topics.length - 1]],
        objectives: [],
      }
    })
  },

  async getOrCreate(grade: number, subject: string, academicYear: string) {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }

    const { data: existing } = await InspectionRepository.findAnnualPlan(
      ability.userId, academicYear, subject,
    )
    if (existing) return { data: existing }

    const weeklyPlan = AnnualPlanService.generateWeeklyPlan(grade, academicYear)
    const { data, error } = await InspectionRepository.upsertAnnualPlan({
      teacher_id:    ability.userId,
      school_id:     ability.schoolId,
      academic_year: academicYear,
      subject,
      weekly_plan:   weeklyPlan,
      approved_at:   null,
    })
    if (error) return { error: error.message }
    return { data }
  },
}
```

- [ ] **Step 4: Testi çalıştır — geçmesi bekleniyor**

```bash
npx vitest run tests/vitest/unit/inspection/annual-plan-service.test.ts
```

Beklenen: 5 test PASS

- [ ] **Step 5: Commit**

```bash
git add src/domains/inspection/services/AnnualPlanService.ts tests/vitest/unit/inspection/annual-plan-service.test.ts
git commit -m "feat: AnnualPlanService with MEB math curriculum 36-week distribution"
```

---

## Task 5: InspectionService (Tamamlanma Skoru)

**Files:**
- Create: `src/domains/inspection/services/InspectionService.ts`
- Create: `tests/vitest/unit/inspection/inspection-service.test.ts`

- [ ] **Step 1: Failing test yaz**

```typescript
// tests/vitest/unit/inspection/inspection-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/inspection/repositories/InspectionRepository', () => ({
  InspectionRepository: {
    countDailyPlansThisTerm:     vi.fn(),
    countSokReportsThisTerm:     vi.fn(),
    countNotebookChecksThisTerm: vi.fn(),
    findAnnualPlan:              vi.fn(),
  },
}))

vi.mock('@/src/shared/auth', () => ({
  getCurrentProfile: vi.fn(),
}))

const { InspectionRepository } = await import('@/src/domains/inspection/repositories/InspectionRepository')
const { getCurrentProfile }    = await import('@/src/shared/auth')
const { InspectionService }    = await import('@/src/domains/inspection/services/InspectionService')

const TEACHER_ID = 'teacher-1'
const SCHOOL_ID  = 'school-1'

beforeEach(() => {
  vi.clearAllMocks()
  ;(getCurrentProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: TEACHER_ID, school_id: SCHOOL_ID, subject: 'Matematik',
  })
})

describe('getCompletionStatus', () => {
  it('6 belgeden 6sı mevcut → skor 100', async () => {
    ;(InspectionRepository.countDailyPlansThisTerm     as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 5 })
    ;(InspectionRepository.findAnnualPlan              as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { approved_at: '2026-01-01' } })
    ;(InspectionRepository.countSokReportsThisTerm     as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 })
    ;(InspectionRepository.countNotebookChecksThisTerm as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 })
    const result = await InspectionService.getCompletionStatus({ zumreCount: 1, examCount: 1 })
    expect(result.score).toBe(100)
    expect(result.dailyPlans).toBe(true)
    expect(result.annualPlan).toBe(true)
  })

  it('yalnızca günlük plan mevcut → skor ~17 (1/6)', async () => {
    ;(InspectionRepository.countDailyPlansThisTerm     as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 })
    ;(InspectionRepository.findAnnualPlan              as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null })
    ;(InspectionRepository.countSokReportsThisTerm     as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
    ;(InspectionRepository.countNotebookChecksThisTerm as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
    const result = await InspectionService.getCompletionStatus({ zumreCount: 0, examCount: 0 })
    expect(result.score).toBe(Math.round(100 / 6))
    expect(result.dailyPlans).toBe(true)
    expect(result.annualPlan).toBe(false)
    expect(result.zumreMeetings).toBe(false)
  })

  it('hiç belge yok → skor 0', async () => {
    ;(InspectionRepository.countDailyPlansThisTerm     as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
    ;(InspectionRepository.findAnnualPlan              as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null })
    ;(InspectionRepository.countSokReportsThisTerm     as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
    ;(InspectionRepository.countNotebookChecksThisTerm as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
    const result = await InspectionService.getCompletionStatus({ zumreCount: 0, examCount: 0 })
    expect(result.score).toBe(0)
  })
})
```

- [ ] **Step 2: Testi çalıştır — hata bekleniyor**

```bash
npx vitest run tests/vitest/unit/inspection/inspection-service.test.ts
```

Beklenen: FAIL — "Cannot find module"

- [ ] **Step 3: InspectionService oluştur**

```typescript
// src/domains/inspection/services/InspectionService.ts
import { InspectionRepository } from '../repositories/InspectionRepository'
import { getCurrentProfile } from '@/src/shared/auth'
import type { CompletionStatus } from '../types'

function getTermStart(term: 1 | 2, academicYear: string): string {
  const startYear = parseInt(academicYear.split('-')[0], 10)
  return term === 1
    ? `${startYear}-09-01`
    : `${startYear + 1}-02-01`
}

function getCurrentTerm(): { term: 1 | 2; academicYear: string; termStart: string } {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const term: 1 | 2 = month >= 9 || month <= 1 ? 1 : 2
  const startYear = month >= 9 ? year : year - 1
  const academicYear = `${startYear}-${startYear + 1}`
  return { term, academicYear, termStart: getTermStart(term, academicYear) }
}

export const InspectionService = {
  async getCompletionStatus(
    existing: { zumreCount: number; examCount: number },
  ): Promise<CompletionStatus> {
    const profile = await getCurrentProfile()
    if (!profile) throw new Error('Profil bulunamadı')

    const { term, academicYear, termStart } = getCurrentTerm()

    const [dailyRes, annualRes, sokRes, notebookRes] = await Promise.all([
      InspectionRepository.countDailyPlansThisTerm(profile.id, profile.school_id, termStart),
      InspectionRepository.findAnnualPlan(profile.id, academicYear, profile.subject ?? 'Matematik'),
      InspectionRepository.countSokReportsThisTerm(profile.id, profile.school_id, term, academicYear),
      InspectionRepository.countNotebookChecksThisTerm(profile.id, profile.school_id, termStart),
    ])

    const flags = {
      dailyPlans:     (dailyRes.count ?? 0) > 0,
      annualPlan:     annualRes.data !== null,
      zumreMeetings:  existing.zumreCount > 0,
      commonExams:    existing.examCount  > 0,
      sokReports:     (sokRes.count ?? 0) > 0,
      notebookChecks: (notebookRes.count ?? 0) > 0,
    }

    const presentCount = Object.values(flags).filter(Boolean).length
    const score = Math.round((presentCount / 6) * 100)

    return { ...flags, score }
  },
}
```

- [ ] **Step 4: Testi çalıştır — geçmesi bekleniyor**

```bash
npx vitest run tests/vitest/unit/inspection/inspection-service.test.ts
```

Beklenen: 3 test PASS

- [ ] **Step 5: Tüm testler**

```bash
npx vitest run
```

Beklenen: önceki testler dahil hepsi PASS

- [ ] **Step 6: Commit**

```bash
git add src/domains/inspection/services/InspectionService.ts tests/vitest/unit/inspection/inspection-service.test.ts
git commit -m "feat: InspectionService completion score (6 document types)"
```

---

## Task 6: Server Actions

**Files:**
- Create: `app/actions/inspection.ts`

- [ ] **Step 1: Server actions oluştur**

```typescript
// app/actions/inspection.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod/v4'
import { InspectionRepository } from '@/src/domains/inspection/repositories/InspectionRepository'
import { AnnualPlanService }    from '@/src/domains/inspection/services/AnnualPlanService'
import { getAbility }           from '@/src/shared/authorization/server'
import {
  DEFAULT_AGENDA_ITEMS,
  DEFAULT_DECISIONS,
} from '@/src/domains/inspection/types'

// ── Günlük Plan ───────────────────────────────────────────────────────────────

const DailyPlanSchema = z.object({
  class_id:         z.string().uuid(),
  plan_date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lesson_hour:      z.coerce.number().int().min(1).max(8),
  unit:             z.string().min(1).max(200),
  topic:            z.string().min(1).max(200),
  objectives:       z.string().transform(v => v ? v.split(',').map(s => s.trim()).filter(Boolean) : []),
  methods:          z.string().transform(v => v ? v.split(',').map(s => s.trim()).filter(Boolean) : []),
  materials:        z.string().transform(v => v ? v.split(',').map(s => s.trim()).filter(Boolean) : []),
  intro_text:       z.string().min(1),
  development_text: z.string().min(1),
  conclusion_text:  z.string().min(1),
})

export async function createDailyPlanAction(_: unknown, formData: FormData) {
  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }

  const parsed = DailyPlanSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const { data, error } = await InspectionRepository.insertDailyPlan({
    ...parsed.data,
    teacher_id: ability.userId,
    school_id:  ability.schoolId,
  })
  if (error) return { error: error.message }

  revalidatePath('/profil/dosyam')
  revalidatePath('/profil/dosyam/gunluk-plan')
  return { id: data?.id }
}

export async function updateDailyPlanAction(id: string, _: unknown, formData: FormData) {
  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }

  const parsed = DailyPlanSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const { error } = await InspectionRepository.updateDailyPlan(id, ability.userId, parsed.data)
  if (error) return { error: error.message }

  revalidatePath('/profil/dosyam/gunluk-plan')
  return {}
}

export async function deleteDailyPlanAction(id: string) {
  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }

  const { error } = await InspectionRepository.softDeleteDailyPlan(id, ability.userId)
  if (error) return { error: error.message }

  revalidatePath('/profil/dosyam')
  revalidatePath('/profil/dosyam/gunluk-plan')
  return {}
}

// ── Yıllık Plan ───────────────────────────────────────────────────────────────

export async function getOrCreateAnnualPlanAction(grade: number) {
  return AnnualPlanService.getOrCreate(grade, 'Matematik', getCurrentAcademicYear())
}

export async function approveAnnualPlanAction(planId: string) {
  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }

  const supabase = await (await import('@/src/infrastructure/supabase/server')).createClient()
  const { error } = await supabase
    .from('annual_plans')
    .update({ approved_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('teacher_id', ability.userId)
  if (error) return { error: error.message }

  revalidatePath('/profil/dosyam')
  return {}
}

// ── ŞÖK Raporu ────────────────────────────────────────────────────────────────

const SokBaseSchema = z.object({
  class_id:      z.string().uuid(),
  meeting_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  term:          z.coerce.number().int().pipe(z.union([z.literal(1), z.literal(2)])),
  academic_year: z.string().min(7).max(9),
})

export async function createSokReportAction(_: unknown, formData: FormData) {
  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }

  const parsed = SokBaseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const agendaItems = DEFAULT_AGENDA_ITEMS.map(item => ({
    ...item, discussed: false, note: '',
  }))
  const decisions = DEFAULT_DECISIONS.map(d => ({ ...d, note: '' }))

  const participantsRaw = formData.get('participants')
  const participants = participantsRaw ? JSON.parse(participantsRaw as string) : []

  const agendaRaw = formData.get('agenda_items')
  const finalAgenda = agendaRaw ? JSON.parse(agendaRaw as string) : agendaItems

  const { data, error } = await InspectionRepository.insertSokReport({
    ...parsed.data,
    teacher_id:    ability.userId,
    school_id:     ability.schoolId,
    participants,
    agenda_items:  finalAgenda,
    decisions,
    student_notes: [],
  })
  if (error) return { error: error.message }

  revalidatePath('/profil/dosyam')
  revalidatePath('/profil/dosyam/sok')
  return { id: data?.id }
}

export async function updateSokReportAction(id: string, updates: {
  participants?:  unknown[]
  agenda_items?:  unknown[]
  decisions?:     unknown[]
  student_notes?: unknown[]
}) {
  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }

  const { error } = await InspectionRepository.updateSokReport(id, ability.userId, updates as never)
  if (error) return { error: error.message }

  revalidatePath('/profil/dosyam/sok')
  return {}
}

// ── Defter Kontrolü ───────────────────────────────────────────────────────────

const NotebookCheckSchema = z.object({
  class_id:   z.string().uuid(),
  check_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes:      z.string().max(500).optional().transform(v => v ?? null),
})

export async function createNotebookCheckAction(_: unknown, formData: FormData) {
  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }

  const parsed = NotebookCheckSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const { error } = await InspectionRepository.insertNotebookCheck({
    ...parsed.data,
    teacher_id: ability.userId,
    school_id:  ability.schoolId,
  })
  if (error) return { error: error.message }

  revalidatePath('/profil/dosyam')
  revalidatePath('/profil/dosyam/defter-kontrolu')
  return {}
}

export async function deleteNotebookCheckAction(id: string) {
  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }

  const { error } = await InspectionRepository.deleteNotebookCheck(id, ability.userId)
  if (error) return { error: error.message }

  revalidatePath('/profil/dosyam/defter-kontrolu')
  return {}
}

// ── Yardımcı ─────────────────────────────────────────────────────────────────
function getCurrentAcademicYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const start = month >= 9 ? year : year - 1
  return `${start}-${start + 1}`
}
```

- [ ] **Step 2: Commit**

```bash
git add app/actions/inspection.ts
git commit -m "feat: inspection server actions (daily plan, annual plan, ŞÖK, notebook check)"
```

---

## Task 7: Dosyam Ana Sayfası + Profil Sekmesi

**Files:**
- Modify: `app/(dashboard)/profil/page.tsx`
- Create: `app/(dashboard)/profil/dosyam/page.tsx`

- [ ] **Step 1: Profil sayfasına "Dosyam" bağlantısı ekle**

`app/(dashboard)/profil/page.tsx` dosyasını şu şekilde değiştir:

```typescript
// app/(dashboard)/profil/page.tsx
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProfilForm from './ProfilForm'

export default async function ProfilPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile()

  return (
    <div>
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <span className="px-4 py-2 text-sm font-medium border-b-2 border-blue-600 text-blue-600">
          Profilim
        </span>
        <Link
          href="/profil/dosyam"
          className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          Dosyam
        </Link>
      </div>
      <ProfilForm
        defaultFullName={profile?.full_name ?? ''}
        defaultSubject={profile?.subject ?? ''}
        schoolName={profile?.schools?.name ?? null}
        email={user.email ?? ''}
        role={profile?.role ?? 'ogretmen'}
      />
    </div>
  )
}
```

- [ ] **Step 2: Dosyam ana sayfasını oluştur**

```typescript
// app/(dashboard)/profil/dosyam/page.tsx
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { InspectionService } from '@/src/domains/inspection/services/InspectionService'
import { createClient }      from '@/src/infrastructure/supabase/server'

export default async function DosyamPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { count: zumreCount } = await supabase
    .from('zumre_meetings')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', profile.school_id)
  const { count: examCount } = await supabase
    .from('common_exams')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', profile.school_id)

  const status = await InspectionService.getCompletionStatus({
    zumreCount: zumreCount ?? 0,
    examCount:  examCount  ?? 0,
  })

  const missingDocs = [
    !status.dailyPlans     && 'Günlük Planlar',
    !status.annualPlan     && 'Yıllık Plan',
    !status.zumreMeetings  && 'Zümre Toplantıları',
    !status.commonExams    && 'Yazılı Sınavlar',
    !status.sokReports     && 'ŞÖK Tutanakları',
    !status.notebookChecks && 'Defter Kontrolü',
  ].filter(Boolean) as string[]

  return (
    <div>
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <Link
          href="/profil"
          className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          Profilim
        </Link>
        <span className="px-4 py-2 text-sm font-medium border-b-2 border-blue-600 text-blue-600">
          Dosyam
        </span>
      </div>

      <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-xl p-5 text-white mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-bold">{profile.full_name} · {profile.subject ?? 'Öğretmen'}</div>
            <div className="text-xs opacity-75 mt-1">2025–2026 · Dönem Dosyası</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold">%{status.score}</div>
            <div className="text-xs opacity-75">dosya tamamlanma</div>
          </div>
        </div>
        <div className="bg-white/20 rounded h-1.5 mb-3">
          <div
            className="bg-emerald-400 h-1.5 rounded transition-all"
            style={{ width: `${status.score}%` }}
          />
        </div>
        {missingDocs.length > 0 && (
          <div className="bg-red-500/80 rounded-lg px-3 py-2 text-xs inline-flex items-center gap-2">
            ⚠️ {missingDocs.length} eksik belge: <strong>{missingDocs.join(', ')}</strong>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <DocRow ok={status.dailyPlans}     icon="📋" title="Günlük Ders Planları"      href="/profil/dosyam/gunluk-plan"  newHref="/profil/dosyam/gunluk-plan/yeni" />
        <DocRow ok={status.annualPlan}     icon="📅" title="Yıllık Plan"               href="/profil/dosyam/yillik-plan" />
        <DocRow ok={status.zumreMeetings}  icon="👥" title="Zümre Toplantı Raporları"  href="/zumre"    external />
        <DocRow ok={status.commonExams}    icon="📝" title="Yazılı Sınavlar"           href="/yazili"   external />
        <DocRow ok={status.sokReports}     icon="📑" title="ŞÖK Tutanakları"           href="/profil/dosyam/sok"           newHref="/profil/dosyam/sok/yeni" />
        <DocRow ok={status.notebookChecks} icon="📓" title="Defter Kontrolü"           href="/profil/dosyam/defter-kontrolu" newHref="/profil/dosyam/defter-kontrolu" />
      </div>
    </div>
  )
}

function DocRow({
  ok, icon, title, href, newHref, external,
}: {
  ok:       boolean
  icon:     string
  title:    string
  href:     string
  newHref?: string
  external?: boolean
}) {
  return (
    <div className={`border rounded-lg px-3 py-2.5 flex items-center gap-3 ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
      <span className="text-xl">{icon}</span>
      <div className="flex-1">
        <div className={`text-sm font-bold ${ok ? 'text-emerald-800' : 'text-red-800'}`}>{title}</div>
        {!ok && <div className="text-xs text-red-500 mt-0.5">⚠️ Bu dönem kayıt yok</div>}
      </div>
      <div className="flex gap-1.5">
        {newHref && (
          <Link
            href={newHref}
            className={`text-xs rounded px-2 py-1 ${ok ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'}`}
          >
            + Yeni
          </Link>
        )}
        <Link
          href={href}
          className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-1"
          {...(external ? { target: '_blank' } : {})}
        >
          {external ? 'Git →' : 'Listele'}
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Dev sunucusunu kontrol et**

```bash
npx next dev
```

`http://localhost:3000/profil` → "Dosyam" sekmesi görünmeli. `/profil/dosyam` → tamamlanma kartı ve 6 belge satırı görünmeli.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/profil/page.tsx" "app/(dashboard)/profil/dosyam/page.tsx"
git commit -m "feat: Dosyam page with completion score and document list"
```

---

## Task 8: Günlük Plan Sayfaları

**Files:**
- Create: `app/(dashboard)/profil/dosyam/gunluk-plan/page.tsx`
- Create: `app/(dashboard)/profil/dosyam/gunluk-plan/yeni/page.tsx`
- Create: `app/(dashboard)/profil/dosyam/gunluk-plan/yeni/GunlukPlanForm.tsx`
- Create: `app/(dashboard)/profil/dosyam/gunluk-plan/[id]/page.tsx`

- [ ] **Step 1: Liste sayfası**

```typescript
// app/(dashboard)/profil/dosyam/gunluk-plan/page.tsx
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect }          from 'next/navigation'
import Link                  from 'next/link'
import { InspectionRepository } from '@/src/domains/inspection/repositories/InspectionRepository'

export default async function GunlukPlanListPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const { data: plans = [] } = await InspectionRepository.findDailyPlans(profile.id, profile.school_id)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Günlük Ders Planları</h1>
        <Link
          href="/profil/dosyam/gunluk-plan/yeni"
          className="text-sm bg-blue-600 text-white rounded-lg px-3 py-1.5"
        >
          + Yeni Plan
        </Link>
      </div>
      {plans.length === 0 ? (
        <p className="text-gray-500 text-sm">Henüz günlük plan eklenmemiş.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {plans.map(plan => (
            <Link
              key={plan.id}
              href={`/profil/dosyam/gunluk-plan/${plan.id}`}
              className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-medium">{plan.topic}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {plan.plan_date} · {plan.lesson_hour}. Saat · {plan.unit}
                </div>
              </div>
              <span className="text-xs text-gray-400">Düzenle →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Yeni plan server sayfası**

```typescript
// app/(dashboard)/profil/dosyam/gunluk-plan/yeni/page.tsx
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect }          from 'next/navigation'
import { createClient }      from '@/src/infrastructure/supabase/server'
import GunlukPlanForm        from './GunlukPlanForm'

export default async function YeniGunlukPlanPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: classes = [] } = await supabase
    .from('classes')
    .select('id, name, grade')
    .eq('school_id', profile.school_id)
    .order('grade')
    .order('name')

  return <GunlukPlanForm classes={classes} />
}
```

- [ ] **Step 3: GunlukPlanForm client component**

Checkbox değerlerini `useState` ile yönet — `dangerouslySetInnerHTML` kullanma.

```typescript
// app/(dashboard)/profil/dosyam/gunluk-plan/yeni/GunlukPlanForm.tsx
'use client'

import { useActionState, useState, useEffect } from 'react'
import { useRouter }     from 'next/navigation'
import { createDailyPlanAction } from '@/app/actions/inspection'
import {
  DEFAULT_INTRO_TEXT,
  DEFAULT_DEVELOPMENT_TEXT,
  DEFAULT_CONCLUSION_TEXT,
  LESSON_METHODS,
  LESSON_MATERIALS,
} from '@/src/domains/inspection/types'

interface Props {
  classes: { id: string; name: string; grade: number }[]
  defaultValues?: {
    class_id:         string
    plan_date:        string
    lesson_hour:      number
    unit:             string
    topic:            string
    objectives:       string[]
    methods:          string[]
    materials:        string[]
    intro_text:       string
    development_text: string
    conclusion_text:  string
  }
}

export default function GunlukPlanForm({ classes, defaultValues }: Props) {
  const [state, action, pending] = useActionState(createDailyPlanAction, null)
  const router = useRouter()

  const [selectedMethods,   setSelectedMethods]   = useState<string[]>(defaultValues?.methods   ?? [])
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(defaultValues?.materials ?? [])

  useEffect(() => {
    if (state && 'id' in state && state.id) {
      router.push('/profil/dosyam/gunluk-plan')
    }
  }, [state, router])

  const toggleMethod = (m: string) =>
    setSelectedMethods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  const toggleMaterial = (m: string) =>
    setSelectedMaterials(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  return (
    <form action={action} className="flex flex-col gap-4 max-w-2xl">
      <h1 className="text-lg font-bold">Yeni Günlük Plan</h1>

      {state?.error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {state.error}
        </div>
      )}

      {/* Controlled hidden inputs — güvenli, XSS riski yok */}
      <input type="hidden" name="methods"   value={selectedMethods.join(',')} />
      <input type="hidden" name="materials" value={selectedMaterials.join(',')} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-700">Sınıf *</label>
          <select name="class_id" required defaultValue={defaultValues?.class_id ?? ''}
            className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
            <option value="">Seç...</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700">Tarih *</label>
          <input type="date" name="plan_date" required
            defaultValue={defaultValues?.plan_date ?? new Date().toISOString().split('T')[0]}
            className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700">Ders Saati *</label>
          <select name="lesson_hour" required defaultValue={defaultValues?.lesson_hour ?? '1'}
            className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
            {[1,2,3,4,5,6,7,8].map(h => (
              <option key={h} value={h}>{h}. Saat</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700">Ünite *</label>
          <input type="text" name="unit" required defaultValue={defaultValues?.unit ?? ''}
            placeholder="ör: Fonksiyonlar"
            className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-700">Konu *</label>
        <input type="text" name="topic" required defaultValue={defaultValues?.topic ?? ''}
          placeholder="ör: Bileşke Fonksiyon"
          className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-700 block mb-1">Öğretim Yöntemleri</label>
        <div className="flex flex-wrap gap-2">
          {LESSON_METHODS.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMethod(m)}
              className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                selectedMethods.includes(m)
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}
            >
              {selectedMethods.includes(m) ? '✓ ' : ''}{m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-700 block mb-1">Araç-Gereçler</label>
        <div className="flex flex-wrap gap-2">
          {LESSON_MATERIALS.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMaterial(m)}
              className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                selectedMaterials.includes(m)
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}
            >
              {selectedMaterials.includes(m) ? '✓ ' : ''}{m}
            </button>
          ))}
        </div>
      </div>

      {[
        { name: 'intro_text',       label: 'Giriş / Hazırlık (5 dk)',       def: DEFAULT_INTRO_TEXT },
        { name: 'development_text', label: 'Gelişme / Konu İşleme (30 dk)', def: DEFAULT_DEVELOPMENT_TEXT },
        { name: 'conclusion_text',  label: 'Sonuç / Değerlendirme (5 dk)',  def: DEFAULT_CONCLUSION_TEXT },
      ].map(({ name, label, def }) => (
        <div key={name}>
          <label className="text-xs font-semibold text-gray-700">{label}</label>
          <textarea
            name={name}
            required
            rows={3}
            defaultValue={(defaultValues as Record<string, unknown>)?.[name] as string ?? def}
            className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm resize-y"
          />
        </div>
      ))}

      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="bg-blue-600 text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50">
          {pending ? 'Kaydediliyor...' : '💾 Kaydet'}
        </button>
        <a href="/profil/dosyam/gunluk-plan"
          className="bg-gray-100 text-gray-700 text-sm rounded-lg px-4 py-2">
          İptal
        </a>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Düzenleme sayfası**

```typescript
// app/(dashboard)/profil/dosyam/gunluk-plan/[id]/page.tsx
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect, notFound } from 'next/navigation'
import { createClient }       from '@/src/infrastructure/supabase/server'
import { InspectionRepository } from '@/src/domains/inspection/repositories/InspectionRepository'
import GunlukPlanForm from '../yeni/GunlukPlanForm'

export default async function GunlukPlanEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const { data: plan } = await InspectionRepository.findDailyPlan(id, profile.id)
  if (!plan) notFound()

  const supabase = await createClient()
  const { data: classes = [] } = await supabase
    .from('classes')
    .select('id, name, grade')
    .eq('school_id', profile.school_id)
    .order('grade').order('name')

  return (
    <GunlukPlanForm
      classes={classes}
      defaultValues={{
        class_id:         plan.class_id,
        plan_date:        plan.plan_date,
        lesson_hour:      plan.lesson_hour,
        unit:             plan.unit,
        topic:            plan.topic,
        objectives:       plan.objectives,
        methods:          plan.methods,
        materials:        plan.materials,
        intro_text:       plan.intro_text,
        development_text: plan.development_text,
        conclusion_text:  plan.conclusion_text,
      }}
    />
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/profil/dosyam/gunluk-plan/"
git commit -m "feat: daily plan list, create, and edit pages"
```

---

## Task 9: Yıllık Plan Sayfası

**Files:**
- Create: `app/(dashboard)/profil/dosyam/yillik-plan/page.tsx`

- [ ] **Step 1: Yıllık plan sayfasını oluştur**

```typescript
// app/(dashboard)/profil/dosyam/yillik-plan/page.tsx
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect }          from 'next/navigation'
import { AnnualPlanService } from '@/src/domains/inspection/services/AnnualPlanService'
import { approveAnnualPlanAction } from '@/app/actions/inspection'

function getCurrentAcademicYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const start = month >= 9 ? year : year - 1
  return `${start}-${start + 1}`
}

export default async function YillikPlanPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  // Sınıf seviyesi ileriki bir sprint'te profile'e eklenecek; şimdilik 10 sabit.
  const grade = 10
  const academicYear = getCurrentAcademicYear()

  const { data: plan, error } = await AnnualPlanService.getOrCreate(
    grade,
    profile.subject ?? 'Matematik',
    academicYear,
  )

  if (error || !plan) {
    return <p className="text-red-600 text-sm">Yıllık plan oluşturulamadı: {error}</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold">Yıllık Plan</h1>
          <p className="text-xs text-gray-500">{academicYear} · {plan.subject} · {grade}. Sınıf</p>
        </div>
        {plan.approved_at ? (
          <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-3 py-1">
            ✓ Onaylandı — {new Date(plan.approved_at).toLocaleDateString('tr-TR')}
          </span>
        ) : (
          <form action={approveAnnualPlanAction.bind(null, plan.id)}>
            <button type="submit"
              className="text-sm bg-blue-600 text-white rounded-lg px-3 py-1.5">
              Onayla
            </button>
          </form>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 w-12">Hafta</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 w-28">Tarihler</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600">Konular</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {plan.weekly_plan.map(week => (
              <tr key={week.week} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500">{week.week}</td>
                <td className="px-3 py-2 text-gray-500 font-mono">{week.dates}</td>
                <td className="px-3 py-2 text-gray-800">{week.topics.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/profil/dosyam/yillik-plan/page.tsx"
git commit -m "feat: annual plan page with auto-generation and approval"
```

---

## Task 10: ŞÖK Tutanağı Sayfaları

**Files:**
- Create: `app/(dashboard)/profil/dosyam/sok/page.tsx`
- Create: `app/(dashboard)/profil/dosyam/sok/yeni/page.tsx`
- Create: `app/(dashboard)/profil/dosyam/sok/yeni/SokForm.tsx`
- Create: `app/(dashboard)/profil/dosyam/sok/[id]/page.tsx`

- [ ] **Step 1: ŞÖK liste sayfası**

```typescript
// app/(dashboard)/profil/dosyam/sok/page.tsx
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect }          from 'next/navigation'
import Link                  from 'next/link'
import { InspectionRepository } from '@/src/domains/inspection/repositories/InspectionRepository'

export default async function SokListPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const { data: reports = [] } = await InspectionRepository.findSokReports(profile.id, profile.school_id)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">ŞÖK Tutanakları</h1>
        <Link href="/profil/dosyam/sok/yeni"
          className="text-sm bg-blue-600 text-white rounded-lg px-3 py-1.5">
          + Yeni Tutanak
        </Link>
      </div>
      {reports.length === 0 ? (
        <p className="text-gray-500 text-sm">Bu dönem tutanak yok.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {reports.map(r => (
            <Link key={r.id} href={`/profil/dosyam/sok/${r.id}`}
              className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{r.meeting_date} · {r.term}. Dönem</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {r.participants.length} katılımcı · {r.academic_year}
                </div>
              </div>
              <span className="text-xs text-gray-400">Detay →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Yeni ŞÖK server sayfası**

```typescript
// app/(dashboard)/profil/dosyam/sok/yeni/page.tsx
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect }          from 'next/navigation'
import { createClient }      from '@/src/infrastructure/supabase/server'
import SokForm               from './SokForm'

function getCurrentAcademicYear(): string {
  const now = new Date(); const m = now.getMonth() + 1; const y = now.getFullYear()
  const s = m >= 9 ? y : y - 1; return `${s}-${s + 1}`
}

export default async function YeniSokPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const [{ data: classes = [] }, { data: teachers = [] }] = await Promise.all([
    supabase.from('classes').select('id, name, grade')
      .eq('school_id', profile.school_id).order('grade').order('name'),
    supabase.from('profiles').select('id, full_name, subject')
      .eq('school_id', profile.school_id).eq('role', 'ogretmen'),
  ])

  const now = new Date()
  const month = now.getMonth() + 1
  const currentTerm: 1 | 2 = (month >= 9 || month <= 1) ? 1 : 2

  return (
    <SokForm
      classes={classes}
      teachers={teachers}
      currentTerm={currentTerm}
      academicYear={getCurrentAcademicYear()}
    />
  )
}
```

- [ ] **Step 3: SokForm client component**

```typescript
// app/(dashboard)/profil/dosyam/sok/yeni/SokForm.tsx
'use client'

import { useState, useEffect } from 'react'
import { useActionState }      from 'react'
import { useRouter }           from 'next/navigation'
import { createSokReportAction } from '@/app/actions/inspection'
import { DEFAULT_AGENDA_ITEMS, DEFAULT_DECISIONS } from '@/src/domains/inspection/types'
import type { AgendaItem, Participant } from '@/src/domains/inspection/types'

interface Props {
  classes:      { id: string; name: string; grade: number }[]
  teachers:     { id: string; full_name: string; subject: string | null }[]
  currentTerm:  1 | 2
  academicYear: string
}

export default function SokForm({ classes, teachers, currentTerm, academicYear }: Props) {
  const [state, action, pending] = useActionState(createSokReportAction, null)
  const router = useRouter()

  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>(
    DEFAULT_AGENDA_ITEMS.map(item => ({ ...item, discussed: false, note: '' }))
  )
  const [selectedTeachers, setSelectedTeachers] = useState<Participant[]>([])

  useEffect(() => {
    if (state && 'id' in state && state.id) router.push('/profil/dosyam/sok')
  }, [state, router])

  const toggleDiscussed = (order: number) =>
    setAgendaItems(prev => prev.map(item =>
      item.order === order ? { ...item, discussed: !item.discussed } : item
    ))

  const setAgendaNote = (order: number, note: string) =>
    setAgendaItems(prev => prev.map(item =>
      item.order === order ? { ...item, note } : item
    ))

  const toggleTeacher = (t: { id: string; full_name: string; subject: string | null }) =>
    setSelectedTeachers(prev => {
      const exists = prev.some(p => p.user_id === t.id)
      return exists
        ? prev.filter(p => p.user_id !== t.id)
        : [...prev, { user_id: t.id, full_name: t.full_name, subject: t.subject ?? '' }]
    })

  const defaultDecisions = DEFAULT_DECISIONS.map(d => ({ ...d, note: '' }))

  return (
    <form action={action} className="flex flex-col gap-5 max-w-2xl">
      <h1 className="text-lg font-bold">Yeni ŞÖK Tutanağı</h1>

      {state?.error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {state.error}
        </div>
      )}

      {/* JSON hidden fields — değerler React state'ten geliyor, güvenli */}
      <input type="hidden" name="participants"  value={JSON.stringify(selectedTeachers)} />
      <input type="hidden" name="agenda_items"  value={JSON.stringify(agendaItems)} />
      <input type="hidden" name="decisions"     value={JSON.stringify(defaultDecisions)} />
      <input type="hidden" name="academic_year" value={academicYear} />

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-700">Şube *</label>
          <select name="class_id" required
            className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
            <option value="">Seç...</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700">Toplantı Tarihi *</label>
          <input type="date" name="meeting_date" required
            defaultValue={new Date().toISOString().split('T')[0]}
            className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700">Dönem *</label>
          <select name="term" required defaultValue={currentTerm}
            className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
            <option value={1}>1. Dönem</option>
            <option value={2}>2. Dönem</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-700 block mb-1">Katılımcı Öğretmenler</label>
        <div className="flex flex-wrap gap-2 border border-gray-200 rounded-lg p-2">
          {teachers.map(t => {
            const selected = selectedTeachers.some(p => p.user_id === t.id)
            return (
              <button key={t.id} type="button" onClick={() => toggleTeacher(t)}
                className={`text-xs rounded-full px-2 py-1 border transition-colors ${
                  selected
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}>
                {t.full_name}{t.subject ? ` (${t.subject})` : ''}{selected ? ' ✓' : ''}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-700 block mb-2">Gündem Maddeleri</label>
        <div className="flex flex-col gap-1.5">
          {agendaItems.map(item => (
            <div key={item.order}
              className={`border rounded-lg p-2.5 ${
                item.discussed ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200'
              }`}>
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => toggleDiscussed(item.order)}
                  className={`w-4 h-4 mt-0.5 rounded flex-shrink-0 border flex items-center justify-center text-xs ${
                    item.discussed
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-gray-300'
                  }`}>
                  {item.discussed ? '✓' : ''}
                </button>
                <span className={`text-xs flex-1 ${item.discussed ? 'text-emerald-800 font-medium' : 'text-gray-600'}`}>
                  {item.order}. {item.text}
                </span>
              </div>
              {item.discussed && (
                <input type="text" placeholder="Not ekle... (opsiyonel)"
                  value={item.note}
                  onChange={e => setAgendaNote(item.order, e.target.value)}
                  className="w-full mt-1.5 ml-6 text-xs border border-emerald-200 rounded px-2 py-1" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-700 block mb-2">Alınan Kararlar</label>
        <div className="flex flex-col gap-1 border border-gray-200 rounded-lg overflow-hidden">
          {defaultDecisions.map(d => (
            <div key={d.order} className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-0">
              <span className="text-xs text-gray-400 w-4">{d.order}.</span>
              <span className="text-xs text-gray-700 flex-1">{d.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="bg-blue-600 text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50">
          {pending ? 'Kaydediliyor...' : '💾 Tutanağı Kaydet'}
        </button>
        <a href="/profil/dosyam/sok" className="bg-gray-100 text-gray-700 text-sm rounded-lg px-4 py-2">
          İptal
        </a>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: ŞÖK detay sayfası**

```typescript
// app/(dashboard)/profil/dosyam/sok/[id]/page.tsx
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { InspectionRepository } from '@/src/domains/inspection/repositories/InspectionRepository'

export default async function SokDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const { data: report } = await InspectionRepository.findSokReport(id, profile.id)
  if (!report) notFound()

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold">ŞÖK Tutanağı</h1>
          <p className="text-xs text-gray-500">
            {report.meeting_date} · {report.term}. Dönem · {report.academic_year}
          </p>
        </div>
        <Link href="/profil/dosyam/sok" className="text-xs text-gray-500">← Geri</Link>
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-700 mb-1">Katılımcılar</div>
        <div className="flex flex-wrap gap-1.5">
          {report.participants.map((p, i) => (
            <span key={i} className="text-xs bg-blue-100 text-blue-800 rounded-full px-2 py-0.5">
              {p.full_name}{p.subject ? ` (${p.subject})` : ''}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-700 mb-2">Gündem Maddeleri</div>
        <div className="flex flex-col gap-1">
          {report.agenda_items.map(item => (
            <div key={item.order}
              className={`border rounded p-2 text-xs ${
                item.discussed ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200'
              }`}>
              <span className={item.discussed ? 'text-emerald-800 font-medium' : 'text-gray-500'}>
                {item.discussed ? '✓ ' : ''}{item.order}. {item.text}
              </span>
              {item.note && <div className="text-gray-500 mt-1 pl-4">{item.note}</div>}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-700 mb-2">Alınan Kararlar</div>
        <div className="flex flex-col gap-1">
          {report.decisions.map(d => (
            <div key={d.order}
              className="text-xs text-gray-700 flex gap-2 border border-gray-100 rounded p-2">
              <span className="text-gray-400">{d.order}.</span>
              <span>{d.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/profil/dosyam/sok/"
git commit -m "feat: ŞÖK report list, create, and detail pages"
```

---

## Task 11: Defter Kontrolü Sayfası

**Files:**
- Create: `app/(dashboard)/profil/dosyam/defter-kontrolu/page.tsx`
- Create: `app/(dashboard)/profil/dosyam/defter-kontrolu/NotebookCheckClient.tsx`

- [ ] **Step 1: Server sayfası**

```typescript
// app/(dashboard)/profil/dosyam/defter-kontrolu/page.tsx
import { getCurrentProfile } from '@/src/shared/auth'
import { redirect }          from 'next/navigation'
import { createClient }      from '@/src/infrastructure/supabase/server'
import { InspectionRepository } from '@/src/domains/inspection/repositories/InspectionRepository'
import NotebookCheckClient   from './NotebookCheckClient'

export default async function DefterKontrolPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const [{ data: checks = [] }, { data: classes = [] }] = await Promise.all([
    InspectionRepository.findNotebookChecks(profile.id, profile.school_id),
    supabase.from('classes').select('id, name, grade')
      .eq('school_id', profile.school_id).order('grade').order('name'),
  ])

  return (
    <div>
      <h1 className="text-lg font-bold mb-4">Defter Kontrolü</h1>
      <NotebookCheckClient classes={classes} checks={checks} />
    </div>
  )
}
```

- [ ] **Step 2: Client component**

```typescript
// app/(dashboard)/profil/dosyam/defter-kontrolu/NotebookCheckClient.tsx
'use client'

import { useActionState } from 'react'
import { createNotebookCheckAction, deleteNotebookCheckAction } from '@/app/actions/inspection'
import type { NotebookCheck } from '@/src/domains/inspection/types'

interface Props {
  classes: { id: string; name: string; grade: number }[]
  checks:  (NotebookCheck & { classes: { name: string } | null })[]
}

export default function NotebookCheckClient({ classes, checks }: Props) {
  const [state, action, pending] = useActionState(createNotebookCheckAction, null)

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <div className="text-sm font-semibold text-gray-700 mb-3">Yeni Kontrol Kaydı</div>
        {state?.error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-1.5 mb-2">
            {state.error}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div>
            <label className="text-xs font-medium text-gray-600">Sınıf *</label>
            <select name="class_id" required
              className="w-full mt-0.5 border border-gray-300 rounded px-2 py-1 text-sm">
              <option value="">Seç...</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Tarih *</label>
            <input type="date" name="check_date" required
              defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full mt-0.5 border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Not (opsiyonel)</label>
            <input type="text" name="notes" placeholder="Genel gözlem..."
              className="w-full mt-0.5 border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
        </div>
        <button type="submit" disabled={pending}
          className="bg-blue-600 text-white text-sm rounded px-3 py-1.5 disabled:opacity-50">
          {pending ? 'Kaydediliyor...' : '+ Kaydet'}
        </button>
      </form>

      {checks.length === 0 ? (
        <p className="text-gray-500 text-sm">Bu dönem kayıt yok.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {checks.map(check => (
            <div key={check.id}
              className="border border-gray-200 rounded-lg px-3 py-2 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">{check.classes?.name ?? '—'}</span>
                <span className="text-xs text-gray-500 ml-2">{check.check_date}</span>
                {check.notes && (
                  <span className="text-xs text-gray-400 ml-2">· {check.notes}</span>
                )}
              </div>
              <form action={deleteNotebookCheckAction.bind(null, check.id)}>
                <button type="submit" className="text-xs text-red-400 hover:text-red-600 px-1">
                  Sil
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/profil/dosyam/defter-kontrolu/"
git commit -m "feat: notebook check log page (create + delete)"
```

---

## Task 12: Son Kontrol

- [ ] **Step 1: Tüm testleri çalıştır**

```bash
npx vitest run
```

Beklenen: önceki testler dahil hepsi PASS. Yeni: 8 inspection unit testi PASS.

- [ ] **Step 2: TypeScript derlemesini kontrol et**

```bash
npx tsc --noEmit
```

Beklenen: hata yok.

- [ ] **Step 3: Dev sunucusunda manuel test**

Şu akışları test et:
1. `/profil` → "Dosyam" sekmesi görünüyor mu?
2. `/profil/dosyam` → tamamlanma kartı, 6 belge satırı görünüyor mu?
3. `/profil/dosyam/gunluk-plan/yeni` → form doldur, kaydet → listede görünüyor mu?
4. `/profil/dosyam/yillik-plan` → 36 haftalık tablo yükleniyor mu, Onayla butonu çalışıyor mu?
5. `/profil/dosyam/sok/yeni` → gündem maddeleri işaretlenip kaydediliyor mu?
6. `/profil/dosyam/defter-kontrolu` → kayıt ekle ve sil çalışıyor mu?

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: Öğretmen Dosyası (Denetim Paketi) complete — 6 document types, completion score, all CRUD"
```
