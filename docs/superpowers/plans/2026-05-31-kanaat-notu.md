# Kanaat Notu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Not defterine "Kanaat" sekmesi ekleyerek öğretmenin dönem sonunda üç kaynaktan (ödev, devamsızlık, sınav) otomatik kanaat notu hesaplatmasını ve düzenleyip kaydetmesini sağlamak.

**Architecture:** Saf `computeKanaat()` fonksiyonu hesaplamayı yapar (DB yok, test edilebilir). `KanaatService` yetki kontrolü + DB işlemlerini yönetir. `page.tsx` mevcut kayıtları server-side fetch eder; `NotDefteriTabs` client wrapper sekme state'ini yönetir; `KanaatSekmesi` oluştur→düzenle→kaydet akışını çalıştırır.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase SSR, Zod v4, Vitest

---

## Dosya Haritası

| Dosya | İşlem | Sorumluluk |
|---|---|---|
| `src/domains/rbac/types/index.ts` | Modify | `'kanaat'` Resource ekle |
| `src/shared/permissions/index.ts` | Modify | `P.KANAAT` sabitleri ekle |
| `src/domains/kanaat/types/index.ts` | Create | Tip tanımları |
| `src/domains/kanaat/lib/computeKanaat.ts` | Create | Saf hesaplama fonksiyonu |
| `src/domains/kanaat/repositories/KanaatRepository.ts` | Create | DB operasyonları |
| `src/domains/kanaat/services/KanaatService.ts` | Create | İş mantığı + yetki kontrolü |
| `app/actions/kanaat.ts` | Create | Server actions |
| `app/(dashboard)/not-defteri/[classId]/KanaatSekmesi.tsx` | Create | Kanaat sekmesi UI |
| `app/(dashboard)/not-defteri/[classId]/NotDefteriTabs.tsx` | Create | Sekme wrapper (client) |
| `app/(dashboard)/not-defteri/[classId]/page.tsx` | Modify | Kanaat verisi fetch + NotDefteriTabs kullan |
| `tests/vitest/unit/kanaat/computeKanaat.test.ts` | Create | Saf fonksiyon unit testleri |
| `tests/vitest/unit/kanaat/kanaat-service.test.ts` | Create | Service unit testleri |
| `tests/vitest/setup/factories.ts` | Modify | KANAAT izinleri OGRETMEN_PERMS'e ekle |

---

## Task 1: DB Migration — `kanaat_notlari` Tablosu

**Files:**
- Supabase MCP ile migration uygula

- [ ] **Step 1: Migration SQL'i Supabase'e uygula**

Supabase MCP `apply_migration` aracını kullan. Migration adı: `create_kanaat_notlari`.

```sql
CREATE TABLE kanaat_notlari (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid        NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  class_id    uuid        NOT NULL REFERENCES classes(id)   ON DELETE CASCADE,
  teacher_id  uuid        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  school_id   uuid        NOT NULL,
  score       smallint    NOT NULL CHECK (score BETWEEN 1 AND 5),
  text        text        NOT NULL,
  donem       text        NOT NULL CHECK (donem ~ '^\d{4}-\d{4}-(1|2)$'),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, donem)
);

ALTER TABLE kanaat_notlari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_isolation" ON kanaat_notlari
  USING (
    school_id = (
      SELECT school_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    school_id = (
      SELECT school_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE INDEX idx_kanaat_class_donem ON kanaat_notlari (class_id, donem);
```

- [ ] **Step 2: Migration başarılı mı kontrol et**

Supabase MCP `list_migrations` ile en son migration listede görünüyor mu?

---

## Task 2: RBAC Güncellemeleri

**Files:**
- Modify: `src/domains/rbac/types/index.ts`
- Modify: `src/shared/permissions/index.ts`
- Modify: `tests/vitest/setup/factories.ts`

- [ ] **Step 1: `'kanaat'` Resource tipine ekle**

`src/domains/rbac/types/index.ts` dosyasında `Resource` type'ını güncelle:

```ts
export type Resource =
  | 'homework'
  | 'attendance'
  | 'curriculum'
  | 'students'
  | 'classes'
  | 'zumre'
  | 'exam'
  | 'users'
  | 'school'
  | 'export'
  | 'notes'
  | 'grades'
  | 'kanaat'
```

- [ ] **Step 2: `P.KANAAT` sabitlerini ekle**

`src/shared/permissions/index.ts` dosyasında `P` objesine şunu ekle (GRADES bloğunun hemen altına):

```ts
KANAAT: {
  CREATE: p('kanaat', 'create'),
  READ:   p('kanaat', 'read'),
  UPDATE: p('kanaat', 'update'),
},
```

- [ ] **Step 3: Test factories'e KANAAT izinleri ekle**

`tests/vitest/setup/factories.ts` dosyasında `OGRETMEN_PERMS` dizisine şunları ekle:

```ts
{ resource: 'kanaat', action: 'create', scope: 'own',    source: 'role' },
{ resource: 'kanaat', action: 'read',   scope: 'own',    source: 'role' },
{ resource: 'kanaat', action: 'update', scope: 'own',    source: 'role' },
```

- [ ] **Step 4: TS derlemeyi doğrula**

```bash
cd C:\Users\mehme\zumre-takip
npx tsc --noEmit
```

Beklenen: Hata yok.

- [ ] **Step 5: Commit**

```bash
git add src/domains/rbac/types/index.ts src/shared/permissions/index.ts tests/vitest/setup/factories.ts
git commit -m "feat(kanaat): RBAC 'kanaat' resource ve P.KANAAT sabitleri eklendi"
```

---

## Task 3: Tipler ve Saf Hesaplama Fonksiyonu

**Files:**
- Create: `src/domains/kanaat/types/index.ts`
- Create: `src/domains/kanaat/lib/computeKanaat.ts`
- Create: `tests/vitest/unit/kanaat/computeKanaat.test.ts`

- [ ] **Step 1: Tip dosyasını oluştur**

`src/domains/kanaat/types/index.ts`:

```ts
export interface KanaatInput {
  homeworkTotal:  number        // Dönem içi toplam ödev sayısı
  homeworkDone:   number        // Teslim edilen ödev sayısı
  absenceDays:    number        // Devamsızlık gün sayısı
  examAverage:    number | null // 0-100 arası; null = sınav girilmemiş
}

export interface KanaatResult {
  score: 1 | 2 | 3 | 4 | 5
  text:  string
}

export interface KanaatNotu {
  id:         string
  student_id: string
  class_id:   string
  teacher_id: string
  school_id:  string
  score:      number
  text:       string
  donem:      string
  created_at: string
  updated_at: string
}

export interface KanaatHesap {
  studentId:   string
  studentName: string
  score:       1 | 2 | 3 | 4 | 5
  text:        string
}
```

- [ ] **Step 2: Önce testleri yaz (TDD)**

`tests/vitest/unit/kanaat/computeKanaat.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeKanaat, generateKanaatText } from '@/src/domains/kanaat/lib/computeKanaat'

describe('computeKanaat()', () => {
  it('tüm kaynaklar mükemmel → skor 5', () => {
    const result = computeKanaat({ homeworkTotal: 10, homeworkDone: 10, absenceDays: 0, examAverage: 100 })
    expect(result).toBe(5)
  })

  it('tüm kaynaklar sıfır → skor 1', () => {
    const result = computeKanaat({ homeworkTotal: 10, homeworkDone: 0, absenceDays: 20, examAverage: 0 })
    expect(result).toBe(1)
  })

  it('ödev tamamlama %50, devamsızlık 0, sınav 50 → skor 3', () => {
    // odevScore = (0.5 * 4) + 1 = 3.0
    // devamsizlikScore = (20/20 * 4) + 1 = 5.0
    // sinavScore = (50/100 * 4) + 1 = 3.0
    // weighted = 3.0*0.4 + 5.0*0.3 + 3.0*0.3 = 1.2+1.5+0.9 = 3.6 → 4
    const result = computeKanaat({ homeworkTotal: 10, homeworkDone: 5, absenceDays: 0, examAverage: 50 })
    expect(result).toBe(4)
  })

  it('ödev yoksa (homeworkTotal === 0) ödev bileşeni devre dışı kalır', () => {
    // Sadece devamsızlık + sınav aktif → %50 / %50
    // devamsizlikScore = 5 (0 gün), sinavScore = 1 (0 puan)
    // weighted = 5*0.5 + 1*0.5 = 3.0 → 3
    const result = computeKanaat({ homeworkTotal: 0, homeworkDone: 0, absenceDays: 0, examAverage: 0 })
    expect(result).toBe(3)
  })

  it('sınav notu null ise sınav bileşeni devre dışı kalır', () => {
    // Sadece ödev + devamsızlık aktif → %57 / %43 (4:3 oranı)
    // odevScore = 5 (tümü yapıldı), devamsizlikScore = 5 (0 gün)
    // weighted = 5 → 5
    const result = computeKanaat({ homeworkTotal: 5, homeworkDone: 5, absenceDays: 0, examAverage: null })
    expect(result).toBe(5)
  })

  it('devamsızlık 20+ gün → devamsızlık bileşeni 1', () => {
    const result = computeKanaat({ homeworkTotal: 10, homeworkDone: 10, absenceDays: 25, examAverage: 100 })
    // odev=5, devamsizlik=1, sinav=5
    // 5*0.4 + 1*0.3 + 5*0.3 = 2+0.3+1.5 = 3.8 → 4
    expect(result).toBe(4)
  })

  it('dönen değer her zaman 1-5 arası tam sayı', () => {
    const cases: Parameters<typeof computeKanaat>[0][] = [
      { homeworkTotal: 3, homeworkDone: 1, absenceDays: 7, examAverage: 45 },
      { homeworkTotal: 0, homeworkDone: 0, absenceDays: 0, examAverage: null },
      { homeworkTotal: 20, homeworkDone: 20, absenceDays: 0, examAverage: 100 },
    ]
    for (const c of cases) {
      const result = computeKanaat(c)
      expect(result).toBeGreaterThanOrEqual(1)
      expect(result).toBeLessThanOrEqual(5)
      expect(Number.isInteger(result)).toBe(true)
    }
  })
})

describe('generateKanaatText()', () => {
  it('skor 5 → olumlu değerlendirme metni', () => {
    const text = generateKanaatText('Ali Kaya', 5, { homeworkPct: 100, absenceDays: 0, examAverage: 95 })
    expect(text).toContain('Ali Kaya')
    expect(text).toContain('%100')
    expect(text).toContain('0 gün')
    expect(text).toContain('95')
    expect(text).toContain('üstün başarı')
  })

  it('skor 1 → destek gerektiren değerlendirme', () => {
    const text = generateKanaatText('Ayşe M.', 1, { homeworkPct: 20, absenceDays: 18, examAverage: 30 })
    expect(text).toContain('destek gerektiren')
  })

  it('sınav girilmemişse metin içinde sınav bilgisi yok', () => {
    const text = generateKanaatText('Can B.', 3, { homeworkPct: 60, absenceDays: 5, examAverage: null })
    expect(text).not.toMatch(/sınav.*puan/i)
    expect(text).not.toContain('null')
  })
})
```

- [ ] **Step 3: Testlerin başarısız olduğunu doğrula**

```bash
cd C:\Users\mehme\zumre-takip
npx vitest run tests/vitest/unit/kanaat/computeKanaat.test.ts
```

Beklenen: FAIL — modül bulunamadı hatası.

- [ ] **Step 4: `computeKanaat.ts` implementasyonunu yaz**

`src/domains/kanaat/lib/computeKanaat.ts`:

```ts
import type { KanaatInput, KanaatResult } from '../types'

const GENEL_DEGERLENDIRME: Record<1 | 2 | 3 | 4 | 5, string> = {
  5: 'Dönem boyunca üstün başarı göstermiştir.',
  4: 'Dönem boyunca başarılı bir performans sergilemiştir.',
  3: 'Dönem boyunca orta düzeyde bir performans göstermiştir.',
  2: 'Dönem boyunca gelişime açık bir performans göstermiştir.',
  1: 'Dönem boyunca destek gerektiren bir süreç geçirmiştir.',
}

function clamp15(val: number): number {
  return Math.max(1, Math.min(5, val))
}

export function computeKanaat(input: KanaatInput): 1 | 2 | 3 | 4 | 5 {
  const { homeworkTotal, homeworkDone, absenceDays, examAverage } = input

  type Source = { score: number; weight: number }
  const sources: Source[] = []

  // Ödev bileşeni (ağırlık 0.4)
  if (homeworkTotal > 0) {
    const ratio = homeworkDone / homeworkTotal
    sources.push({ score: clamp15(ratio * 4 + 1), weight: 0.4 })
  }

  // Devamsızlık bileşeni (ağırlık 0.3)
  {
    const devScore = clamp15((Math.max(0, 20 - absenceDays) / 20) * 4 + 1)
    sources.push({ score: devScore, weight: 0.3 })
  }

  // Sınav bileşeni (ağırlık 0.3)
  if (examAverage !== null) {
    sources.push({ score: clamp15((examAverage / 100) * 4 + 1), weight: 0.3 })
  }

  // Ağırlıkları normalize et (toplam 1 olsun)
  const totalWeight = sources.reduce((s, x) => s + x.weight, 0)
  const weighted = sources.reduce((s, x) => s + (x.score * x.weight) / totalWeight, 0)

  return Math.round(weighted) as 1 | 2 | 3 | 4 | 5
}

export function generateKanaatText(
  studentName: string,
  score:       1 | 2 | 3 | 4 | 5,
  stats: {
    homeworkPct: number       // 0-100
    absenceDays: number
    examAverage: number | null
  },
): string {
  const { homeworkPct, absenceDays, examAverage } = stats
  const pct   = Math.round(homeworkPct)
  const genel = GENEL_DEGERLENDIRME[score]

  const odevSatir = `ödevlerini %${pct} oranında tamamlamıştır`
  const devSatir  = `${absenceDays} gün devamsızlık yapmıştır`
  const sinavSatir = examAverage !== null
    ? ` Sınav ortalaması ${Math.round(examAverage)} puandır.`
    : ''

  return `${studentName} bu dönem ${odevSatir}. ${devSatir}.${sinavSatir} ${genel}`
}
```

- [ ] **Step 5: Testlerin geçtiğini doğrula**

```bash
npx vitest run tests/vitest/unit/kanaat/computeKanaat.test.ts
```

Beklenen: Tüm testler PASS.

- [ ] **Step 6: TS derlemeyi doğrula**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/domains/kanaat/ tests/vitest/unit/kanaat/computeKanaat.test.ts
git commit -m "feat(kanaat): computeKanaat ve generateKanaatText saf fonksiyonları eklendi (TDD)"
```

---

## Task 4: KanaatRepository

**Files:**
- Create: `src/domains/kanaat/repositories/KanaatRepository.ts`

- [ ] **Step 1: Repository dosyasını oluştur**

`src/domains/kanaat/repositories/KanaatRepository.ts`:

```ts
import { createClient } from '@/src/infrastructure/supabase/server'
import type { KanaatNotu } from '../types'

export const KanaatRepository = {
  async findByClassAndDonem(classId: string, donem: string, schoolId: string) {
    const db = await createClient()
    return db
      .from('kanaat_notlari')
      .select('*')
      .eq('class_id', classId)
      .eq('donem', donem)
      .eq('school_id', schoolId)
      .order('created_at')
  },

  async upsertMany(
    kayitlar: Omit<KanaatNotu, 'id' | 'created_at' | 'updated_at'>[],
  ) {
    const db = await createClient()
    return db
      .from('kanaat_notlari')
      .upsert(
        kayitlar.map(k => ({ ...k, updated_at: new Date().toISOString() })),
        { onConflict: 'student_id,donem', ignoreDuplicates: false },
      )
  },

  async findAllByClass(classId: string, schoolId: string) {
    const db = await createClient()
    return db
      .from('kanaat_notlari')
      .select('*')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .order('donem', { ascending: false })
  },
}
```

- [ ] **Step 2: TS derlemeyi doğrula**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/domains/kanaat/repositories/KanaatRepository.ts
git commit -m "feat(kanaat): KanaatRepository eklendi"
```

---

## Task 5: KanaatService

**Files:**
- Create: `src/domains/kanaat/services/KanaatService.ts`
- Create: `tests/vitest/unit/kanaat/kanaat-service.test.ts`

- [ ] **Step 1: Önce service testlerini yaz**

`tests/vitest/unit/kanaat/kanaat-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS, MUDUR_PERMS } from '../../setup/factories'
import type { GrantedPermission } from '@/src/domains/rbac/types'

vi.mock('@/src/shared/authorization/server', () => ({
  getAbility: vi.fn(),
}))

vi.mock('@/src/domains/kanaat/repositories/KanaatRepository', () => ({
  KanaatRepository: {
    findByClassAndDonem: vi.fn(),
    upsertMany:          vi.fn(),
    findAllByClass:      vi.fn(),
  },
}))

// Supabase client mock — generateKanaat içindeki doğrudan sorgular için
vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn(),
}))

const { getAbility }         = await import('@/src/shared/authorization/server')
const { KanaatRepository }   = await import('@/src/domains/kanaat/repositories/KanaatRepository')
const { KanaatService }      = await import('@/src/domains/kanaat/services/KanaatService')

const SCHOOL_ID  = 'school-kanaat-unit'
const TEACHER_ID = 'teacher-kanaat-unit'
const CLASS_ID   = 'class-kanaat-unit'
const DONEM      = '2025-2026-1'

function makeAbility(perms: GrantedPermission[] = OGRETMEN_PERMS, userId = TEACHER_ID) {
  return createAbility({ userId, schoolId: SCHOOL_ID, permissions: perms })
}

beforeEach(() => { vi.clearAllMocks() })

// ── getKanaatKayitlari ────────────────────────────────────────
describe('KanaatService.getKanaatKayitlari()', () => {
  it('giriş yoksa → error', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const r = await KanaatService.getKanaatKayitlari(CLASS_ID, DONEM)
    expect(r.error).toBe('Giriş gerekli')
    expect(KanaatRepository.findByClassAndDonem).not.toHaveBeenCalled()
  })

  it('kanaat:read izni yoksa → error', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    const r = await KanaatService.getKanaatKayitlari(CLASS_ID, DONEM)
    expect(r.error).toBe('Bu işlem için yetkiniz yok.')
  })

  it('yetki varsa kayıtlar döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(KanaatRepository.findByClassAndDonem).mockResolvedValue({
      data: [], error: null,
    } as never)
    const r = await KanaatService.getKanaatKayitlari(CLASS_ID, DONEM)
    expect(r.error).toBeUndefined()
    expect(r.data).toEqual([])
    expect(KanaatRepository.findByClassAndDonem).toHaveBeenCalledWith(CLASS_ID, DONEM, SCHOOL_ID)
  })
})

// ── saveKanaatKayitlari ──────────────────────────────────────
describe('KanaatService.saveKanaatKayitlari()', () => {
  const kayitlar = [
    { studentId: 'stu-1', score: 4 as const, text: 'Ali iyi bir dönem geçirdi.' },
  ]

  it('giriş yoksa → error', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const r = await KanaatService.saveKanaatKayitlari(CLASS_ID, DONEM, kayitlar)
    expect(r.error).toBe('Giriş gerekli')
    expect(KanaatRepository.upsertMany).not.toHaveBeenCalled()
  })

  it('kanaat:create izni yoksa → error', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    const r = await KanaatService.saveKanaatKayitlari(CLASS_ID, DONEM, kayitlar)
    expect(r.error).toBe('Bu işlem için yetkiniz yok.')
    expect(KanaatRepository.upsertMany).not.toHaveBeenCalled()
  })

  it('yetki varsa kayıtlar upsert edilir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(KanaatRepository.upsertMany).mockResolvedValue({ error: null } as never)
    const r = await KanaatService.saveKanaatKayitlari(CLASS_ID, DONEM, kayitlar)
    expect(r.error).toBeUndefined()
    expect(KanaatRepository.upsertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          student_id: 'stu-1',
          class_id:   CLASS_ID,
          teacher_id: TEACHER_ID,
          school_id:  SCHOOL_ID,
          score:      4,
          text:       'Ali iyi bir dönem geçirdi.',
          donem:      DONEM,
        }),
      ])
    )
  })

  it('DB hatası varsa error döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(KanaatRepository.upsertMany).mockResolvedValue({
      error: { message: 'duplicate key' },
    } as never)
    const r = await KanaatService.saveKanaatKayitlari(CLASS_ID, DONEM, kayitlar)
    expect(r.error).toBeDefined()
  })
})
```

- [ ] **Step 2: Testlerin başarısız olduğunu doğrula**

```bash
npx vitest run tests/vitest/unit/kanaat/kanaat-service.test.ts
```

Beklenen: FAIL — modül bulunamadı.

- [ ] **Step 3: KanaatService implementasyonunu yaz**

`src/domains/kanaat/services/KanaatService.ts`:

```ts
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import { createClient } from '@/src/infrastructure/supabase/server'
import { KanaatRepository } from '../repositories/KanaatRepository'
import { computeKanaat, generateKanaatText } from '../lib/computeKanaat'
import type { KanaatNotu, KanaatHesap } from '../types'

interface KayitInput {
  studentId: string
  score:     1 | 2 | 3 | 4 | 5
  text:      string
}

export const KanaatService = {
  async getKanaatKayitlari(
    classId: string,
    donem:   string,
  ): Promise<{ data?: KanaatNotu[]; error?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.KANAAT.READ)) return { error: 'Bu işlem için yetkiniz yok.' }

    const { data, error } = await KanaatRepository.findByClassAndDonem(classId, donem, ability.schoolId)
    if (error) return { error: error.message }
    return { data: (data ?? []) as KanaatNotu[] }
  },

  async saveKanaatKayitlari(
    classId:  string,
    donem:    string,
    kayitlar: KayitInput[],
  ): Promise<{ error?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.KANAAT.CREATE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const rows = kayitlar.map(k => ({
      student_id: k.studentId,
      class_id:   classId,
      teacher_id: ability.userId,
      school_id:  ability.schoolId,
      score:      k.score,
      text:       k.text,
      donem,
    }))

    const { error } = await KanaatRepository.upsertMany(rows)
    if (error) return { error: error.message }
    return {}
  },

  async generateKanaatHesap(
    classId: string,
    donem:   string,
  ): Promise<{ data?: KanaatHesap[]; error?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.KANAAT.CREATE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const db = await createClient()

    // Öğrenciler
    const { data: students, error: stuErr } = await db
      .from('students')
      .select('id, full_name')
      .eq('class_id', classId)
      .eq('school_id', ability.schoolId)
      .is('deleted_at', null)

    if (stuErr) return { error: stuErr.message }
    if (!students?.length) return { data: [] }

    const studentIds = students.map(s => s.id)

    // Donem tarih aralığını hesapla
    const [egitimYili, yarim] = donem.split('-').slice(0, 3) as [string, string, string]
    const startYear = parseInt(egitimYili)
    const donemStart = yarim === '1'
      ? `${startYear}-09-01`
      : `${startYear + 1}-01-15`
    const donemEnd = yarim === '1'
      ? `${startYear + 1}-01-14`
      : `${startYear + 1}-06-30`

    // Ödevler + teslimler
    const { data: homeworks } = await db
      .from('homeworks')
      .select('id')
      .eq('class_id', classId)
      .eq('school_id', ability.schoolId)
      .is('deleted_at', null)
      .gte('due_date', donemStart)
      .lte('due_date', donemEnd)

    const hwIds = (homeworks ?? []).map(h => h.id)
    const { data: submissions } = hwIds.length
      ? await db
          .from('homework_submissions')
          .select('student_id, status')
          .in('homework_id', hwIds)
          .in('student_id', studentIds)
      : { data: [] }

    // Devamsızlık
    const { data: attendance } = await db
      .from('attendance')
      .select('student_id, status')
      .in('student_id', studentIds)
      .eq('school_id', ability.schoolId)
      .eq('status', 'absent')
      .gte('date', donemStart)
      .lte('date', donemEnd)

    // Sınav notları
    const { data: gradeColumns } = await db
      .from('grade_columns')
      .select('id')
      .eq('class_id', classId)
      .eq('school_id', ability.schoolId)
      .gte('exam_date', donemStart)
      .lte('exam_date', donemEnd)

    const colIds = (gradeColumns ?? []).map(c => c.id)
    const { data: gradeEntries } = colIds.length
      ? await db
          .from('grade_entries')
          .select('student_id, score, grade_column_id')
          .in('grade_column_id', colIds)
          .in('student_id', studentIds)
      : { data: [] }

    // Öğrenci başına aggregation
    const totalHw = hwIds.length
    const submissionMap = new Map<string, number>()
    const absenceMap    = new Map<string, number>()
    const examMap       = new Map<string, number[]>()

    for (const s of submissions ?? []) {
      if (s.status === 'yapildi' || s.status === 'gec') {
        submissionMap.set(s.student_id, (submissionMap.get(s.student_id) ?? 0) + 1)
      }
    }
    for (const a of attendance ?? []) {
      absenceMap.set(a.student_id, (absenceMap.get(a.student_id) ?? 0) + 1)
    }
    for (const e of gradeEntries ?? []) {
      if (e.score !== null) {
        const arr = examMap.get(e.student_id) ?? []
        arr.push(e.score)
        examMap.set(e.student_id, arr)
      }
    }

    const hesaplar: KanaatHesap[] = students.map(student => {
      const done     = submissionMap.get(student.id) ?? 0
      const absences = absenceMap.get(student.id)    ?? 0
      const scores   = examMap.get(student.id)

      const examAverage = scores?.length
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null

      const score = computeKanaat({
        homeworkTotal: totalHw,
        homeworkDone:  done,
        absenceDays:   absences,
        examAverage,
      })

      const homeworkPct = totalHw > 0 ? (done / totalHw) * 100 : 0

      const text = generateKanaatText(student.full_name, score, {
        homeworkPct,
        absenceDays: absences,
        examAverage,
      })

      return { studentId: student.id, studentName: student.full_name, score, text }
    })

    return { data: hesaplar }
  },
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

```bash
npx vitest run tests/vitest/unit/kanaat/kanaat-service.test.ts
```

Beklenen: Tüm testler PASS.

- [ ] **Step 5: Tüm testleri çalıştır**

```bash
npx vitest run
```

Beklenen: Tüm testler PASS.

- [ ] **Step 6: TS derlemeyi doğrula**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/domains/kanaat/services/KanaatService.ts tests/vitest/unit/kanaat/kanaat-service.test.ts
git commit -m "feat(kanaat): KanaatService eklendi (TDD) — getKanaatKayitlari, saveKanaatKayitlari, generateKanaatHesap"
```

---

## Task 6: Server Actions

**Files:**
- Create: `app/actions/kanaat.ts`

- [ ] **Step 1: Server action dosyasını oluştur**

`app/actions/kanaat.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod/v4'
import { KanaatService } from '@/src/domains/kanaat/services/KanaatService'

const DONEM_RE = /^\d{4}-\d{4}-(1|2)$/

const KayitSchema = z.object({
  studentId: z.string().uuid(),
  score:     z.coerce.number().int().min(1).max(5) as z.ZodType<1 | 2 | 3 | 4 | 5>,
  text:      z.string().min(1).max(2000),
})

export async function generateKanaatAction(classId: string, donem: string) {
  if (!z.string().uuid().safeParse(classId).success) return { error: 'Geçersiz sınıf ID' }
  if (!DONEM_RE.test(donem)) return { error: 'Geçersiz dönem formatı' }

  const result = await KanaatService.generateKanaatHesap(classId, donem)
  return result
}

export async function saveKanaatAction(params: {
  classId:  string
  donem:    string
  kayitlar: { studentId: string; score: 1 | 2 | 3 | 4 | 5; text: string }[]
}) {
  if (!z.string().uuid().safeParse(params.classId).success) return { error: 'Geçersiz sınıf ID' }
  if (!DONEM_RE.test(params.donem)) return { error: 'Geçersiz dönem formatı' }

  const parsed = z.array(KayitSchema).safeParse(params.kayitlar)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await KanaatService.saveKanaatKayitlari(params.classId, params.donem, parsed.data)
  if (result.error) return result

  revalidatePath(`/not-defteri/${params.classId}`)
  return {}
}

export async function getKanaatKayitlariAction(classId: string, donem: string) {
  if (!z.string().uuid().safeParse(classId).success) return { error: 'Geçersiz sınıf ID' }
  if (!DONEM_RE.test(donem)) return { error: 'Geçersiz dönem formatı' }

  return KanaatService.getKanaatKayitlari(classId, donem)
}
```

- [ ] **Step 2: TS derlemeyi doğrula**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/actions/kanaat.ts
git commit -m "feat(kanaat): server actions eklendi (generate, save, get)"
```

---

## Task 7: KanaatSekmesi Bileşeni

**Files:**
- Create: `app/(dashboard)/not-defteri/[classId]/KanaatSekmesi.tsx`

- [ ] **Step 1: KanaatSekmesi bileşenini oluştur**

`app/(dashboard)/not-defteri/[classId]/KanaatSekmesi.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import Button from '@/components/ui/Button'
import { generateKanaatAction, saveKanaatAction } from '@/app/actions/kanaat'
import type { KanaatNotu, KanaatHesap } from '@/src/domains/kanaat/types'

interface Student {
  id:        string
  full_name: string
}

interface Props {
  classId:        string
  donem:          string
  students:       Student[]
  kanaatKayitlari: KanaatNotu[]
  canWrite:       boolean
}

type Satir = {
  studentId:   string
  studentName: string
  score:       1 | 2 | 3 | 4 | 5
  text:        string
  dirty:       boolean
}

const SCORE_CLASS: Record<number, string> = {
  5: 'text-green-600 font-bold',
  4: 'text-blue-600 font-bold',
  3: 'text-yellow-600 font-bold',
  2: 'text-orange-600 font-bold',
  1: 'text-red-600 font-bold',
}

function kayitlarToSatirlar(kayitlar: KanaatNotu[], students: Student[]): Satir[] {
  return students.map(stu => {
    const k = kayitlar.find(x => x.student_id === stu.id)
    return k
      ? { studentId: stu.id, studentName: stu.full_name, score: k.score as 1|2|3|4|5, text: k.text, dirty: false }
      : { studentId: stu.id, studentName: stu.full_name, score: 3 as const, text: '', dirty: false }
  })
}

export default function KanaatSekmesi({ classId, donem, students, kanaatKayitlari, canWrite }: Props) {
  const [satirlar, setSatirlar] = useState<Satir[]>(() =>
    kayitlarToSatirlar(kanaatKayitlari, students)
  )
  const [error, setError]   = useState<string | null>(null)
  const [toast, setToast]   = useState<string | null>(null)
  const [generated, setGenerated] = useState(kanaatKayitlari.length > 0)
  const [isPending, startTransition] = useTransition()

  const hasDirty = satirlar.some(s => s.dirty)

  function handleGenerate() {
    if (generated && !confirm('Mevcut hesaplama üzerine yeniden oluşturulsun mu?')) return
    setError(null)
    startTransition(async () => {
      const result = await generateKanaatAction(classId, donem)
      if (result.error) { setError(result.error); return }
      const hesaplar = result.data as KanaatHesap[]
      setSatirlar(
        students.map(stu => {
          const h = hesaplar.find(x => x.studentId === stu.id)
          return h
            ? { studentId: stu.id, studentName: stu.full_name, score: h.score, text: h.text, dirty: true }
            : { studentId: stu.id, studentName: stu.full_name, score: 3 as const, text: '', dirty: false }
        })
      )
      setGenerated(true)
    })
  }

  function handleTextChange(studentId: string, text: string) {
    setSatirlar(prev => prev.map(s =>
      s.studentId === studentId ? { ...s, text, dirty: true } : s
    ))
  }

  function handleScoreChange(studentId: string, score: number) {
    setSatirlar(prev => prev.map(s =>
      s.studentId === studentId ? { ...s, score: score as 1|2|3|4|5, dirty: true } : s
    ))
  }

  function handleSave() {
    setError(null)
    const dirtySatirlar = satirlar.filter(s => s.dirty && s.text.trim())
    if (!dirtySatirlar.length) return

    startTransition(async () => {
      const result = await saveKanaatAction({
        classId,
        donem,
        kayitlar: dirtySatirlar.map(s => ({
          studentId: s.studentId,
          score:     s.score,
          text:      s.text.trim(),
        })),
      })
      if (result.error) { setError(result.error); return }
      setSatirlar(prev => prev.map(s => ({ ...s, dirty: false })))
      setToast(`${dirtySatirlar.length} kayıt kaydedildi.`)
      setTimeout(() => setToast(null), 3000)
    })
  }

  if (students.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Bu sınıfa öğrenci eklenmemiş.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-4 font-bold">×</button>
        </div>
      )}
      {toast && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Kanaat Notları — {donem}</h2>
        {canWrite && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleGenerate}
              disabled={isPending}
            >
              {isPending ? 'Hesaplanıyor…' : generated ? 'Yeniden Oluştur' : 'Dönem Değerlendirmesi Oluştur'}
            </Button>
            {hasDirty && (
              <Button
                size="sm"
                variant="primary"
                onClick={handleSave}
                disabled={isPending}
              >
                Tümünü Kaydet
              </Button>
            )}
          </div>
        )}
      </div>

      {!generated ? (
        <div className="py-12 text-center text-muted-foreground border rounded-lg">
          Dönem değerlendirmesi henüz oluşturulmadı.
          {canWrite && (
            <p className="mt-2 text-sm">Yukarıdaki butona basarak otomatik hesaplatabilirsiniz.</p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 text-sm font-medium text-muted-foreground border-b">
                <th className="text-left px-4 py-3 min-w-[160px]">Öğrenci</th>
                <th className="text-center px-4 py-3 w-20">Skor</th>
                <th className="text-left px-4 py-3">Metin</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map(satir => (
                <tr key={satir.studentId} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-sm">{satir.studentName}</td>
                  <td className="px-4 py-3 text-center">
                    {canWrite ? (
                      <select
                        value={satir.score}
                        onChange={e => handleScoreChange(satir.studentId, Number(e.target.value))}
                        className={`rounded border px-2 py-1 text-sm bg-background ${SCORE_CLASS[satir.score] ?? ''}`}
                      >
                        {[1, 2, 3, 4, 5].map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={SCORE_CLASS[satir.score] ?? ''}>{satir.score}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canWrite ? (
                      <textarea
                        value={satir.text}
                        onChange={e => handleTextChange(satir.studentId, e.target.value)}
                        rows={2}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        placeholder="Kanaat metni…"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">{satir.text || '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TS derlemeyi doğrula**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/not-defteri/[classId]/KanaatSekmesi.tsx"
git commit -m "feat(kanaat): KanaatSekmesi client bileşeni eklendi"
```

---

## Task 8: NotDefteriTabs Wrapper + page.tsx Entegrasyonu

**Files:**
- Create: `app/(dashboard)/not-defteri/[classId]/NotDefteriTabs.tsx`
- Modify: `app/(dashboard)/not-defteri/[classId]/page.tsx`

- [ ] **Step 1: NotDefteriTabs bileşenini oluştur**

`app/(dashboard)/not-defteri/[classId]/NotDefteriTabs.tsx`:

```tsx
'use client'

import { useState } from 'react'
import GradeGrid from './GradeGrid'
import KanaatSekmesi from './KanaatSekmesi'
import type { GradeColumn, GradeEntry } from '@/src/domains/grades/types'
import type { KanaatNotu } from '@/src/domains/kanaat/types'

interface Student {
  id:             string
  full_name:      string
  student_number: string | null
}

interface Props {
  classId:         string
  columns:         GradeColumn[]
  entries:         GradeEntry[]
  students:        Student[]
  kanaatKayitlari: KanaatNotu[]
  currentDonem:    string
  canWrite:        boolean
}

type Tab = 'notlar' | 'kanaat'

export default function NotDefteriTabs({
  classId, columns, entries, students,
  kanaatKayitlari, currentDonem, canWrite,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('notlar')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'notlar',  label: 'Not Girişi' },
    { id: 'kanaat',  label: 'Kanaat' },
  ]

  return (
    <div>
      <div className="flex border-b mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'notlar' && (
        <GradeGrid
          classId={classId}
          columns={columns}
          entries={entries}
          students={students}
          canWrite={canWrite}
        />
      )}

      {activeTab === 'kanaat' && (
        <KanaatSekmesi
          classId={classId}
          donem={currentDonem}
          students={students}
          kanaatKayitlari={kanaatKayitlari}
          canWrite={canWrite}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: `page.tsx`'i güncelle**

`app/(dashboard)/not-defteri/[classId]/page.tsx` dosyasını aşağıdaki şekilde güncelle:

Import bloğuna ekle:
```ts
import NotDefteriTabs from './NotDefteriTabs'
import { KanaatService } from '@/src/domains/kanaat/services/KanaatService'
```

`getCurrentProfile` çağrısından sonra, `const isManager` satırından önce şunu ekle:

```ts
// Mevcut dönemi hesapla (Eylül-Ocak = 1. yarı, Şubat-Haziran = 2. yarı)
const now = new Date(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date()))
const ay = now.getMonth() + 1  // 1-12
const yil = now.getFullYear()
const egitimYil1 = ay >= 9 ? yil : yil - 1
const yarim = ay >= 9 || ay <= 1 ? '1' : '2'
const currentDonem = `${egitimYil1}-${egitimYil1 + 1}-${yarim}`
```

`const [classResult, studentsResult, columnsResult]` Promise.all'ına dördüncü sorguyu ekle:

```ts
const [classResult, studentsResult, columnsResult, kanaatResult] = await Promise.all([
  supabase
    .from('classes')
    .select('id, name, grade, mentor_teacher_id')
    .eq('id', classId)
    .eq('school_id', schoolId)
    .single(),
  supabase
    .from('students')
    .select('id, full_name, student_number')
    .eq('class_id', classId)
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .order('student_number', { nullsFirst: false })
    .order('full_name'),
  supabase
    .from('grade_columns')
    .select('*')
    .eq('class_id', classId)
    .eq('school_id', schoolId)
    .order('exam_date', { nullsFirst: false })
    .order('created_at'),
  KanaatService.getKanaatKayitlari(classId, currentDonem),
])
```

`const canWrite` satırından sonra ekle:

```ts
const kanaatKayitlari = kanaatResult.data ?? []
```

Return bloğundaki `<GradeGrid ... />` yerine `<NotDefteriTabs ... />` kullan:

```tsx
<NotDefteriTabs
  classId={classId}
  columns={columns}
  entries={entries}
  students={students}
  kanaatKayitlari={kanaatKayitlari}
  currentDonem={currentDonem}
  canWrite={canWrite}
/>
```

- [ ] **Step 3: Kullanılmayan `GradeGrid` import'unu page.tsx'ten kaldır**

`page.tsx` artık `GradeGrid`'i doğrudan import etmiyor — `NotDefteriTabs` içinden geliyor. Dosyadan `import GradeGrid from './GradeGrid'` satırını kaldır.

- [ ] **Step 4: TS derlemeyi doğrula**

```bash
npx tsc --noEmit
```

Beklenen: Hata yok.

- [ ] **Step 5: Tüm testleri çalıştır**

```bash
npx vitest run
```

Beklenen: Tüm testler PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/not-defteri/[classId]/NotDefteriTabs.tsx" "app/(dashboard)/not-defteri/[classId]/page.tsx"
git commit -m "feat(kanaat): not defterine Kanaat sekmesi entegre edildi

NotDefteriTabs wrapper sekme state yönetiyor; page.tsx mevcut dönem kanaat
kayıtlarını server-side fetch ediyor."
```

---

## Self-Review

| Spec Gereksinimi | Task |
|---|---|
| kanaat_notlari tablosu + RLS | ✅ Task 1 |
| RBAC 'kanaat' resource | ✅ Task 2 |
| computeKanaat() saf fonksiyon (3 kaynak, ağırlıklar) | ✅ Task 3 |
| generateKanaatText() şablon | ✅ Task 3 |
| KanaatRepository — DB operasyonları | ✅ Task 4 |
| KanaatService — yetki + hesaplama + kaydetme | ✅ Task 5 |
| Server actions (generate, save, get) | ✅ Task 6 |
| KanaatSekmesi UI — oluştur/düzenle/kaydet | ✅ Task 7 |
| Not defterinde sekme entegrasyonu | ✅ Task 8 |
| Edge case: ödev yoksa devre dışı | ✅ computeKanaat (homeworkTotal === 0) |
| Edge case: sınav yoksa devre dışı | ✅ computeKanaat (examAverage === null) |
| Edge case: zaten kayıtlı → üzerine yaz uyarısı | ✅ KanaatSekmesi handleGenerate confirm |
| Edge case: boş sınıf | ✅ KanaatSekmesi students.length === 0 |
| Dönem seçici | ⚠️ Şu an currentDonem otomatik hesaplanıyor (mevcut yarıyıl); kullanıcı önceki döneme bakamaz. Basit geliştirme: KanaatSekmesi'ne prop olarak donem değiştirme eklenir — sonraki iterasyon için bırakıldı. |
