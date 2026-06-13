# Veli Portalı Genişletme + Test Borcu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Veli portalına özet kart + ödev açıklaması + devamsızlık trend grafiği ekle; `notifications`/`attendance`/`auth`/`users` domain'lerinde ~120 yeni test yaz.

**Architecture:** Veli portalı değişiklikleri 3 yeni bileşen + 2 mevcut dosya değişikliği. Test değişiklikleri 4 yeni test dosyası + 2 mevcut test dosyası genişletme. Notifier Inngest fonksiyonlarında saf iş mantığı export edilecek, Inngest wrapper'ı test edilmeyecek.

**Tech Stack:** Next.js App Router, React 19, Tailwind v4, Recharts (mevcut), lucide-react, date-fns/tr locale, Vitest, vi.mock().

---

## Dosya Haritası

### Yeni dosyalar
- `app/veli/[token]/VeliOzetKart.tsx` — 3 metrikli özet kart (server component)
- `app/veli/[token]/HomeworkDescriptionToggle.tsx` — açıklama expand/collapse ('use client')
- `app/veli/[token]/VeliDevamsizlikChart.tsx` — Recharts BarChart ('use client')
- `tests/vitest/unit/notifications/notifications-actions.test.ts`
- `tests/vitest/unit/notifications/notifier-logic.test.ts`
- `tests/vitest/unit/attendance/attendance-service.test.ts`

### Değişen dosyalar
- `app/veli/[token]/page.tsx` — VeliOzetKart import + render
- `app/veli/[token]/VeliOdevlerSection.tsx` — HomeworkDescriptionToggle kullanımı
- `app/veli/[token]/VeliDevamsizlikSection.tsx` — VeliDevamsizlikChart kullanımı
- `src/domains/notifications/functions/veliAbsenceNotifier.ts` — shouldNotifyVeli() export
- `src/domains/notifications/functions/homeworkCreatedNotifier.ts` — filterEligibleVeliler() export
- `src/domains/notifications/functions/odevSonrasiVeliNotifier.ts` — filterMissingCandidates() + yesterdayInTurkey() export
- `src/domains/notifications/functions/yoklamaHatirlatici.ts` — findMissingClasses() export
- `tests/vitest/unit/auth/auth-service.test.ts` — signOut + updatePassword hata senaryoları
- `tests/vitest/unit/users/user-service.test.ts` — assignTeacherClass + removeTeacherClass + updateProfile

---

## Task 1: VeliOzetKart Bileşeni

**Files:**
- Create: `app/veli/[token]/VeliOzetKart.tsx`
- Modify: `app/veli/[token]/page.tsx`

- [ ] **Step 1: Bileşeni oluştur**

```tsx
// app/veli/[token]/VeliOzetKart.tsx
import type { SubmissionRow } from './VeliOdevlerSection'

type Props = {
  devamsizliklar: { status: 'absent' | 'late' }[]
  odevler: SubmissionRow[]
  today: string
}

export default function VeliOzetKart({ devamsizliklar, odevler, today }: Props) {
  const absentCount = devamsizliklar.filter(a => a.status === 'absent').length
  const toplam = odevler.length
  const tamamlanan = odevler.filter(s => s.status === 'yapildi').length
  const oran = toplam > 0 ? Math.round((tamamlanan / toplam) * 100) : 0
  const aktif = odevler.filter(s => (s.homeworks?.due_date ?? '') >= today).length

  const devRenk = absentCount <= 2
    ? 'bg-green-50 border-green-200 text-green-700'
    : absentCount <= 5
    ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
    : 'bg-red-50 border-red-200 text-red-700'

  const odevRenk = oran >= 80
    ? 'bg-green-50 border-green-200 text-green-700'
    : oran >= 50
    ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
    : 'bg-red-50 border-red-200 text-red-700'

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className={`rounded-2xl border p-3 text-center ${devRenk}`}>
        <p className="text-2xl font-bold">{absentCount}</p>
        <p className="text-[10px] font-medium mt-0.5">Devamsızlık</p>
      </div>
      <div className={`rounded-2xl border p-3 text-center ${odevRenk}`}>
        <p className="text-2xl font-bold">{oran}%</p>
        <p className="text-[10px] font-medium mt-0.5">Ödev Oranı</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-center text-gray-700">
        <p className="text-2xl font-bold">{aktif}</p>
        <p className="text-[10px] font-medium mt-0.5">Aktif Ödev</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: page.tsx'e ekle**

`app/veli/[token]/page.tsx` dosyasında:
- Dosyanın başına `import VeliOzetKart from './VeliOzetKart'` ekle
- `<VeliTracker token={token} />` satırından hemen sonra `<VeliOzetKart devamsizliklar={attendance} odevler={submissions} today={today} />` ekle

- [ ] **Step 3: Derle ve doğrula**

```
npx tsc --noEmit
```
Beklenen: 0 hata

- [ ] **Step 4: Commit**

```bash
git add app/veli/
git commit -m "feat(veli): özet kart — devamsızlık/ödev oranı/aktif ödev"
```

---

## Task 2: Ödev Açıklaması Toggle

**Files:**
- Create: `app/veli/[token]/HomeworkDescriptionToggle.tsx`
- Modify: `app/veli/[token]/VeliOdevlerSection.tsx`

- [ ] **Step 1: Toggle bileşenini oluştur**

```tsx
// app/veli/[token]/HomeworkDescriptionToggle.tsx
'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function HomeworkDescriptionToggle({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = description.length > 120
  const text = !isLong || expanded ? description : description.slice(0, 120) + '…'

  return (
    <div className="mt-1.5">
      <p className="text-xs text-gray-500 leading-relaxed">{text}</p>
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-0.5 text-xs text-blue-500 mt-0.5 hover:text-blue-700"
        >
          {expanded ? 'Daha az' : 'Devamını gör'}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: VeliOdevlerSection'da kullan**

`app/veli/[token]/VeliOdevlerSection.tsx` dosyasında:

1. Dosyanın başına ekle:
```tsx
import HomeworkDescriptionToggle from './HomeworkDescriptionToggle'
```

2. Upcoming ödevlerde, `<p className="text-xs text-gray-500 mt-0.5">` (subject/date satırı) ALTINA ekle:
```tsx
{hw?.description && (
  <HomeworkDescriptionToggle description={hw.description} />
)}
```

3. Past ödevlerde de aynısını, subject/date satırından sonra ekle.

- [ ] **Step 3: Derle**

```
npx tsc --noEmit
```
Beklenen: 0 hata

- [ ] **Step 4: Commit**

```bash
git add app/veli/
git commit -m "feat(veli): ödev açıklaması toggle (120 karakter sonrası gizle)"
```

---

## Task 3: Devamsızlık Trend Grafiği

**Files:**
- Create: `app/veli/[token]/VeliDevamsizlikChart.tsx`
- Modify: `app/veli/[token]/VeliDevamsizlikSection.tsx`

- [ ] **Step 1: groupAttendanceByMonth yardımcı fonksiyonu ve Chart bileşeni**

```tsx
// app/veli/[token]/VeliDevamsizlikChart.tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { parseISO, getMonth, getYear, format } from 'date-fns'
import { tr } from 'date-fns/locale'

type AttendanceRow = { date: string; status: 'absent' | 'late' }
type MonthData = { month: string; gelmedi: number; gecGeldi: number }

export function groupAttendanceByMonth(rows: AttendanceRow[]): MonthData[] {
  const map = new Map<string, MonthData>()
  for (const a of rows) {
    const d = parseISO(a.date)
    const key = `${getYear(d)}-${String(getMonth(d) + 1).padStart(2, '0')}`
    const label = format(d, 'MMM', { locale: tr })
    if (!map.has(key)) map.set(key, { month: label, gelmedi: 0, gecGeldi: 0 })
    const entry = map.get(key)!
    if (a.status === 'absent') entry.gelmedi++
    else if (a.status === 'late') entry.gecGeldi++
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-3)
    .map(([, v]) => v)
}

export default function VeliDevamsizlikChart({ attendance }: { attendance: AttendanceRow[] }) {
  const data = groupAttendanceByMonth(attendance)
  if (data.length === 0) return null

  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-gray-500 mb-2">Son 3 Ay</p>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 0, right: 4, left: -28, bottom: 0 }}>
          <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value: number, name: string) => [
              value,
              name === 'gelmedi' ? 'Gelmedi' : 'Geç Geldi',
            ]}
          />
          <Bar dataKey="gelmedi" stackId="a" fill="#ef4444" name="Gelmedi" />
          <Bar dataKey="gecGeldi" stackId="a" fill="#f97316" name="Geç Geldi" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: VeliDevamsizlikSection'da kullan**

`app/veli/[token]/VeliDevamsizlikSection.tsx` dosyasında:

1. Dosyanın başına ekle:
```tsx
import VeliDevamsizlikChart from './VeliDevamsizlikChart'
```

2. `<h2 className="text-sm font-semibold ...">Devamsızlık...` satırından hemen sonra (grid'den önce) ekle:
```tsx
<VeliDevamsizlikChart attendance={attendance} />
```

- [ ] **Step 3: Build ve tip kontrolü**

```
npx tsc --noEmit
```
Beklenen: 0 hata

- [ ] **Step 4: Commit**

```bash
git add app/veli/
git commit -m "feat(veli): devamsızlık trend grafiği — son 3 ay yığılmış bar"
```

---

## Task 4: Notifications Actions Testleri

**Files:**
- Create: `tests/vitest/unit/notifications/notifications-actions.test.ts`

**Not:** Notifications actions'ları Repository kullanmıyor, doğrudan `createClient()` çağırıyor. Mock pattern: thenable chain — her method `this` döner, zincirin son await'i `.then()` ile resolve olur.

- [ ] **Step 1: Test dosyasını oluştur**

```typescript
// tests/vitest/unit/notifications/notifications-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Thenable Supabase zinciri factory'si
function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is', 'order', 'limit', 'update', 'upsert', 'not', 'in', 'head']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

function makeSupabase(result: unknown = { data: null, error: null }) {
  const chain = makeChain(result)
  return { from: vi.fn().mockReturnValue(chain) }
}

vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/src/shared/auth', () => ({
  getCurrentUser: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { createClient } = await import('@/src/infrastructure/supabase/server')
const { getCurrentUser } = await import('@/src/shared/auth')
const {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markRead,
  getNotificationPreferences,
  saveNotificationPreferences,
} = await import('@/src/domains/notifications/actions/index')

const MOCK_USER = { id: 'user-1' }

beforeEach(() => vi.clearAllMocks())

// ──────────────────────────────────────────────
describe('getNotifications()', () => {
  it('kullanıcı yoksa boş dizi döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const result = await getNotifications()
    expect(result).toEqual([])
    expect(createClient).not.toHaveBeenCalled()
  })

  it('kullanıcı varsa supabase sorgusu çalışır ve data döner', async () => {
    const notifications = [{ id: 'n1', title: 'Test', body: null, homework_id: null, read_at: null, created_at: '2026-01-01' }]
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ data: notifications, error: null }) as never)
    const result = await getNotifications()
    expect(result).toEqual(notifications)
  })

  it('supabase null döndürürse boş dizi döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ data: null, error: null }) as never)
    const result = await getNotifications()
    expect(result).toEqual([])
  })
})

// ──────────────────────────────────────────────
describe('getUnreadCount()', () => {
  it('kullanıcı yoksa 0 döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    expect(await getUnreadCount()).toBe(0)
  })

  it('kullanıcı varsa count döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ count: 5, error: null }) as never)
    expect(await getUnreadCount()).toBe(5)
  })

  it('supabase null count dönerse 0 döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ count: null, error: null }) as never)
    expect(await getUnreadCount()).toBe(0)
  })
})

// ──────────────────────────────────────────────
describe('markAllRead()', () => {
  it('kullanıcı yoksa erken döner, supabase çağrılmaz', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    await markAllRead()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('kullanıcı varsa supabase update çalışır', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    const mockDb = makeSupabase({ data: null, error: null })
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    await markAllRead()
    expect(mockDb.from).toHaveBeenCalledWith('notifications')
  })
})

// ──────────────────────────────────────────────
describe('markRead()', () => {
  it('kullanıcı yoksa erken döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    await markRead('n1')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('kullanıcı varsa id ile update çalışır', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    const mockDb = makeSupabase({ data: null, error: null })
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    await markRead('n1')
    const chain = mockDb.from.mock.results[0].value
    expect(chain.eq).toHaveBeenCalledWith('id', 'n1')
  })
})

// ──────────────────────────────────────────────
describe('getNotificationPreferences()', () => {
  it('kullanıcı yoksa null döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    expect(await getNotificationPreferences()).toBeNull()
  })

  it('tercih varsa döner', async () => {
    const prefs = { days_before: 2, email_on: false }
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ data: prefs, error: null }) as never)
    expect(await getNotificationPreferences()).toEqual(prefs)
  })

  it('tercih yoksa (null) varsayılan döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    vi.mocked(createClient).mockResolvedValue(makeSupabase({ data: null, error: null }) as never)
    const result = await getNotificationPreferences()
    expect(result).toEqual({ days_before: 1, email_on: true })
  })
})

// ──────────────────────────────────────────────
describe('saveNotificationPreferences()', () => {
  function makeFormData(days: string, emailOn: string | null) {
    const fd = new FormData()
    fd.set('days_before', days)
    if (emailOn !== null) fd.set('email_on', emailOn)
    return fd
  }

  it('kullanıcı yoksa erken döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    await saveNotificationPreferences(makeFormData('2', 'on'))
    expect(createClient).not.toHaveBeenCalled()
  })

  it('days_before 1-7 arasına kısılır: 0 → 1', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    const mockDb = makeSupabase({ data: null, error: null })
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    await saveNotificationPreferences(makeFormData('0', 'on'))
    const chain = mockDb.from.mock.results[0].value
    const upsertArg = chain.upsert.mock.calls[0][0]
    expect(upsertArg.days_before).toBe(1)
  })

  it('days_before 8 → 7 kısılır', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    const mockDb = makeSupabase({ data: null, error: null })
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    await saveNotificationPreferences(makeFormData('8', null))
    const chain = mockDb.from.mock.results[0].value
    const upsertArg = chain.upsert.mock.calls[0][0]
    expect(upsertArg.days_before).toBe(7)
    expect(upsertArg.email_on).toBe(false)
  })

  it('email_on "on" → true, eksik → false', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(MOCK_USER as never)
    const mockDb = makeSupabase({ data: null, error: null })
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    await saveNotificationPreferences(makeFormData('3', 'on'))
    const chain = mockDb.from.mock.results[0].value
    expect(chain.upsert.mock.calls[0][0].email_on).toBe(true)
  })
})
```

- [ ] **Step 2: Testleri çalıştır**

```
npx vitest run tests/vitest/unit/notifications/notifications-actions.test.ts
```
Beklenen: tüm testler geçer

- [ ] **Step 3: Commit**

```bash
git add tests/vitest/unit/notifications/
git commit -m "test(notifications): getNotifications/markRead/preferences için 20 unit test"
```

---

## Task 5: Notifier Helpers — veliAbsenceNotifier + homeworkCreatedNotifier

**Files:**
- Modify: `src/domains/notifications/functions/veliAbsenceNotifier.ts`
- Modify: `src/domains/notifications/functions/homeworkCreatedNotifier.ts`
- Create: `tests/vitest/unit/notifications/notifier-logic.test.ts`

- [ ] **Step 1: veliAbsenceNotifier'dan shouldNotifyVeli() export et**

`src/domains/notifications/functions/veliAbsenceNotifier.ts` dosyasında, `StudentRow` interface'inden sonra şunu ekle (Inngest fonksiyon tanımından ÖNCE):

```typescript
export function shouldNotifyVeli(
  record: {
    status: string | null
    notified_at: string | null
    students: { veli_email: string | null; veli_email_opt_out: boolean } | null
  } | null | undefined
): boolean {
  if (!record) return false
  if (record.status === 'excused') return false
  if (record.status !== 'absent' && record.status !== 'late') return false
  if (record.notified_at) return false
  if (!record.students?.veli_email || record.students.veli_email_opt_out) return false
  return true
}
```

Inngest fonksiyonu içinde `step.run('kontrol')` bloğunda, `if (!record)` kontrollerini `return { skipped: '...' }` yerine `shouldNotifyVeli` kullansın:

```typescript
// Öncesi:
if (!record) return { skipped: 'kayit-yok' }
if (record.status === 'excused') return { skipped: 'ozurlu' }
// ... vb

// Sonrası:
if (!shouldNotifyVeli(record)) {
  const reason = !record ? 'kayit-yok'
    : record.status === 'excused' ? 'ozurlu'
    : record.notified_at ? 'zaten-bildirildi'
    : 'email-yok'
  return { skipped: reason }
}
```

- [ ] **Step 2: homeworkCreatedNotifier'dan filterEligibleVeliler() export et**

`src/domains/notifications/functions/homeworkCreatedNotifier.ts` dosyasında, `StudentRow` interface'inden sonra ekle:

```typescript
export function filterEligibleVeliler(students: StudentRow[]): StudentRow[] {
  return students.filter(s => s.veli_email && !s.veli_email_opt_out).slice(0, 50)
}
```

Inngest fonksiyonu içinde `step.run('fetch-veliler')` dönüş satırını güncelle:

```typescript
// Öncesi:
return ((data ?? []) as StudentRow[]).filter(s => s.veli_email)

// Sonrası:
return filterEligibleVeliler((data ?? []) as StudentRow[])
```

- [ ] **Step 3: Test dosyasını oluştur**

```typescript
// tests/vitest/unit/notifications/notifier-logic.test.ts
import { describe, it, expect } from 'vitest'
import { shouldNotifyVeli } from '@/src/domains/notifications/functions/veliAbsenceNotifier'
import { filterEligibleVeliler } from '@/src/domains/notifications/functions/homeworkCreatedNotifier'

// ── shouldNotifyVeli ──────────────────────────
describe('shouldNotifyVeli()', () => {
  const base = {
    status: 'absent',
    notified_at: null,
    students: { veli_email: 'veli@test.com', veli_email_opt_out: false },
  }

  it('geçerli absent kayıt → true', () => {
    expect(shouldNotifyVeli(base)).toBe(true)
  })

  it('late status da → true', () => {
    expect(shouldNotifyVeli({ ...base, status: 'late' })).toBe(true)
  })

  it('null kayıt → false', () => {
    expect(shouldNotifyVeli(null)).toBe(false)
  })

  it('undefined kayıt → false', () => {
    expect(shouldNotifyVeli(undefined)).toBe(false)
  })

  it('excused → false', () => {
    expect(shouldNotifyVeli({ ...base, status: 'excused' })).toBe(false)
  })

  it('present → false', () => {
    expect(shouldNotifyVeli({ ...base, status: 'present' })).toBe(false)
  })

  it('zaten bildirilmiş (notified_at dolu) → false', () => {
    expect(shouldNotifyVeli({ ...base, notified_at: '2026-01-01T10:00:00Z' })).toBe(false)
  })

  it('veli_email null → false', () => {
    expect(shouldNotifyVeli({ ...base, students: { veli_email: null, veli_email_opt_out: false } })).toBe(false)
  })

  it('veli_email_opt_out true → false', () => {
    expect(shouldNotifyVeli({ ...base, students: { veli_email: 'v@t.com', veli_email_opt_out: true } })).toBe(false)
  })

  it('students null → false', () => {
    expect(shouldNotifyVeli({ ...base, students: null })).toBe(false)
  })
})

// ── filterEligibleVeliler ─────────────────────
describe('filterEligibleVeliler()', () => {
  const makeStudent = (email: string | null, optOut = false) => ({
    id: 'id', full_name: 'Ad', veli_email: email, veli_ad: null,
    veli_email_opt_out: optOut,
  })

  it('opt_out false ve email olan → dahil', () => {
    expect(filterEligibleVeliler([makeStudent('a@b.com')])).toHaveLength(1)
  })

  it('email null → hariç', () => {
    expect(filterEligibleVeliler([makeStudent(null)])).toHaveLength(0)
  })

  it('opt_out true → hariç', () => {
    expect(filterEligibleVeliler([makeStudent('a@b.com', true)])).toHaveLength(0)
  })

  it('50den fazla → ilk 50 alınır', () => {
    const students = Array.from({ length: 60 }, (_, i) => makeStudent(`v${i}@b.com`))
    expect(filterEligibleVeliler(students)).toHaveLength(50)
  })

  it('karma liste — sadece uygunlar kalır', () => {
    const list = [
      makeStudent('a@b.com'),
      makeStudent(null),
      makeStudent('b@b.com', true),
      makeStudent('c@b.com'),
    ]
    expect(filterEligibleVeliler(list)).toHaveLength(2)
  })
})
```

- [ ] **Step 4: Testleri çalıştır**

```
npx vitest run tests/vitest/unit/notifications/notifier-logic.test.ts
```
Beklenen: tüm testler geçer

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/functions/veliAbsenceNotifier.ts
git add src/domains/notifications/functions/homeworkCreatedNotifier.ts
git add tests/vitest/unit/notifications/notifier-logic.test.ts
git commit -m "test(notifications): shouldNotifyVeli + filterEligibleVeliler — 15 test"
```

---

## Task 6: Notifier Helpers — odevSonrasiVeliNotifier + yoklamaHatirlatici

**Files:**
- Modify: `src/domains/notifications/functions/odevSonrasiVeliNotifier.ts`
- Modify: `src/domains/notifications/functions/yoklamaHatirlatici.ts`
- Modify: `tests/vitest/unit/notifications/notifier-logic.test.ts` (genişlet)

- [ ] **Step 1: yesterdayInTurkey() ve filterMissingCandidates() export et**

`src/domains/notifications/functions/odevSonrasiVeliNotifier.ts` dosyasında:

`yesterdayInTurkey` fonksiyonuna `export` ekle:
```typescript
export function yesterdayInTurkey(): string { ... }
```

`results.push(...)` bloğunu ayrı bir export fonksiyona çıkart (Inngest fonksiyon tanımından ÖNCE):

```typescript
type HwRow = { id: string; title: string; due_date: string | null; school_id: string; class_id: string }
type StudentRow = { id: string; full_name: string; veli_email: string; veli_ad: string | null; class_id: string }
type SubRow = { student_id: string; homework_id: string; status: string }
type Candidate = { homeworkId: string; studentId: string; schoolId: string; to: string; veliAd: string; ogrenciAdi: string; odevBaslik: string; dueDate: string }

export function filterMissingCandidates(
  homeworks: HwRow[],
  allStudents: StudentRow[],
  allSubs: SubRow[]
): Candidate[] {
  const studentsByClass = new Map<string, StudentRow[]>()
  for (const s of allStudents) {
    const list = studentsByClass.get(s.class_id) ?? []
    list.push(s)
    studentsByClass.set(s.class_id, list)
  }
  const subKey = new Map<string, string>()
  for (const s of allSubs) subKey.set(`${s.homework_id}:${s.student_id}`, s.status)

  const results: Candidate[] = []
  for (const hw of homeworks) {
    for (const student of studentsByClass.get(hw.class_id) ?? []) {
      const status = subKey.get(`${hw.id}:${student.id}`) ?? 'yapilmadi'
      if (status === 'yapildi' || status === 'mazeretli') continue
      results.push({
        homeworkId: hw.id, studentId: student.id, schoolId: hw.school_id,
        to: student.veli_email, veliAd: student.veli_ad ?? 'Sayın Veli',
        ogrenciAdi: student.full_name, odevBaslik: hw.title, dueDate: hw.due_date ?? '',
      })
    }
  }
  return results
}
```

Inngest fonksiyonu içinde `teslim-etmeyenler` step'ini `filterMissingCandidates` kullanacak şekilde güncelle.

- [ ] **Step 2: findMissingClasses() export et**

`src/domains/notifications/functions/yoklamaHatirlatici.ts` dosyasında, `YONETICI_ROLLER` sabitinden sonra ekle:

```typescript
export function findMissingClasses(
  classes: { id: string; name: string; school_id: string; mentor_teacher_id: string | null }[],
  attendanceTaken: { class_id: string }[]
): typeof classes {
  const taken = new Set(attendanceTaken.map(a => a.class_id))
  return classes.filter(c => !taken.has(c.id))
}
```

Inngest fonksiyon içinde `eksik-siniflar` step'indeki son satırı güncelle:
```typescript
return findMissingClasses(classes, attData ?? [])
```

- [ ] **Step 3: Test dosyasını genişlet**

`tests/vitest/unit/notifications/notifier-logic.test.ts` dosyasının SONUNA ekle:

```typescript
import { filterMissingCandidates, yesterdayInTurkey } from '@/src/domains/notifications/functions/odevSonrasiVeliNotifier'
import { findMissingClasses } from '@/src/domains/notifications/functions/yoklamaHatirlatici'

// ── yesterdayInTurkey ─────────────────────────
describe('yesterdayInTurkey()', () => {
  it('YYYY-MM-DD formatında dün döner', () => {
    const result = yesterdayInTurkey()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('bugünden farklı olmalı', () => {
    const today = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
    expect(yesterdayInTurkey()).not.toBe(today)
  })
})

// ── filterMissingCandidates ───────────────────
describe('filterMissingCandidates()', () => {
  const hw = { id: 'hw1', title: 'Ödev', due_date: '2026-01-10', school_id: 'sch1', class_id: 'cls1' }
  const student = { id: 'st1', full_name: 'Ali', veli_email: 'v@t.com', veli_ad: 'Veli Ali', class_id: 'cls1' }

  it('teslim etmemiş öğrenci → aday listesine girer', () => {
    const result = filterMissingCandidates([hw], [student], [])
    expect(result).toHaveLength(1)
    expect(result[0].studentId).toBe('st1')
  })

  it('yapildi durumundaki → hariç', () => {
    const subs = [{ homework_id: 'hw1', student_id: 'st1', status: 'yapildi' }]
    expect(filterMissingCandidates([hw], [student], subs)).toHaveLength(0)
  })

  it('mazeretli durumundaki → hariç', () => {
    const subs = [{ homework_id: 'hw1', student_id: 'st1', status: 'mazeretli' }]
    expect(filterMissingCandidates([hw], [student], subs)).toHaveLength(0)
  })

  it('eksik/yapilmadi → aday listesinde kalır', () => {
    const subs = [{ homework_id: 'hw1', student_id: 'st1', status: 'eksik' }]
    expect(filterMissingCandidates([hw], [student], subs)).toHaveLength(1)
  })

  it('farklı sınıftaki öğrenci → eşleşmez', () => {
    const otherStudent = { ...student, class_id: 'cls2' }
    expect(filterMissingCandidates([hw], [otherStudent], [])).toHaveLength(0)
  })

  it('veli adı null ise varsayılan atanır', () => {
    const s = { ...student, veli_ad: null }
    const result = filterMissingCandidates([hw], [s], [])
    expect(result[0].veliAd).toBe('Sayın Veli')
  })
})

// ── findMissingClasses ────────────────────────
describe('findMissingClasses()', () => {
  const classes = [
    { id: 'cls1', name: '9-A', school_id: 'sch1', mentor_teacher_id: 't1' },
    { id: 'cls2', name: '9-B', school_id: 'sch1', mentor_teacher_id: null },
  ]

  it('tüm yoklamalar alınmışsa boş döner', () => {
    expect(findMissingClasses(classes, [{ class_id: 'cls1' }, { class_id: 'cls2' }])).toHaveLength(0)
  })

  it('yoklaması alınmayanlar listelenir', () => {
    const result = findMissingClasses(classes, [{ class_id: 'cls1' }])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('cls2')
  })

  it('hiç yoklama alınmamışsa hepsi listelenir', () => {
    expect(findMissingClasses(classes, [])).toHaveLength(2)
  })

  it('boş sınıf listesi → boş döner', () => {
    expect(findMissingClasses([], [{ class_id: 'cls1' }])).toHaveLength(0)
  })
})
```

- [ ] **Step 4: Tüm notifier testlerini çalıştır**

```
npx vitest run tests/vitest/unit/notifications/
```
Beklenen: tüm testler geçer (~35 test)

- [ ] **Step 5: Commit**

```bash
git add src/domains/notifications/functions/odevSonrasiVeliNotifier.ts
git add src/domains/notifications/functions/yoklamaHatirlatici.ts
git add tests/vitest/unit/notifications/notifier-logic.test.ts
git commit -m "test(notifications): notifier logic testleri — filterMissing + findMissing + yesterday (~20 test eklendi)"
```

---

## Task 7: AttendanceService Testleri

**Files:**
- Create: `tests/vitest/unit/attendance/attendance-service.test.ts`

**Not:** `AttendanceService`, `createClient()` ile hem Repository hem de doğrudan DB çağrısı yapıyor. Repository'yi mock'layınca bazı doğrudan `db.from()` çağrıları için thenable chain gerekiyor.

- [ ] **Step 1: Test dosyasını oluştur**

```typescript
// tests/vitest/unit/attendance/attendance-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS, MUDUR_PERMS } from '../../setup/factories'

function makeChain(result: unknown = { data: null, error: null }) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'is', 'not', 'order', 'single', 'limit']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

vi.mock('@/src/shared/authorization/server', () => ({
  getAbility: vi.fn(),
}))

vi.mock('@/src/domains/attendance/repositories/AttendanceRepository', () => ({
  AttendanceRepository: {
    findClass:           vi.fn(),
    findByClassDate:     vi.fn(),
    upsertEntries:       vi.fn(),
    findClassRange:      vi.fn(),
    findStudentHistory:  vi.fn(),
    isTeacherOfClass:    vi.fn(),
  },
}))

vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/src/infrastructure/inngest', () => ({
  inngest: { send: vi.fn().mockResolvedValue(undefined) },
}))

const { getAbility }              = await import('@/src/shared/authorization/server')
const { AttendanceRepository }    = await import('@/src/domains/attendance/repositories/AttendanceRepository')
const { createClient }            = await import('@/src/infrastructure/supabase/server')
const { AttendanceService }       = await import('@/src/domains/attendance/services/AttendanceService')

const SCHOOL_ID  = 'sch-att-unit'
const TEACHER_ID = 't-att-unit'
const CLASS_ID   = 'cls-att-unit'

function makeAbility(perms = OGRETMEN_PERMS, userId = TEACHER_ID) {
  return createAbility({ userId, schoolId: SCHOOL_ID, permissions: perms })
}

beforeEach(() => vi.clearAllMocks())

// ── getYoklama ────────────────────────────────
describe('AttendanceService.getYoklama()', () => {
  it('giriş yapılmamış → hata fırlatır', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    await expect(AttendanceService.getYoklama(CLASS_ID, '2026-01-15')).rejects.toThrow('Giriş gerekli')
  })

  it('yetki yoksa hata fırlatır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    await expect(AttendanceService.getYoklama(CLASS_ID, '2026-01-15')).rejects.toThrow()
  })

  it('sınıf bulunamazsa hata fırlatır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(AttendanceRepository.findClass).mockResolvedValue(null)
    await expect(AttendanceService.getYoklama(CLASS_ID, '2026-01-15')).rejects.toThrow('Sınıf bulunamadı')
  })

  it('başarılı → öğrenci→statüs map döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(AttendanceRepository.findClass).mockResolvedValue({ id: CLASS_ID } as never)
    vi.mocked(AttendanceRepository.findByClassDate).mockResolvedValue([
      { student_id: 'st1', status: 'absent' },
      { student_id: 'st2', status: 'present' },
    ] as never)
    const result = await AttendanceService.getYoklama(CLASS_ID, '2026-01-15')
    expect(result).toEqual({ st1: 'absent', st2: 'present' })
  })
})

// ── saveYoklama ───────────────────────────────
describe('AttendanceService.saveYoklama()', () => {
  it('giriş yapılmamış → hata fırlatır', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    await expect(AttendanceService.saveYoklama(CLASS_ID, '2026-01-15', [])).rejects.toThrow('Giriş gerekli')
  })

  it('geçersiz tarih formatı → hata fırlatır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    await expect(AttendanceService.saveYoklama(CLASS_ID, '15-01-2026', [])).rejects.toThrow('Geçersiz tarih formatı')
  })

  it('hafta sonu tarihi → hata fırlatır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    // 2026-01-10 bir Cumartesi
    await expect(AttendanceService.saveYoklama(CLASS_ID, '2026-01-10', [])).rejects.toThrow('Hafta sonu')
  })

  it('sınıf bulunamazsa hata fırlatır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(AttendanceRepository.findClass).mockResolvedValue(null)
    // 2026-01-12 Pazartesi
    await expect(AttendanceService.saveYoklama(CLASS_ID, '2026-01-12', [])).rejects.toThrow('Sınıf bulunamadı')
  })

  it('başarılı boş kayıt → upsert çağrılır, Inngest çağrılmaz', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(createClient).mockResolvedValue({} as never)
    vi.mocked(AttendanceRepository.findClass).mockResolvedValue({ id: CLASS_ID } as never)
    vi.mocked(AttendanceRepository.upsertEntries).mockResolvedValue(undefined)
    await AttendanceService.saveYoklama(CLASS_ID, '2026-01-12', [])
    expect(AttendanceRepository.upsertEntries).toHaveBeenCalledOnce()
    const { inngest } = await import('@/src/infrastructure/inngest')
    expect(inngest.send).not.toHaveBeenCalled()
  })

  it('absent öğrenci varsa Inngest event gönderilir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const mockChain = makeChain({ data: [{ id: 'st1' }], error: null })
    const mockDb = { from: vi.fn().mockReturnValue(mockChain) }
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    vi.mocked(AttendanceRepository.findClass).mockResolvedValue({ id: CLASS_ID } as never)
    vi.mocked(AttendanceRepository.upsertEntries).mockResolvedValue(undefined)
    await AttendanceService.saveYoklama(CLASS_ID, '2026-01-12', [
      { studentId: 'st1', status: 'absent' },
    ])
    const { inngest } = await import('@/src/infrastructure/inngest')
    expect(inngest.send).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Testleri çalıştır**

```
npx vitest run tests/vitest/unit/attendance/attendance-service.test.ts
```
Beklenen: tüm testler geçer

- [ ] **Step 3: Commit**

```bash
git add tests/vitest/unit/attendance/attendance-service.test.ts
git commit -m "test(attendance): AttendanceService getYoklama/saveYoklama — 8 test"
```

---

## Task 8: Auth + Users Ek Testleri

**Files:**
- Modify: `tests/vitest/unit/auth/auth-service.test.ts`
- Modify: `tests/vitest/unit/users/user-service.test.ts`

- [ ] **Step 1: auth-service.test.ts genişlet**

`tests/vitest/unit/auth/auth-service.test.ts` dosyasının SONUNA şu describe blokları ekle:

```typescript
// ─── signOut ────────────────────────────────────────────────
describe('AuthService.signOut()', () => {
  it('AuthRepository.signOut çağrılır', async () => {
    vi.mocked(AuthRepository.signOut).mockResolvedValue(undefined)
    await AuthService.signOut()
    expect(AuthRepository.signOut).toHaveBeenCalledOnce()
  })
})

// ─── updatePassword hata senaryosu ──────────────────────────
describe('AuthService.updatePassword() — hata senaryoları', () => {
  it('updateUser hatası → error mesajı döner', async () => {
    vi.mocked(AuthRepository.getUser).mockResolvedValue({ data: { user: { id: 'u1' } }, error: null } as never)
    vi.mocked(AuthRepository.updateUser).mockResolvedValue({
      data: {}, error: { message: 'Şifre çok kısa' },
    } as never)
    const result = await AuthService.updatePassword('kısa')
    expect(result).toEqual({ error: 'Şifre çok kısa' })
  })
})
```

- [ ] **Step 2: user-service.test.ts genişlet — assignTeacherClass + removeTeacherClass + updateProfile**

`tests/vitest/unit/users/user-service.test.ts` dosyasında:

1. `UserRepository` mock'una şunları ekle:
```typescript
vi.mock('@/src/domains/users/repositories/UserRepository', () => ({
  UserRepository: {
    createAuthUser:   vi.fn(),
    adminSetProfile:  vi.fn(),
    deleteAuthUser:   vi.fn(),
    getProfileById:   vi.fn(),
    assignRole:       vi.fn(),
    updateProfile:    vi.fn(),
    getClassById:     vi.fn(), // YENİ
    addTeacherClass:  vi.fn(), // YENİ
    removeTeacherClass: vi.fn(), // YENİ
  },
}))
```

2. Dosyanın SONUNA ekle:

```typescript
// ─────────────────────────────────────────────────────────────
describe('UserService.assignTeacherClass()', () => {
  beforeEach(() => {
    vi.mocked(UserRepository.getProfileById).mockResolvedValue(
      { data: { role: 'ogretmen', school_id: SCHOOL_ID }, error: null } as never
    )
    vi.mocked(UserRepository.getClassById).mockResolvedValue(
      { data: { id: 'cls1', school_id: SCHOOL_ID, deleted_at: null }, error: null } as never
    )
    vi.mocked(UserRepository.addTeacherClass).mockResolvedValue({ error: null } as never)
  })

  it('giriş yapılmamış → yetki yok hatası', async () => {
    vi.mocked(requireAbility).mockRejectedValue(new Error('Giriş gerekli'))
    const result = await UserService.assignTeacherClass(TARGET_ID, 'cls1')
    expect(result.error).toBe('Yetki yok')
  })

  it('hedef ogretmen değilse hata döner', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility(MUDUR_YARDIMCISI_PERMS) as never)
    vi.mocked(UserRepository.getProfileById).mockResolvedValue(
      { data: { role: 'mudur', school_id: SCHOOL_ID }, error: null } as never
    )
    const result = await UserService.assignTeacherClass(TARGET_ID, 'cls1')
    expect(result.error).toBeTruthy()
  })

  it('başarılı atama', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility(MUDUR_YARDIMCISI_PERMS) as never)
    const result = await UserService.assignTeacherClass(TARGET_ID, 'cls1')
    expect(result.error).toBeUndefined()
    expect(UserRepository.addTeacherClass).toHaveBeenCalledWith(TARGET_ID, 'cls1')
  })
})

// ─────────────────────────────────────────────────────────────
describe('UserService.removeTeacherClass()', () => {
  it('başarılı kaldırma', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility(MUDUR_YARDIMCISI_PERMS) as never)
    vi.mocked(UserRepository.getProfileById).mockResolvedValue(
      { data: { role: 'ogretmen', school_id: SCHOOL_ID }, error: null } as never
    )
    vi.mocked(UserRepository.getClassById).mockResolvedValue(
      { data: { id: 'cls1', school_id: SCHOOL_ID }, error: null } as never
    )
    vi.mocked(UserRepository.removeTeacherClass).mockResolvedValue({ error: null } as never)
    const result = await UserService.removeTeacherClass(TARGET_ID, 'cls1')
    expect(result.error).toBeUndefined()
  })

  it('farklı okul sınıfı → hata', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility(MUDUR_YARDIMCISI_PERMS) as never)
    vi.mocked(UserRepository.getProfileById).mockResolvedValue(
      { data: { role: 'ogretmen', school_id: SCHOOL_ID }, error: null } as never
    )
    vi.mocked(UserRepository.getClassById).mockResolvedValue(
      { data: { id: 'cls1', school_id: 'baska-okul' }, error: null } as never
    )
    const result = await UserService.removeTeacherClass(TARGET_ID, 'cls1')
    expect(result.error).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────
describe('UserService.updateProfile()', () => {
  const PARAMS = { full_name: 'Yeni Ad', subject: 'Fizik' }

  it('başkasının profilini güncellemeye çalışma → yetki yok', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(OGRETMEN_PERMS, CALLER_ID) as never)
    const result = await UserService.updateProfile('baska-user', PARAMS)
    expect(result.error).toBe('Yetki yok')
    expect(UserRepository.updateProfile).not.toHaveBeenCalled()
  })

  it('giriş yapılmamış → yetki yok', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const result = await UserService.updateProfile(CALLER_ID, PARAMS)
    expect(result.error).toBe('Yetki yok')
  })

  it('kendi profilini güncelleme başarılı', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(OGRETMEN_PERMS, CALLER_ID) as never)
    vi.mocked(UserRepository.updateProfile).mockResolvedValue({ data: null, error: null } as never)
    const result = await UserService.updateProfile(CALLER_ID, PARAMS)
    expect(result.error).toBeUndefined()
    expect(UserRepository.updateProfile).toHaveBeenCalledWith(CALLER_ID, PARAMS)
  })
})
```

- [ ] **Step 3: Tüm testleri çalıştır**

```
npx vitest run tests/vitest/unit/auth/ tests/vitest/unit/users/
```
Beklenen: tüm testler geçer

- [ ] **Step 4: Full test suite**

```
npx vitest run
```
Beklenen: 830+ test, tüm geçer

- [ ] **Step 5: TypeScript kontrol**

```
npx tsc --noEmit
```
Beklenen: 0 hata

- [ ] **Step 6: Commit**

```bash
git add tests/vitest/unit/auth/auth-service.test.ts
git add tests/vitest/unit/users/user-service.test.ts
git commit -m "test(auth,users): signOut + updatePassword hata + assignTeacherClass + removeTeacherClass + updateProfile"
```

---

## Doğrulama

1. `npx vitest run` → 830+ test, 0 hata
2. `npx tsc --noEmit` → 0 hata
3. Veli portalını `npm run dev` ile açıp gerçek token ile test et:
   - Sayfanın üstünde 3 renkli metric görünür
   - Açıklaması olan ödevlerde "Devamını gör" butonu çıkar
   - Devamsızlık bölümünde bar chart görünür (devamsızlık varsa)
4. `git log --oneline -8` → 8 commit, her biri kendi özelliğini commit etmiş
