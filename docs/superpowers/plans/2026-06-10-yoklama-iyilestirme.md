# Yoklama İyileştirme — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yoklamaya `excused` (özürlü) durumu, karma sorumluluk modeli (Inngest hatırlatıcı + sınıf gruplaması), aylık çizelge sayfası ve Excel özet raporu eklemek.

**Architecture:** Mevcut domain kalıbı (`repositories → services → actions`) izlenir; `src/domains/attendance/` yeni domain olarak açılır. "Yoklama alındı" durumu türetilmiştir: sınıf+tarih için `attendance` satırı varlığı = alındı (ayrı flag yok). Sayım/grid mantığı pure function'lardadır (`attendanceMath`).

**Tech Stack:** Next.js 16 App Router, Supabase (RLS), Inngest cron, web-push (`sendPushToUser`), ExcelJS (`XlsxBuilder`), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-10-yoklama-iyilestirme-design.md`

## Dosya Haritası

| Dosya | Sorumluluk |
|---|---|
| `src/domains/attendance/types.ts` (yeni) | `AttendanceStatus` (excused dahil), `AbsenceCount` |
| `src/domains/attendance/lib/attendanceMath.ts` (yeni) | Pure: sayım, rozet formatı, okul günleri, ay grid'i |
| `src/domains/attendance/repositories/AttendanceRepository.ts` (yeni) | Raw Supabase sorguları |
| `src/domains/attendance/services/AttendanceService.ts` (yeni) | RBAC + sınıf erişim kontrolü + orkestrasyon |
| `app/actions/yoklama.ts` | Thin action — service'e delege + 2 yeni action |
| `app/(dashboard)/yoklama/page.tsx` | Sınıf gruplaması, `?sinif=`, AbsenceCount rozeti |
| `app/(dashboard)/yoklama/YoklamaClient.tsx` | 4'lü toggle, özürlü sayacı |
| `app/(dashboard)/yoklama/cizelge/page.tsx` (yeni) | Aylık çizelge server component |
| `app/(dashboard)/yoklama/cizelge/CizelgeClient.tsx` (yeni) | Grid + öğrenci paneli + Excel butonu |
| `components/student/StudentAttendanceHistory.tsx` (yeni) | Paylaşılan döküm bileşeni (çizelge paneli + profil modal sekmesi) |
| `src/domains/notifications/functions/yoklamaHatirlatici.ts` (yeni) | Cron 10:00 TR — eksik sınıf bildirimi |
| `src/domains/notifications/functions/veliAbsenceNotifier.ts` | `excused` → e-posta yok |
| `app/(dashboard)/yonetim/BugunYoklamaWidget.tsx` | Kim aldı + link + limit listesi |
| `src/domains/export/services/XlsxBuilder.ts` | `excused` + Özet ikinci sayfa |
| `app/(dashboard)/odevler/[id]/StudentHomeworkProfileModal.tsx` | "Devamsızlık" sekmesi |

---

### Task 1: `attendance` domain tipleri + `attendanceMath` pure fonksiyonları (TDD)

**Files:**
- Create: `src/domains/attendance/types.ts`
- Create: `src/domains/attendance/lib/attendanceMath.ts`
- Test: `tests/vitest/unit/attendance/attendanceMath.test.ts`

- [ ] **Step 1: Tip dosyasını yaz**

```ts
// src/domains/attendance/types.ts
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused']

export interface AbsenceCount {
  unexcused: number   // absent×1 + late×0.5 (hafta sonu hariç)
  excused:   number   // excused×1
}

export interface AttendanceRow {
  student_id: string
  status:     string
  date:       string  // YYYY-MM-DD
}
```

- [ ] **Step 2: Başarısız testleri yaz**

```ts
// tests/vitest/unit/attendance/attendanceMath.test.ts
import { describe, it, expect } from 'vitest'
import {
  countAbsences, formatAbsenceBadge, schoolDaysOfMonth, buildMonthGrid,
} from '@/src/domains/attendance/lib/attendanceMath'

const S1 = 'student-1', S2 = 'student-2'

describe('countAbsences()', () => {
  it('absent 1 gün, late 0.5 gün sayar', () => {
    const rows = [
      { student_id: S1, status: 'absent', date: '2026-06-08' }, // Pazartesi
      { student_id: S1, status: 'late',   date: '2026-06-09' }, // Salı
    ]
    expect(countAbsences(rows)[S1]).toEqual({ unexcused: 1.5, excused: 0 })
  })

  it('excused ayrı sayaçta toplanır, unexcused etkilenmez', () => {
    const rows = [
      { student_id: S1, status: 'excused', date: '2026-06-08' },
      { student_id: S1, status: 'excused', date: '2026-06-09' },
      { student_id: S1, status: 'absent',  date: '2026-06-10' },
    ]
    expect(countAbsences(rows)[S1]).toEqual({ unexcused: 1, excused: 2 })
  })

  it('hafta sonu satırlarını yok sayar', () => {
    const rows = [
      { student_id: S1, status: 'absent', date: '2026-06-06' }, // Cumartesi
      { student_id: S1, status: 'absent', date: '2026-06-07' }, // Pazar
    ]
    expect(countAbsences(rows)[S1]).toBeUndefined()
  })

  it('present satırlarını saymaz', () => {
    const rows = [{ student_id: S1, status: 'present', date: '2026-06-08' }]
    expect(countAbsences(rows)[S1]).toBeUndefined()
  })

  it('öğrencileri ayrı toplar', () => {
    const rows = [
      { student_id: S1, status: 'absent',  date: '2026-06-08' },
      { student_id: S2, status: 'excused', date: '2026-06-08' },
    ]
    const c = countAbsences(rows)
    expect(c[S1]).toEqual({ unexcused: 1, excused: 0 })
    expect(c[S2]).toEqual({ unexcused: 0, excused: 1 })
  })
})

describe('formatAbsenceBadge()', () => {
  it('yalnız özürsüz → "4g"', () =>
    expect(formatAbsenceBadge({ unexcused: 4, excused: 0 })).toBe('4g'))
  it('buçuklu özürsüz → "3.5g"', () =>
    expect(formatAbsenceBadge({ unexcused: 3.5, excused: 0 })).toBe('3.5g'))
  it('ikisi birden → "4g + 2ö"', () =>
    expect(formatAbsenceBadge({ unexcused: 4, excused: 2 })).toBe('4g + 2ö'))
  it('yalnız özürlü → "2ö"', () =>
    expect(formatAbsenceBadge({ unexcused: 0, excused: 2 })).toBe('2ö'))
  it('ikisi sıfır → boş string', () =>
    expect(formatAbsenceBadge({ unexcused: 0, excused: 0 })).toBe(''))
})

describe('schoolDaysOfMonth()', () => {
  it('Haziran 2026: 22 okul günü, hafta sonu yok', () => {
    const days = schoolDaysOfMonth(2026, 6)
    expect(days).toHaveLength(22)
    expect(days[0]).toBe('2026-06-01')        // Pazartesi
    expect(days).not.toContain('2026-06-06')  // Cumartesi
    expect(days).not.toContain('2026-06-07')  // Pazar
    expect(days[days.length - 1]).toBe('2026-06-30')
  })

  it('Şubat 2026 artık olmayan yıl: son gün 27 (Cumartesi 28 hariç)', () => {
    const days = schoolDaysOfMonth(2026, 2)
    expect(days[days.length - 1]).toBe('2026-02-27')
  })
})

describe('buildMonthGrid()', () => {
  it('öğrenci → tarih → status haritası kurar', () => {
    const rows = [
      { student_id: S1, status: 'absent',  date: '2026-06-08' },
      { student_id: S1, status: 'excused', date: '2026-06-09' },
      { student_id: S2, status: 'present', date: '2026-06-08' },
    ]
    const grid = buildMonthGrid(rows)
    expect(grid[S1]['2026-06-08']).toBe('absent')
    expect(grid[S1]['2026-06-09']).toBe('excused')
    expect(grid[S2]['2026-06-08']).toBe('present')
    expect(grid[S1]['2026-06-10']).toBeUndefined()
  })
})
```

- [ ] **Step 3: Testlerin FAIL ettiğini doğrula**

Run: `npx vitest run tests/vitest/unit/attendance/attendanceMath.test.ts`
Expected: FAIL — "Cannot find module .../attendanceMath"

- [ ] **Step 4: Implementasyonu yaz**

```ts
// src/domains/attendance/lib/attendanceMath.ts
import type { AbsenceCount, AttendanceRow, AttendanceStatus } from '../types'

/** YYYY-MM-DD bir hafta sonu mu? (yerel saat, TZ'den bağımsız parse) */
export function isWeekendISO(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay()
  return day === 0 || day === 6
}

/**
 * Devamsızlık sayımı: absent=1, late=0.5 (özürsüz); excused=1 (özürlü).
 * Hafta sonu ve present satırları sayılmaz. Hiç devamsızlığı olmayan
 * öğrenci sonuçta yer almaz.
 */
export function countAbsences(rows: AttendanceRow[]): Record<string, AbsenceCount> {
  const out: Record<string, AbsenceCount> = {}
  for (const r of rows) {
    if (isWeekendISO(r.date)) continue
    if (r.status !== 'absent' && r.status !== 'late' && r.status !== 'excused') continue
    const c = (out[r.student_id] ??= { unexcused: 0, excused: 0 })
    if (r.status === 'excused') c.excused += 1
    else c.unexcused += r.status === 'absent' ? 1 : 0.5
  }
  return out
}

/** Rozet metni: "4g", "3.5g", "4g + 2ö", "2ö" veya '' */
export function formatAbsenceBadge(c: AbsenceCount): string {
  const g = c.unexcused === 0 ? '' : `${c.unexcused % 1 === 0 ? c.unexcused : c.unexcused.toFixed(1)}g`
  const o = c.excused === 0 ? '' : `${c.excused}ö`
  if (g && o) return `${g} + ${o}`
  return g || o
}

/** Ayın Pzt–Cum günleri, ISO (YYYY-MM-DD) listesi. month: 1-12 */
export function schoolDaysOfMonth(year: number, month: number): string[] {
  const days: string[] = []
  const last = new Date(year, month, 0).getDate()
  for (let d = 1; d <= last; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow === 0 || dow === 6) continue
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return days
}

/** Çizelge grid'i: öğrenci → tarih → status */
export function buildMonthGrid(rows: AttendanceRow[]): Record<string, Record<string, AttendanceStatus>> {
  const grid: Record<string, Record<string, AttendanceStatus>> = {}
  for (const r of rows) {
    ;(grid[r.student_id] ??= {})[r.date] = r.status as AttendanceStatus
  }
  return grid
}
```

- [ ] **Step 5: Testlerin PASS ettiğini doğrula**

Run: `npx vitest run tests/vitest/unit/attendance/attendanceMath.test.ts`
Expected: PASS (14 test)

- [ ] **Step 6: Commit**

```bash
git add src/domains/attendance tests/vitest/unit/attendance
git commit -m "feat(attendance): domain tipleri ve attendanceMath pure fonksiyonlari"
```

---

### Task 2: DB migration — `excused` status constraint

**Files:** yok (Supabase migration — MCP `apply_migration` ile)

- [ ] **Step 1: Mevcut CHECK constraint'i öğren**

Supabase MCP `execute_sql` (proje: `agijvfrcudpzsofgfogu`):

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'attendance'::regclass AND contype = 'c';
```

Expected: status için bir CHECK constraint adı (örn. `attendance_status_check`) ya da boş sonuç.

- [ ] **Step 2: Migration uygula**

Supabase MCP `apply_migration`, name: `add_excused_attendance_status`. Step 1'de bulunan constraint adını kullan (yoksa DROP satırı zararsızdır):

```sql
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'absent', 'late', 'excused'));
```

- [ ] **Step 3: Doğrula**

`execute_sql`:

```sql
INSERT INTO attendance (class_id, student_id, teacher_id, school_id, date, status)
SELECT class_id, student_id, teacher_id, school_id, '1999-01-04', 'excused'
FROM attendance LIMIT 1
RETURNING id;
-- dönen id ile:
DELETE FROM attendance WHERE date = '1999-01-04';
```

Expected: INSERT başarılı (constraint kabul ediyor), ardından temizlik DELETE'i.
`attendance` tablosu boşsa bu adımı atla — constraint tanımını `pg_get_constraintdef` ile görmek yeterli.

- [ ] **Step 4: Commit (migration notu)**

Migration dosyası repo'da tutulmuyorsa bu adımda commit yok; `database.types.ts` değişmez (status zaten `string`).

---

### Task 3: `excused` — action tipi + veli bildirimi davranışı (TDD)

**Files:**
- Modify: `app/actions/yoklama.ts:10` (tip tanımı)
- Modify: `src/domains/notifications/functions/veliAbsenceNotifier.ts:39`
- Test: `tests/vitest/unit/yoklama/yoklama-action.test.ts`

- [ ] **Step 1: Başarısız testi yaz** — `yoklama-action.test.ts` dosyasının sonuna ekle:

```ts
describe('saveYoklama() — excused', () => {
  it('yalnız excused/present girişlerde Inngest eventi GÖNDERMEZ', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const { inngest } = await import('@/src/infrastructure/inngest')
    await saveYoklama(CLASS_ID, '2026-06-08', [
      { studentId: 's1', status: 'excused' },
      { studentId: 's2', status: 'present' },
    ])
    expect(inngest.send).not.toHaveBeenCalled()
  })

  it('excused + absent karışık girişte yalnız absent için event gönderir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const { inngest } = await import('@/src/infrastructure/inngest')
    await saveYoklama(CLASS_ID, '2026-06-08', [
      { studentId: 's1', status: 'excused' },
      { studentId: 's2', status: 'absent' },
    ])
    expect(inngest.send).toHaveBeenCalledTimes(1)
    const events = vi.mocked(inngest.send).mock.calls[0][0] as { data: { studentId: string } }[]
    expect(events).toHaveLength(1)
    expect(events[0].data.studentId).toBe('s2')
  })
})
```

- [ ] **Step 2: Testin FAIL ettiğini doğrula**

Run: `npx vitest run tests/vitest/unit/yoklama/yoklama-action.test.ts`
Expected: FAIL — TS hatası: `'excused'` `AttendanceStatus` tipinde değil.

- [ ] **Step 3: Tipi genişlet** — `app/actions/yoklama.ts`:

```ts
// ESKİ (satır 10):
export type AttendanceStatus = 'present' | 'absent' | 'late'
// YENİ:
export type { AttendanceStatus } from '@/src/domains/attendance/types'
```

Not: `'use server'` dosyasından `export type` re-export'u güvenlidir (derlemede silinir).
`saveYoklama` içindeki `absentIds` filtresi (`absent`/`late`) DEĞİŞMEZ — `excused` event üretmez, istenen davranış budur.

- [ ] **Step 4: Testlerin PASS ettiğini doğrula**

Run: `npx vitest run tests/vitest/unit/yoklama/yoklama-action.test.ts`
Expected: PASS (mevcut + 2 yeni test)

- [ ] **Step 5: veliAbsenceNotifier'ı güncelle** — `veliAbsenceNotifier.ts` satır 39'daki present kontrolünü değiştir:

```ts
// ESKİ:
if (record.status === 'present')       return { skipped: 'geldi' }
// YENİ — 45 dk penceresinde excused'a çevrilirse e-posta iptal olur:
if (record.status === 'excused')       return { skipped: 'ozurlu' }
if (record.status !== 'absent' && record.status !== 'late') return { skipped: 'geldi' }
```

- [ ] **Step 6: Tüm unit testleri çalıştır + commit**

Run: `npm run test:unit` — Expected: tümü PASS, 0 TS hatası (`npx tsc --noEmit`).

```bash
git add app/actions/yoklama.ts src/domains/notifications/functions/veliAbsenceNotifier.ts tests/vitest/unit/yoklama
git commit -m "feat(attendance): excused durumu — veli e-postasi gitmez, event uretilmez"
```

---

### Task 4: Yoklama UI — 4'lü toggle + özürlü rozeti

**Files:**
- Modify: `app/(dashboard)/yoklama/YoklamaClient.tsx`
- Modify: `app/(dashboard)/yoklama/page.tsx`

- [ ] **Step 1: `YoklamaClient.tsx` durum sabitlerini genişlet** (satır 16-25):

```ts
const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Mevcut',
  absent:  'Devamsız',
  late:    'Geç',
  excused: 'Özürlü',
}
const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 ring-green-500',
  absent:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 ring-red-500',
  late:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 ring-yellow-500',
  excused: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-blue-500',
}
```

- [ ] **Step 2: Toggle döngüsünü 4'le** (satır 87-94, `toggle` fonksiyonu):

```ts
function toggle(studentId: string) {
  isDirty.current = true
  setStatuses(prev => {
    const cur = prev[studentId] ?? 'present'
    const next: AttendanceStatus =
      cur === 'present' ? 'absent'
      : cur === 'absent' ? 'late'
      : cur === 'late'   ? 'excused'
      :                    'present'
    return { ...prev, [studentId]: next }
  })
}
```

Alt bilgi metnini de güncelle (satır 248-250): `Mevcut → Devamsız → Geç → Özürlü → Mevcut`

- [ ] **Step 3: Araç çubuğuna özürlü sayacı ekle** — devamsız/geç pillerinin yanına (satır 160-169 bloğuna):

```tsx
{Object.values(statuses).filter(s => s === 'excused').length > 0 && (
  <span className="text-blue-600 dark:text-blue-400 font-semibold">
    · {Object.values(statuses).filter(s => s === 'excused').length} özürlü
  </span>
)}
```

- [ ] **Step 4: Rozeti `AbsenceCount`'a geçir** — `YoklamaClient.tsx` props tipi:

```ts
import type { AbsenceCount } from '@/src/domains/attendance/types'
import { formatAbsenceBadge } from '@/src/domains/attendance/lib/attendanceMath'

interface Props {
  classes: ClassWithStudents[]
  absenceCounts: Record<string, AbsenceCount>   // önceden Record<string, number>
  initialStatuses?: Record<string, AttendanceStatus>
  initialDate?: string
}
```

Satır 199-217'deki rozet IIFE'sini değiştir:

```tsx
{(() => {
  const c = absenceCounts[s.id]
  if (!c) return null
  const danger = c.unexcused >= ATTENDANCE_LIMIT_DAYS
  const warn   = c.unexcused >= ATTENDANCE_WARN_DAYS
  return (
    <Tooltip content={`Özürsüz: ${c.unexcused} gün · Özürlü: ${c.excused} gün (MEB sınırı ${ATTENDANCE_LIMIT_DAYS} gün)`}>
      <span
        className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
          danger ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
          : warn  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
          :         'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
        }`}
      >
        {formatAbsenceBadge(c)}
      </span>
    </Tooltip>
  )
})()}
```

- [ ] **Step 5: `page.tsx` sayımı `attendanceMath`'a taşı** — satır 33-60'taki sorgu + döngüyü değiştir:

```ts
import { countAbsences } from '@/src/domains/attendance/lib/attendanceMath'
import type { AbsenceCount } from '@/src/domains/attendance/types'
```

Sorguda statüleri genişlet (satır 41): `.in('status', ['absent', 'late', 'excused'])`

Satır 53-60'taki `absenceCounts` döngüsünü sil, yerine:

```ts
const absenceCounts: Record<string, AbsenceCount> = countAbsences(absencesRes.data ?? [])
```

- [ ] **Step 6: Doğrula + commit**

Run: `npx tsc --noEmit` — Expected: 0 hata.
Run: `npm run test:unit` — Expected: PASS.

```bash
git add "app/(dashboard)/yoklama"
git commit -m "feat(attendance): yoklama UI — 4'lu toggle ve ozurlu rozeti"
```

---

### Task 5: AttendanceRepository + AttendanceService — action refaktörü (TDD)

**Files:**
- Create: `src/domains/attendance/repositories/AttendanceRepository.ts`
- Create: `src/domains/attendance/services/AttendanceService.ts`
- Modify: `app/actions/yoklama.ts` (service'e delege)
- Modify: `src/domains/INDEX.md` (attendance satırı ekle)
- Test: mevcut `tests/vitest/unit/yoklama/yoklama-action.test.ts` (davranış birebir korunur — testler değişmeden geçmeli)

- [ ] **Step 1: Repository'yi yaz** — ExportRepository kalıbı, ama RLS client parametreyle gelir:

```ts
// src/domains/attendance/repositories/AttendanceRepository.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/src/infrastructure/supabase/database.types'

type Client = SupabaseClient<Database>

export const AttendanceRepository = {
  /** Sınıfın okula aitliğini doğrular; yoksa null */
  async findClass(db: Client, classId: string, schoolId: string) {
    const { data } = await db
      .from('classes')
      .select('id, mentor_teacher_id')
      .eq('id', classId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .single()
    return data
  },

  async findByClassDate(db: Client, classId: string, schoolId: string, date: string) {
    const { data, error } = await db
      .from('attendance')
      .select('student_id, status')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .eq('date', date)
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async upsertEntries(db: Client, rows: Database['public']['Tables']['attendance']['Insert'][]) {
    const { error } = await db
      .from('attendance')
      .upsert(rows, { onConflict: 'class_id,student_id,date' })
    if (error) throw new Error(error.message)
  },

  /** Çizelge: sınıfın tarih aralığındaki tüm satırları */
  async findClassRange(db: Client, classId: string, schoolId: string, from: string, to: string) {
    const { data, error } = await db
      .from('attendance')
      .select('student_id, status, date')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .gte('date', from)
      .lte('date', to)
      .limit(5000)
    if (error) throw new Error(error.message)
    return data ?? []
  },

  /** Döküm: öğrencinin present-dışı tüm kayıtları (okul yılı başından) */
  async findStudentHistory(db: Client, studentId: string, schoolId: string, from: string) {
    const { data, error } = await db
      .from('attendance')
      .select('date, status')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .gte('date', from)
      .neq('status', 'present')
      .order('date', { ascending: false })
      .limit(500)
    if (error) throw new Error(error.message)
    return data ?? []
  },

  /** Öğretmenin sınıf üyeliği (teacher_classes) */
  async isTeacherOfClass(db: Client, teacherId: string, classId: string) {
    const { data } = await db
      .from('teacher_classes')
      .select('class_id')
      .eq('teacher_id', teacherId)
      .eq('class_id', classId)
      .maybeSingle()
    return !!data
  },
}
```

- [ ] **Step 2: Service'i yaz** — mevcut action gövdeleri buraya taşınır (davranış birebir):

```ts
// src/domains/attendance/services/AttendanceService.ts
import { createClient } from '@/src/infrastructure/supabase/server'
import { inngest } from '@/src/infrastructure/inngest'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import { logger } from '@/src/infrastructure/observability/logger'
import { schoolYearStart } from '@/src/shared/utils'
import { AttendanceRepository } from '../repositories/AttendanceRepository'
import { schoolDaysOfMonth } from '../lib/attendanceMath'
import type { AttendanceStatus } from '../types'

export interface AttendanceEntry {
  studentId: string
  status:    AttendanceStatus
}

const YONETICI_ROLLER = ['mudur', 'mudur_yardimcisi']

async function requireAbility(perm: string) {
  const ability = await getAbility()
  if (!ability) throw new Error('Giriş gerekli')
  if (ability.cannot(perm)) throw new Error('Bu işlem için yetkiniz yok')
  return ability
}

export const AttendanceService = {
  async getYoklama(classId: string, date: string) {
    const ability = await requireAbility(P.ATTENDANCE.READ)
    const db = await createClient()
    const cls = await AttendanceRepository.findClass(db, classId, ability.schoolId)
    if (!cls) throw new Error('Sınıf bulunamadı')
    const rows = await AttendanceRepository.findByClassDate(db, classId, ability.schoolId, date)
    const map: Record<string, AttendanceStatus> = {}
    for (const r of rows) map[r.student_id] = r.status as AttendanceStatus
    return map
  },

  async saveYoklama(classId: string, date: string, entries: AttendanceEntry[]) {
    const ability = await requireAbility(P.ATTENDANCE.UPDATE)
    const db = await createClient()
    const cls = await AttendanceRepository.findClass(db, classId, ability.schoolId)
    if (!cls) throw new Error('Sınıf bulunamadı')

    await AttendanceRepository.upsertEntries(db, entries.map(e => ({
      class_id:   classId,
      student_id: e.studentId,
      teacher_id: ability.userId,
      school_id:  ability.schoolId,
      date,
      status:     e.status,
    })))

    // Yalnız absent/late veli bildirimi tetikler; excused bilinçli olarak hariç
    const absentIds = entries
      .filter(e => e.status === 'absent' || e.status === 'late')
      .map(e => e.studentId)

    if (absentIds.length > 0) {
      try {
        await inngest.send(
          absentIds.map(studentId => ({
            name: 'attendance/absent' as const,
            data: { studentId, classId, date, schoolId: ability.schoolId },
          }))
        )
      } catch (e) {
        logger.error({ classId, date, absentCount: absentIds.length, err: e instanceof Error ? e.message : String(e) }, 'saveYoklama: Inngest event gönderilemedi')
      }
    }
  },

  /** Çizelge erişimi: yönetici her sınıfı, öğretmen mentor/derse girdiği sınıfı görür */
  async assertClassAccess(db: Awaited<ReturnType<typeof createClient>>, ability: { userId: string; schoolId: string }, classId: string) {
    const cls = await AttendanceRepository.findClass(db, classId, ability.schoolId)
    if (!cls) throw new Error('Sınıf bulunamadı')
    const { data: me } = await db.from('profiles').select('role').eq('id', ability.userId).single()
    if (YONETICI_ROLLER.includes(me?.role ?? '')) return cls
    if (cls.mentor_teacher_id === ability.userId) return cls
    if (await AttendanceRepository.isTeacherOfClass(db, ability.userId, classId)) return cls
    throw new Error('Bu sınıfın çizelgesine erişim yetkiniz yok')
  },

  async getClassMonth(classId: string, year: number, month: number) {
    const ability = await requireAbility(P.ATTENDANCE.READ)
    const db = await createClient()
    await this.assertClassAccess(db, ability, classId)
    const days = schoolDaysOfMonth(year, month)
    if (days.length === 0) return { days, rows: [] }
    const rows = await AttendanceRepository.findClassRange(
      db, classId, ability.schoolId, days[0], days[days.length - 1]
    )
    return { days, rows }
  },

  async getStudentHistory(studentId: string) {
    const ability = await requireAbility(P.ATTENDANCE.READ)
    const db = await createClient()
    const { data: student } = await db
      .from('students')
      .select('id, class_id')
      .eq('id', studentId)
      .eq('school_id', ability.schoolId)
      .is('deleted_at', null)
      .single()
    if (!student) throw new Error('Öğrenci bulunamadı')
    if (student.class_id) await this.assertClassAccess(db, ability, student.class_id)
    return AttendanceRepository.findStudentHistory(db, studentId, ability.schoolId, schoolYearStart())
  },
}
```

Not: `schoolYearStart` `@/src/shared/utils`'ta mevcut (yoklama `page.tsx:6` zaten import ediyor).

- [ ] **Step 3: Action'ları thin'leştir** — `app/actions/yoklama.ts` gövdesi:

```ts
'use server'

import { UUID } from '@/src/shared/validation'
import { AttendanceService } from '@/src/domains/attendance/services/AttendanceService'
import type { AttendanceEntry } from '@/src/domains/attendance/services/AttendanceService'

export type { AttendanceStatus } from '@/src/domains/attendance/types'
export type { AttendanceEntry }

export async function getYoklama(classId: string, date: string) {
  UUID.parse(classId)
  return AttendanceService.getYoklama(classId, date)
}

export async function saveYoklama(classId: string, date: string, entries: AttendanceEntry[]) {
  UUID.parse(classId)
  return AttendanceService.saveYoklama(classId, date, entries)
}
```

- [ ] **Step 4: Mevcut testlerin hâlâ geçtiğini doğrula**

Run: `npx vitest run tests/vitest/unit/yoklama/yoklama-action.test.ts`
Expected: PASS — davranış birebir korunduğu için test değişikliği GEREKMEZ. Mock'lar `createClient`/`inngest`/`getAbility` modüllerini yamaladığından service üzerinden de çalışır. `profiles` sorgusu yalnız `assertClassAccess`'te (yeni yollar) olduğundan eski testlere dokunmaz.

- [ ] **Step 5: INDEX.md + commit**

`src/domains/INDEX.md`'e diğer domainlerle aynı formatta bir satır ekle: `attendance — yoklama alma, sayım (attendanceMath), çizelge sorguları`.

Run: `npm run test:unit` && `npx tsc --noEmit` — Expected: PASS, 0 hata.

```bash
git add src/domains/attendance src/domains/INDEX.md app/actions/yoklama.ts
git commit -m "refactor(attendance): repository/service katmani — actions thin'lestirildi"
```

---

### Task 6: `/yoklama` sınıf gruplaması + `?sinif=` parametresi

**Files:**
- Modify: `app/(dashboard)/yoklama/page.tsx`
- Modify: `app/(dashboard)/yoklama/YoklamaClient.tsx`

- [ ] **Step 1: `page.tsx` — searchParams + "benim sınıflarım"**

İmza değişikliği (Next 16, searchParams Promise'dir):

```ts
export default async function YoklamaPage({ searchParams }: { searchParams: Promise<{ sinif?: string }> }) {
  const { sinif } = await searchParams
```

`classes` sorgusuna `mentor_teacher_id` ekle (satır 16):

```ts
.select('id, name, grade, mentor_teacher_id, students(id, full_name, student_number, deleted_at)')
```

Sorguların yanına teacher_classes çekimi ekle ve `myClassIds` hesapla:

```ts
const { data: tcRows } = await supabase
  .from('teacher_classes')
  .select('class_id')
  .eq('teacher_id', profile.id)

const myClassIds = new Set<string>([
  ...classes.filter(c => c.mentor_teacher_id === profile.id).map(c => c.id),
  ...(tcRows ?? []).map(r => r.class_id),
])
```

Başlangıç sınıfı seçimi — `firstClassId` tanımını değiştir:

```ts
const validSinif   = sinif && classes.some(c => c.id === sinif) ? sinif : null
const firstMyClass = classes.find(c => myClassIds.has(c.id))?.id ?? null
const firstClassId = validSinif ?? firstMyClass ?? classes[0]?.id ?? ''
```

(`todayRes` sorgusu zaten `firstClassId` kullanıyor — otomatik düzelir.)

`YoklamaClient`'a yeni proplar: `myClassIds={[...myClassIds]}` ve `initialClassId={firstClassId}`.
`ClassWithStudents` interface'ine `mentor_teacher_id: string | null` ekle.

- [ ] **Step 2: `YoklamaClient.tsx` — optgroup + initialClassId**

```ts
interface Props {
  classes: ClassWithStudents[]
  absenceCounts: Record<string, AbsenceCount>
  initialStatuses?: Record<string, AttendanceStatus>
  initialDate?: string
  myClassIds?: string[]
  initialClassId?: string
}
```

State başlangıcı: `useState(initialClassId ?? classes[0]?.id ?? '')`.

Select'i (satır 131-133) optgroup'lu hale getir:

```tsx
{(() => {
  const mine = new Set(myClassIds ?? [])
  const my     = classes.filter(c => mine.has(c.id))
  const others = classes.filter(c => !mine.has(c.id))
  if (my.length === 0) return classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
  return (
    <>
      <optgroup label="Sınıflarım">
        {my.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </optgroup>
      {others.length > 0 && (
        <optgroup label="Diğer sınıflar">
          {others.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </optgroup>
      )}
    </>
  )
})()}
```

- [ ] **Step 3: Doğrula + commit**

Run: `npx tsc --noEmit` — Expected: 0 hata.
Manuel: `npm run dev` → `/yoklama?sinif=<id>` doğru sınıfı açmalı; optgroup'lar görünmeli.

```bash
git add "app/(dashboard)/yoklama"
git commit -m "feat(attendance): sinif gruplamasi (Siniflarim/Diger) + ?sinif= parametresi"
```

---

### Task 7: Inngest cron — `yoklamaHatirlatici` (10:00 TR)

**Files:**
- Create: `src/domains/notifications/functions/yoklamaHatirlatici.ts`
- Modify: `app/api/inngest/route.ts` (kayıt)

- [ ] **Step 1: Cron fonksiyonunu yaz**

```ts
// src/domains/notifications/functions/yoklamaHatirlatici.ts
import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { sendPushToUser } from '@/src/infrastructure/push/webpush'
import { logger } from '@/src/infrastructure/observability/logger'

const YONETICI_ROLLER = ['mudur', 'mudur_yardimcisi']

export const yoklamaHatirlaticiFn = inngest.createFunction(
  { id: 'yoklama-hatirlatici', triggers: [{ cron: 'TZ=Europe/Istanbul 0 10 * * 1-5' }] },
  async ({ step }) => {
    const todayISO = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())

    const missing = await step.run('eksik-siniflar', async () => {
      const db = createServiceClient()
      const [clsRes, attRes] = await Promise.all([
        db.from('classes')
          .select('id, name, school_id, mentor_teacher_id')
          .is('deleted_at', null),
        db.from('attendance')
          .select('class_id')
          .eq('date', todayISO),
      ])
      const taken = new Set((attRes.data ?? []).map(a => a.class_id))
      return (clsRes.data ?? []).filter(c => !taken.has(c.id))
    })

    if (missing.length === 0) return { sent: 0 }

    // Mentor öğretmenlere: sınıf başına bildirim + push
    await step.run('mentor-bildirimleri', async () => {
      const db = createServiceClient()
      const withMentor = missing.filter(c => c.mentor_teacher_id)
      if (withMentor.length === 0) return

      await db.from('notifications').insert(
        withMentor.map(c => ({
          user_id:   c.mentor_teacher_id!,
          school_id: c.school_id,
          title:     'Yoklama hatırlatması',
          body:      `${c.name} sınıfının bugünkü yoklaması henüz alınmadı.`,
        }))
      )

      const results = await Promise.allSettled(
        withMentor.map(c =>
          sendPushToUser(c.mentor_teacher_id!, {
            title: 'Yoklama hatırlatması',
            body:  `${c.name} yoklaması henüz alınmadı.`,
            url:   `/yoklama?sinif=${c.id}`,
          })
        )
      )
      const failed = results.filter(r => r.status === 'rejected').length
      if (failed) logger.error({ event: 'yoklama_hatirlatici_push_failed', failed }, 'Yoklama hatırlatma push hatası')
    })

    // İdareye: okul başına tek özet
    await step.run('idare-ozeti', async () => {
      const db = createServiceClient()
      const bySchool = new Map<string, string[]>()
      for (const c of missing) {
        bySchool.set(c.school_id, [...(bySchool.get(c.school_id) ?? []), c.name])
      }

      const { data: managers } = await db
        .from('profiles')
        .select('id, school_id')
        .in('role', YONETICI_ROLLER)
        .in('school_id', [...bySchool.keys()])

      if (!managers?.length) return
      await db.from('notifications').insert(
        managers.map(m => {
          const names = bySchool.get(m.school_id) ?? []
          return {
            user_id:   m.id,
            school_id: m.school_id,
            title:     'Eksik yoklamalar',
            body:      `${names.length} sınıfın yoklaması alınmadı: ${names.slice(0, 8).join(', ')}${names.length > 8 ? '…' : ''}`,
          }
        })
      )
    })

    return { sent: missing.length }
  }
)
```

Not: cron `TZ=Europe/Istanbul` öneki Inngest tarafından desteklenir; yaz/kış saatinden etkilenmez.

- [ ] **Step 2: Route'a kaydet** — `app/api/inngest/route.ts`:

```ts
import { yoklamaHatirlaticiFn } from '@/src/domains/notifications/functions/yoklamaHatirlatici'
// functions dizisine ekle:
functions: [exportXlsxFn, exportDeadLetterFn, homeworkReminderFn, veliAbsenceNotifierFn, aylikBultenFn, odevSonrasiVeliNotifierFn, homeworkCreatedNotifierFn, yoklamaHatirlaticiFn],
```

- [ ] **Step 3: Doğrula + commit**

Run: `npx tsc --noEmit` — Expected: 0 hata.
Run: `npm run dev` + `npx inngest-cli@latest dev` (varsa) → Inngest dev UI'da `yoklama-hatirlatici` fonksiyonunun listelendiğini ve manuel invoke ile çalıştığını gör. Inngest dev kurulu değilse: deploy sonrası Inngest dashboard'dan doğrula (manuel invoke).

```bash
git add src/domains/notifications/functions/yoklamaHatirlatici.ts app/api/inngest/route.ts
git commit -m "feat(attendance): yoklama-hatirlatici cron — 10:00 TR eksik sinif bildirimi"
```

---

### Task 8: `BugunYoklamaWidget` genişletme

**Files:**
- Modify: `app/(dashboard)/yonetim/BugunYoklamaWidget.tsx`

- [ ] **Step 1: Sorguları genişlet** — satır 25-36'daki Promise.all'ı değiştir:

```ts
import Link from 'next/link'
import { schoolYearStart } from '@/src/shared/utils'
import { countAbsences } from '@/src/domains/attendance/lib/attendanceMath'
import { ATTENDANCE_WARN_DAYS } from '@/src/shared/constants/attendance'

const [classesRes, attendanceRes, yearRes] = await Promise.all([
  supabase
    .from('classes')
    .select('id, name, grade')
    .eq('school_id', school_id)
    .is('deleted_at', null),
  supabase
    .from('attendance')
    .select('class_id, status, teacher_id, created_at')
    .eq('school_id', school_id)
    .eq('date', todayStr),
  supabase
    .from('attendance')
    .select('student_id, status, date, students(full_name, deleted_at)')
    .eq('school_id', school_id)
    .gte('date', schoolYearStart())
    .in('status', ['absent', 'late'])
    .limit(20000),
])
```

- [ ] **Step 2: Kim aldı haritası + limit listesi hesapla** (render öncesi):

```ts
// Sınıf → ilk kaydı giren öğretmen
const takerByClass = new Map<string, { teacherId: string; at: string }>()
for (const a of attendance) {
  if (!takerByClass.has(a.class_id)) {
    takerByClass.set(a.class_id, { teacherId: a.teacher_id, at: a.created_at })
  }
}
const teacherIds = [...new Set([...takerByClass.values()].map(t => t.teacherId))]
const { data: teacherProfiles } = teacherIds.length
  ? await supabase.from('profiles').select('id, full_name').in('id', teacherIds)
  : { data: [] }
const teacherName = new Map((teacherProfiles ?? []).map(p => [p.id, p.full_name]))

// Limit yaklaşan öğrenciler (özürsüz >= 15 gün)
type YearRow = { student_id: string; status: string; date: string; students: { full_name: string; deleted_at: string | null } | null }
const yearRows = ((yearRes.data ?? []) as YearRow[]).filter(r => r.students && !r.students.deleted_at)
const counts = countAbsences(yearRows)
const nameByStudent = new Map(yearRows.map(r => [r.student_id, r.students!.full_name]))
const atRisk = Object.entries(counts)
  .filter(([, c]) => c.unexcused >= ATTENDANCE_WARN_DAYS)
  .sort((a, b) => b[1].unexcused - a[1].unexcused)
  .slice(0, 8)
```

- [ ] **Step 3: Render güncelle**

Eksik sınıf chip'lerini (satır 75-82) linke çevir:

```tsx
{missingClasses.map(c => (
  <Link
    key={c.id}
    href={`/yoklama?sinif=${c.id}`}
    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-600 hover:text-blue-700 transition-colors"
  >
    {c.name}
    <span className={`text-[10px] px-1 py-0.5 rounded ${LEVEL_COLOR[getLevel(c.name, c.grade)]}`}>
      {getLevel(c.name, c.grade)}
    </span>
    <span aria-hidden>→</span>
  </Link>
))}
```

"Tüm sınıflarda yoklama girildi" bloğunun altına iki yeni bölüm ekle:

```tsx
{takerByClass.size > 0 && (
  <div className="mt-4">
    <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Alınan yoklamalar</p>
    <div className="flex flex-wrap gap-1.5">
      {classes.filter(c => takerByClass.has(c.id)).map(c => {
        const t = takerByClass.get(c.id)!
        const saat = new Date(t.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
        return (
          <span key={c.id} className="text-[11px] px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300">
            {c.name} · {teacherName.get(t.teacherId) ?? '—'} · {saat}
          </span>
        )
      })}
    </div>
  </div>
)}

{atRisk.length > 0 && (
  <div className="mt-4">
    <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Devamsızlık sınırına yaklaşanlar (özürsüz ≥ {ATTENDANCE_WARN_DAYS} gün)</p>
    <ul className="space-y-1">
      {atRisk.map(([id, c]) => (
        <li key={id} className="flex items-center justify-between text-xs">
          <span className="text-gray-700 dark:text-slate-300">{nameByStudent.get(id) ?? '—'}</span>
          <span className="font-semibold text-red-600 dark:text-red-400">{c.unexcused} gün</span>
        </li>
      ))}
    </ul>
  </div>
)}
```

- [ ] **Step 4: Doğrula + commit**

Run: `npx tsc --noEmit` — Expected: 0 hata.
Manuel: `/yonetim` sayfasında widget'ın üç bölümünün de doğru render olduğunu gör.

```bash
git add "app/(dashboard)/yonetim/BugunYoklamaWidget.tsx"
git commit -m "feat(attendance): yonetim widget — kim aldi, eksik sinif linki, limit listesi"
```

---

### Task 9: Çizelge action'ları (TDD)

**Files:**
- Modify: `app/actions/yoklama.ts` (2 yeni action)
- Test: `tests/vitest/unit/yoklama/cizelge-actions.test.ts` (yeni)

- [ ] **Step 1: Başarısız testleri yaz** — mock kurulumunu `yoklama-action.test.ts`'den kopyala (aynı `mockSupabase`/`getAbility` deseni; `maybeSingle` mock'u da ekle):

```ts
// tests/vitest/unit/yoklama/cizelge-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS } from '../../setup/factories'

vi.mock('@/src/shared/authorization/server', () => ({ getAbility: vi.fn() }))

const mockSingle      = vi.fn()
const mockMaybeSingle = vi.fn()
const mockLimit       = vi.fn()
const mockFromResult = {
  select: vi.fn().mockReturnThis(),
  eq:     vi.fn().mockReturnThis(),
  is:     vi.fn().mockReturnThis(),
  gte:    vi.fn().mockReturnThis(),
  lte:    vi.fn().mockReturnThis(),
  neq:    vi.fn().mockReturnThis(),
  order:  vi.fn().mockReturnThis(),
  in:     vi.fn().mockReturnThis(),
  single:      mockSingle,
  maybeSingle: mockMaybeSingle,
  limit:       mockLimit,
}
const mockSupabase = { from: vi.fn().mockReturnValue(mockFromResult) }
vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}))
vi.mock('@/src/infrastructure/inngest', () => ({
  inngest: { send: vi.fn().mockResolvedValue(undefined) },
}))

const { getAbility } = await import('@/src/shared/authorization/server')
const { getCizelge } = await import('@/app/actions/yoklama')

const CLASS_ID = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'

beforeEach(() => {
  vi.clearAllMocks()
  mockSupabase.from.mockReturnValue(mockFromResult)
})

describe('getCizelge()', () => {
  it('giriş yoksa hata fırlatır', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    await expect(getCizelge(CLASS_ID, 2026, 6)).rejects.toThrow('Giriş gerekli')
  })

  it('yönetici rolünde gün listesi + satırları döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(
      createAbility({ userId: 'u1', schoolId: 's1', permissions: OGRETMEN_PERMS }) as never
    )
    // 1. findClass → sınıf var; 2. profiles role → mudur; 3. findClassRange → satırlar
    mockSingle
      .mockResolvedValueOnce({ data: { id: CLASS_ID, mentor_teacher_id: null }, error: null })
      .mockResolvedValueOnce({ data: { role: 'mudur' }, error: null })
    mockLimit.mockResolvedValueOnce({
      data: [{ student_id: 'st1', status: 'absent', date: '2026-06-08' }],
      error: null,
    })
    const result = await getCizelge(CLASS_ID, 2026, 6)
    expect(result.days).toHaveLength(22)
    expect(result.rows).toEqual([{ student_id: 'st1', status: 'absent', date: '2026-06-08' }])
  })

  it('öğretmen kendi sınıfı değilse erişim hatası verir', async () => {
    vi.mocked(getAbility).mockResolvedValue(
      createAbility({ userId: 'u1', schoolId: 's1', permissions: OGRETMEN_PERMS }) as never
    )
    mockSingle
      .mockResolvedValueOnce({ data: { id: CLASS_ID, mentor_teacher_id: 'baskasi' }, error: null })
      .mockResolvedValueOnce({ data: { role: 'ogretmen' }, error: null })
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })  // teacher_classes üyesi değil
    await expect(getCizelge(CLASS_ID, 2026, 6)).rejects.toThrow('erişim yetkiniz yok')
  })
})
```

- [ ] **Step 2: FAIL doğrula**

Run: `npx vitest run tests/vitest/unit/yoklama/cizelge-actions.test.ts`
Expected: FAIL — `getCizelge` export edilmemiş.

- [ ] **Step 3: Action'ları ekle** — `app/actions/yoklama.ts` sonuna:

```ts
export async function getCizelge(classId: string, year: number, month: number) {
  UUID.parse(classId)
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new Error('Geçersiz yıl')
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Geçersiz ay')
  return AttendanceService.getClassMonth(classId, year, month)
}

export async function getStudentAttendanceHistory(studentId: string) {
  UUID.parse(studentId)
  return AttendanceService.getStudentHistory(studentId)
}
```

- [ ] **Step 4: PASS doğrula + commit**

Run: `npx vitest run tests/vitest/unit/yoklama/` — Expected: tümü PASS.

```bash
git add app/actions/yoklama.ts tests/vitest/unit/yoklama/cizelge-actions.test.ts
git commit -m "feat(attendance): getCizelge ve getStudentAttendanceHistory action'lari"
```

---

### Task 10: `/yoklama/cizelge` sayfası + paylaşılan döküm bileşeni

**Files:**
- Create: `app/(dashboard)/yoklama/cizelge/page.tsx`
- Create: `app/(dashboard)/yoklama/cizelge/CizelgeClient.tsx`
- Create: `app/(dashboard)/yoklama/cizelge/loading.tsx`
- Create: `components/student/StudentAttendanceHistory.tsx`
- Modify: `app/(dashboard)/yoklama/page.tsx` (çizelge sayfasına link)

- [ ] **Step 1: Paylaşılan döküm bileşeni**

```tsx
// components/student/StudentAttendanceHistory.tsx
'use client'

import { useEffect, useState } from 'react'
import { getStudentAttendanceHistory } from '@/app/actions/yoklama'
import { countAbsences, formatAbsenceBadge } from '@/src/domains/attendance/lib/attendanceMath'

const LABELS: Record<string, string> = { absent: 'Devamsız', late: 'Geç', excused: 'Özürlü' }
const COLORS: Record<string, string> = {
  absent:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  late:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  excused: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
}

function fmtTR(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export default function StudentAttendanceHistory({ studentId }: { studentId: string }) {
  const [rows, setRows] = useState<{ date: string; status: string }[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError('')
    getStudentAttendanceHistory(studentId)
      .then(data => { if (!cancelled) setRows(data) })
      .catch(e => {
        console.error('[StudentAttendanceHistory]', e)
        if (!cancelled) setError(e instanceof Error ? e.message : 'Yüklenemedi')
      })
    return () => { cancelled = true }
  }, [studentId])

  if (error)         return <p className="text-sm text-red-500 p-3">{error}</p>
  if (rows === null) return <p className="text-sm text-gray-400 p-3">Yükleniyor…</p>
  if (rows.length === 0) return <p className="text-sm text-gray-400 p-3">Bu öğrencinin devamsızlık kaydı yok. 🎉</p>

  const c = countAbsences(rows.map(r => ({ ...r, student_id: studentId })))[studentId]
    ?? { unexcused: 0, excused: 0 }

  return (
    <div className="space-y-2 p-1">
      <p className="text-xs text-gray-500 dark:text-slate-400">
        Yıl içi toplam: <strong>{formatAbsenceBadge(c) || '0'}</strong>
        <span className="ml-1">(özürsüz {c.unexcused} gün · özürlü {c.excused} gün)</span>
      </p>
      <ul className="divide-y divide-gray-100 dark:divide-slate-700 max-h-72 overflow-y-auto">
        {rows.map(r => (
          <li key={`${r.date}-${r.status}`} className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-gray-700 dark:text-slate-300 tabular-nums">{fmtTR(r.date)}</span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${COLORS[r.status] ?? ''}`}>
              {LABELS[r.status] ?? r.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Server page**

```tsx
// app/(dashboard)/yoklama/cizelge/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import CizelgeClient from './CizelgeClient'

export default async function CizelgePage() {
  const [supabase, profile] = await Promise.all([createClient(), getCurrentProfile()])
  if (!profile?.school_id) redirect('/anasayfa')

  const isYonetici = ['mudur', 'mudur_yardimcisi'].includes(profile.role ?? '')

  const { data: rawClasses } = await supabase
    .from('classes')
    .select('id, name, grade, mentor_teacher_id, students(id, full_name, student_number, deleted_at)')
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .order('grade')
    .order('name')

  let classes = (rawClasses ?? []).map(cls => ({
    id: cls.id,
    name: cls.name,
    students: ((cls.students ?? []) as { id: string; full_name: string; student_number: string | null; deleted_at: string | null }[])
      .filter(s => !s.deleted_at)
      .map(({ deleted_at: _omit, ...s }) => s),
    mentor_teacher_id: cls.mentor_teacher_id,
  }))

  if (!isYonetici) {
    const { data: tcRows } = await supabase
      .from('teacher_classes')
      .select('class_id')
      .eq('teacher_id', profile.id)
    const allowed = new Set([
      ...classes.filter(c => c.mentor_teacher_id === profile.id).map(c => c.id),
      ...(tcRows ?? []).map(r => r.class_id),
    ])
    classes = classes.filter(c => allowed.has(c.id))
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yoklama Çizelgesi</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Aylık devamsızlık çizelgesi — D: Devamsız · G: Geç · Ö: Özürlü
        </p>
      </div>
      {classes.length === 0 ? (
        <p className="text-sm text-gray-400">Görüntüleyebileceğiniz sınıf yok. Sınıf öğretmeni atamanız veya ders programınız bulunmuyor.</p>
      ) : (
        <CizelgeClient classes={classes} />
      )}
    </div>
  )
}
```

`loading.tsx`: mevcut `app/(dashboard)/yoklama/loading.tsx` skeleton'unu kopyala (başlık metnini "Yoklama Çizelgesi" yap).

- [ ] **Step 3: CizelgeClient**

```tsx
// app/(dashboard)/yoklama/cizelge/CizelgeClient.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { getCizelge } from '@/app/actions/yoklama'
import { buildMonthGrid, countAbsences } from '@/src/domains/attendance/lib/attendanceMath'
import type { AttendanceStatus } from '@/src/domains/attendance/types'
import StudentAttendanceHistory from '@/components/student/StudentAttendanceHistory'
import YoklamaExcelButton from './YoklamaExcelButton'

interface Student { id: string; full_name: string; student_number: string | null }
interface ClassItem { id: string; name: string; students: Student[] }

const CELL: Record<string, { ch: string; cls: string }> = {
  present: { ch: '·', cls: 'text-gray-300 dark:text-slate-600' },
  absent:  { ch: 'D', cls: 'text-red-600 dark:text-red-400 font-bold' },
  late:    { ch: 'G', cls: 'text-yellow-600 dark:text-yellow-400 font-bold' },
  excused: { ch: 'Ö', cls: 'text-blue-600 dark:text-blue-400 font-bold' },
}

export default function CizelgeClient({ classes }: { classes: ClassItem[] }) {
  const now = new Date()
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [days, setDays] = useState<string[]>([])
  const [grid, setGrid] = useState<Record<string, Record<string, AttendanceStatus>>>({})
  const [counts, setCounts] = useState<ReturnType<typeof countAbsences>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openStudent, setOpenStudent] = useState<Student | null>(null)

  const [year, month] = ym.split('-').map(Number)
  const cls = classes.find(c => c.id === classId)

  const load = useCallback(async () => {
    if (!classId) return
    setLoading(true)
    setError('')
    try {
      const { days, rows } = await getCizelge(classId, year, month)
      setDays(days)
      setGrid(buildMonthGrid(rows))
      setCounts(countAbsences(rows))
    } catch (e) {
      console.error('[CizelgeClient] load:', e)
      setError(e instanceof Error ? e.message : 'Çizelge yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [classId, year, month])

  useEffect(() => { load() }, [load])

  const inputCls = 'px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Sınıf</label>
          <select value={classId} onChange={e => setClassId(e.target.value)} className={inputCls}>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Ay</label>
          <input type="month" value={ym} onChange={e => e.target.value && setYm(e.target.value)} className={inputCls} />
        </div>
        <div className="ml-auto">
          {cls && days.length > 0 && (
            <YoklamaExcelButton classId={classId} className={cls.name} since={days[0]} until={days[days.length - 1]} />
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-x-auto">
        {loading ? (
          <p className="p-6 text-center text-sm text-gray-400">Yükleniyor…</p>
        ) : !cls || cls.students.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">Bu sınıfta öğrenci yok.</p>
        ) : (
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700">
                <th className="sticky left-0 bg-white dark:bg-slate-800 text-left px-3 py-2 font-medium text-gray-500 dark:text-slate-400 min-w-[160px]">Öğrenci</th>
                {days.map(d => (
                  <th key={d} className="px-1 py-2 font-medium text-gray-400 dark:text-slate-500 tabular-nums">{Number(d.slice(8, 10))}</th>
                ))}
                <th className="px-2 py-2 font-medium text-gray-500 dark:text-slate-400 whitespace-nowrap">Özürsüz | Özürlü</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {cls.students.map(s => {
                const c = counts[s.id] ?? { unexcused: 0, excused: 0 }
                return (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/40 cursor-pointer" onClick={() => setOpenStudent(s)}>
                    <td className="sticky left-0 bg-white dark:bg-slate-800 px-3 py-1.5 text-gray-800 dark:text-slate-200 whitespace-nowrap">
                      {s.full_name}{s.student_number ? <span className="text-gray-400 ml-1">#{s.student_number}</span> : null}
                    </td>
                    {days.map(d => {
                      const st = grid[s.id]?.[d]
                      const cell = st ? CELL[st] : undefined
                      return (
                        <td key={d} className={`text-center px-1 py-1.5 ${cell?.cls ?? 'text-gray-200 dark:text-slate-700'}`}>
                          {cell?.ch ?? ''}
                        </td>
                      )
                    })}
                    <td className="text-center px-2 py-1.5 tabular-nums">
                      <span className={c.unexcused > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-400'}>{c.unexcused}</span>
                      <span className="text-gray-300 dark:text-slate-600 mx-1">|</span>
                      <span className={c.excused > 0 ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-400'}>{c.excused}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {openStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
             onClick={e => { if (e.target === e.currentTarget) setOpenStudent(null) }}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
              <h2 className="font-semibold text-gray-900 dark:text-slate-100">{openStudent.full_name} — Devamsızlık</h2>
              <button onClick={() => setOpenStudent(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-xl leading-none px-2">×</button>
            </div>
            <div className="overflow-y-auto px-4 py-2">
              <StudentAttendanceHistory studentId={openStudent.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: `/yoklama` başlığına çizelge linki ekle** — `page.tsx` başlık div'ine (h1 + açıklamanın sağına):

```tsx
import Link from 'next/link'
// başlık bloğunu flex yap:
<div className="mb-5 flex items-start justify-between gap-3">
  <div>
    <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yoklama</h1>
    <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{getEgitimYili()} — Devamsız öğrencilerin velisine otomatik e-posta gider</p>
  </div>
  <Link href="/yoklama/cizelge" className="shrink-0 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
    Çizelge →
  </Link>
</div>
```

- [ ] **Step 5: Doğrula + commit**

Not: `YoklamaExcelButton` Task 11'de yazılacak — bu task'in sonunda derleme hatası almamak için Task 11 Step 3'teki bileşeni şimdi oluştur (sıra değişikliği kabul) ya da iki task'i tek PR adımında birleştir.

Run: `npx tsc --noEmit` && `npm run dev` → `/yoklama/cizelge`: grid, panel, sınıf kısıtı (öğretmen hesabıyla yalnız kendi sınıfları).

```bash
git add "app/(dashboard)/yoklama" components/student
git commit -m "feat(attendance): /yoklama/cizelge — aylik grid + ogrenci dokumu"
```

---

### Task 11: Excel — `excused` + Özet sayfası (TDD)

**Files:**
- Modify: `src/domains/export/services/XlsxBuilder.ts`
- Create: `app/(dashboard)/yoklama/cizelge/YoklamaExcelButton.tsx`
- Test: `tests/vitest/unit/export/xlsx-yoklama-ozet.test.ts` (yeni)

- [ ] **Step 1: Başarısız test — `yoklamaOzetRows` pure fonksiyonu**

```ts
// tests/vitest/unit/export/xlsx-yoklama-ozet.test.ts
import { describe, it, expect } from 'vitest'
import { yoklamaOzetRows } from '@/src/domains/export/services/XlsxBuilder'

describe('yoklamaOzetRows()', () => {
  const detail = [
    { 'Sınıf': '9-A', 'No': '12', 'Ad Soyad': 'Ali Kaya',  'Tarih': '08.06.2026', 'Durum': 'Gelmedi' },
    { 'Sınıf': '9-A', 'No': '12', 'Ad Soyad': 'Ali Kaya',  'Tarih': '09.06.2026', 'Durum': 'Geç Geldi' },
    { 'Sınıf': '9-A', 'No': '12', 'Ad Soyad': 'Ali Kaya',  'Tarih': '10.06.2026', 'Durum': 'Özürlü' },
    { 'Sınıf': '9-A', 'No': '7',  'Ad Soyad': 'Ece Demir', 'Tarih': '08.06.2026', 'Durum': 'Gelmedi' },
  ]

  it('öğrenci başına tek özet satırı üretir', () => {
    const rows = yoklamaOzetRows(detail)
    expect(rows).toHaveLength(2)
  })

  it('durumları sayar ve özürsüz günü hesaplar (geç=0.5)', () => {
    const ali = yoklamaOzetRows(detail).find(r => r['Ad Soyad'] === 'Ali Kaya')!
    expect(ali['Gelmedi']).toBe(1)
    expect(ali['Geç']).toBe(1)
    expect(ali['Özürlü']).toBe(1)
    expect(ali['Özürsüz Gün']).toBe(1.5)
  })

  it('boş girişte boş döner', () => {
    expect(yoklamaOzetRows([])).toEqual([])
  })
})
```

Run: `npx vitest run tests/vitest/unit/export/xlsx-yoklama-ozet.test.ts` — Expected: FAIL (export yok).

- [ ] **Step 2: XlsxBuilder değişiklikleri**

a) `fetchYoklama` (satır 252-289): statülere `excused` ekle:

```ts
.in('status', ['absent', 'late', 'excused'])   // present kayıtları rapora dahil edilmez
// ...
const STATUS_LABELS: Record<string, string> = { absent: 'Gelmedi', late: 'Geç Geldi', excused: 'Özürlü' }
```

b) Özet pure fonksiyonu (dosyanın data fetchers bölümüne):

```ts
/** excel_yoklama detay satırlarından öğrenci başına özet üretir (pure). */
export function yoklamaOzetRows(detail: Record<string, unknown>[]): Record<string, unknown>[] {
  const map = new Map<string, { sinif: unknown; no: unknown; ad: unknown; gelmedi: number; gec: number; ozurlu: number }>()
  for (const r of detail) {
    const key = `${r['Sınıf']}|${r['No']}|${r['Ad Soyad']}`
    const e = map.get(key) ?? { sinif: r['Sınıf'], no: r['No'], ad: r['Ad Soyad'], gelmedi: 0, gec: 0, ozurlu: 0 }
    if      (r['Durum'] === 'Gelmedi')   e.gelmedi++
    else if (r['Durum'] === 'Geç Geldi') e.gec++
    else if (r['Durum'] === 'Özürlü')    e.ozurlu++
    map.set(key, e)
  }
  return [...map.values()].map(e => ({
    'Sınıf': e.sinif, 'No': e.no, 'Ad Soyad': e.ad,
    'Gelmedi': e.gelmedi, 'Geç': e.gec, 'Özürlü': e.ozurlu,
    'Özürsüz Gün': e.gelmedi + e.gec * 0.5,
  }))
}
```

c) `buildXlsx` refaktörü — sayfa kurulumunu `addSheet` helper'ına çıkar, `excel_yoklama` için ikinci sayfayı otomatik ekle (her iki call-site — `/api/export` route'u ve `exportXlsxFn` — değişiklik gerektirmez):

```ts
function addSheet(workbook: ExcelJS.Workbook, title: string, rows: Record<string, unknown>[]) {
  const sheet = workbook.addWorksheet(title)
  if (rows.length === 0) {
    sheet.addRow(['Bilgi'])
    sheet.addRow(['Veri bulunamadı'])
    return
  }
  const headers = Object.keys(rows[0])
  sheet.addRow(headers)
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } }
  for (const row of rows) sheet.addRow(headers.map(h => row[h]))
  sheet.columns.forEach((col, i) => {
    const header = headers[i] ?? ''
    const maxDataLen = rows.slice(0, 50).reduce((max, row) => Math.max(max, String(row[header] ?? '').length), 0)
    col.width = Math.min(50, Math.max(12, header.length, maxDataLen) + 2)
  })
}

export async function buildXlsx(rows: Record<string, unknown>[], jobType: JobType): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  addSheet(workbook, JOB_LABELS[jobType], rows)
  if (jobType === 'excel_yoklama' && rows.length > 0) {
    addSheet(workbook, 'Özet', yoklamaOzetRows(rows))
  }
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
```

- [ ] **Step 3: Excel butonu** — `SinifExportButton` deseninin kopyası:

```tsx
// app/(dashboard)/yoklama/cizelge/YoklamaExcelButton.tsx
'use client'

import { useState } from 'react'

interface Props { classId: string; className: string; since: string; until: string }

export default function YoklamaExcelButton({ classId, className, since, until }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType: 'excel_yoklama', params: { classId, since, until } }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Dışa aktarılamadı')
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'yoklama.xlsx'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('[YoklamaExcelButton]', e)
      setError('Sunucuya bağlanılamadı')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleExport}
        disabled={loading}
        title={`${className} yoklama çizelgesini Excel olarak indir`}
        className="flex items-center gap-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 min-h-[44px]"
      >
        {loading ? 'İndiriliyor…' : 'Excel İndir'}
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: PASS doğrula + commit**

Run: `npx vitest run tests/vitest/unit/export/` — Expected: mevcut 34 XlsxBuilder testi + 3 yeni test PASS (refaktör tek-sayfa çıktıyı değiştirmez).
Manuel: çizelge sayfasından Excel indir → 2 sayfa (Yoklama + Özet), Özürlü kolonu dolu.

```bash
git add src/domains/export tests/vitest/unit/export "app/(dashboard)/yoklama/cizelge/YoklamaExcelButton.tsx"
git commit -m "feat(export): excel_yoklama — ozurlu durumu ve Ozet sayfasi"
```

---

### Task 12: Profil modalına "Devamsızlık" sekmesi

**Files:**
- Modify: `app/(dashboard)/odevler/[id]/StudentHomeworkProfileModal.tsx`

- [ ] **Step 1: Tab state + başlık** — bileşene state ekle (satır 44 civarı):

```ts
const [tab, setTab] = useState<'odev' | 'devamsizlik'>('odev')
```

`studentId` değişince sıfırla — mevcut ilk `useEffect` içine `setTab('odev')` ekle.

Başlık bölümünün (satır 78-80'deki border-b div'i) hemen altına sekme çubuğu ekle:

```tsx
<div className="flex gap-1 px-5 pt-2 border-b border-gray-100 dark:border-slate-700">
  {([['odev', 'Ödev Profili'], ['devamsizlik', 'Devamsızlık']] as const).map(([key, label]) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      className={`text-xs font-medium px-3 py-2 rounded-t-lg transition-colors ${
        tab === key
          ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
          : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  ))}
</div>
```

- [ ] **Step 2: İçerik dallandırma** — mevcut gövde içeriğini (ödev istatistikleri bölümü) `{tab === 'odev' && (...)}` ile sar; yanına:

```tsx
import StudentAttendanceHistory from '@/components/student/StudentAttendanceHistory'

{tab === 'devamsizlik' && studentId && (
  <div className="px-4 py-2 overflow-y-auto">
    <StudentAttendanceHistory studentId={studentId} />
  </div>
)}
```

- [ ] **Step 3: Doğrula + commit**

Run: `npx tsc --noEmit` — Expected: 0 hata.
Manuel: ödev detayında öğrenci modalını aç → iki sekme; Devamsızlık sekmesi döküm + toplam gösterir.

```bash
git add "app/(dashboard)/odevler/[id]/StudentHomeworkProfileModal.tsx"
git commit -m "feat(attendance): ogrenci profil modalina Devamsizlik sekmesi"
```

---

### Task 13: E2E testler + final doğrulama

**Files:**
- Create: `tests/playwright/cizelge.spec.ts`
- Reference: mevcut `tests/playwright/` spec'leri (auth state kalıbı)

- [ ] **Step 1: Mevcut kalıbı incele**

`tests/playwright/classes.spec.ts` (veya `auth-flow.spec.ts`) dosyasını oku — `storageState` / fixture kullanımını, `ogretmen` ve `mudur` auth state dosya yollarını AYNEN kopyala. Aşağıdaki spec gövdesini bu kalıba otur.

- [ ] **Step 2: Spec'i yaz** (auth kalıbını projedekiyle eşleştirerek):

```ts
// tests/playwright/cizelge.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Yoklama Çizelgesi', () => {
  // NOT: storageState satırını projedeki mevcut spec'lerle birebir aynı yap
  test.use({ storageState: 'tests/playwright/.auth/ogretmen.json' })

  test('çizelge sayfası grid başlıklarını gösterir', async ({ page }) => {
    await page.goto('/yoklama/cizelge')
    await expect(page.getByRole('heading', { name: 'Yoklama Çizelgesi' })).toBeVisible()
    // Sınıfı varsa tablo, yoksa boş durum mesajı — ikisinden biri görünmeli
    await expect(
      page.locator('table').or(page.getByText('Görüntüleyebileceğiniz sınıf yok'))
    ).toBeVisible()
  })

  test('yoklama sayfasında 4 durumlu toggle çalışır', async ({ page }) => {
    await page.goto('/yoklama')
    const firstToggle = page.locator('ul button').first()
    await expect(firstToggle).toBeVisible()
    // Mevcut → Devamsız → Geç → Özürlü
    await firstToggle.click()
    await firstToggle.click()
    await firstToggle.click()
    await expect(firstToggle).toHaveText('Özürlü')
    await firstToggle.click()
    await expect(firstToggle).toHaveText('Mevcut')
  })

  test('yoklama sayfasından çizelgeye geçiş linki çalışır', async ({ page }) => {
    await page.goto('/yoklama')
    await page.getByRole('link', { name: /Çizelge/ }).click()
    await page.waitForURL(url => url.pathname === '/yoklama/cizelge')
    await expect(page.getByRole('heading', { name: 'Yoklama Çizelgesi' })).toBeVisible()
  })
})
```

- [ ] **Step 3: E2E çalıştır**

Run: `npx playwright test tests/playwright/cizelge.spec.ts`
Expected: 3 PASS. Ardından tüm suite: `npx playwright test` — Expected: regresyon yok (45+3 / 50).

- [ ] **Step 4: Final doğrulama + commit + push**

```bash
npm run test:unit        # tüm unit testler PASS
npx tsc --noEmit         # 0 hata
npm run build            # production build başarılı
```

```bash
git add tests/playwright/cizelge.spec.ts
git commit -m "test(e2e): yoklama cizelge ve 4'lu toggle senaryolari"
git push origin main
```

- [ ] **Step 5: Memory güncelle** — `~/.claude/.../memory/project_zumre_takip.md` sprint bölümünü "yoklama sprinti tamamlandı" olarak işaretle (uygulama oturumunun sonunda).

---

## Görev Sırası ve Bağımlılıklar

```
Task 1 (math) ──→ Task 3 (excused tip) ──→ Task 4 (UI)
Task 2 (migration) ──→ Task 3
Task 1,3 ──→ Task 5 (repo/service) ──→ Task 6 (gruplama), Task 9 (actions)
Task 5 ──→ Task 7 (cron), Task 8 (widget)
Task 9 ──→ Task 10 (çizelge UI) ←─ Task 11 (Excel butonu — Step not'una bak)
Task 10 ──→ Task 12 (modal sekme)
Hepsi ──→ Task 13 (E2E + final)
```

