# Performance Transformation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uygulamanın "çat çat açılan ekranlar" hissini vermesi için 4 somut bottleneck'ı düzelt: yoklama çift round trip, 6 eksik loading.tsx, duplicate auth çağrısı, ödev detay sayfası blokajı.

**Architecture:** (1) Yoklama: bugünün attendance'ını server-side pre-fetch edip `initialStatuses` prop olarak geç, YoklamaClient'ı ilk mount'ta fetch skip'le. (2) loading.tsx: 6 rotaya Sk-pattern skeleton ekle. (3) kullanicilar: supabase.auth.getUser() → getCurrentUser() cache. (4) StatusBoard: yeni `StatusBoardLoader.tsx` async server component wrapper + Suspense, StatusBoard.tsx'e dokunma.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase SSR, TypeScript, Tailwind v4, Vitest

---

## Dosya Haritası

| Eylem | Dosya | Sorumluluk |
|-------|-------|-----------|
| Güncelle | `app/(dashboard)/yoklama/page.tsx` | Bugünün attendance'ını fetch et, initialStatuses/initialDate prop geç |
| Güncelle | `app/(dashboard)/yoklama/YoklamaClient.tsx` | Props al, ilk mount skip mantığı |
| Güncelle | `app/(dashboard)/kullanicilar/page.tsx` | `supabase.auth.getUser()` → `getCurrentUser()` |
| Güncelle | `app/(dashboard)/odevler/[id]/StatusBoard.tsx` | `StatusItem` type'ını export et |
| Oluştur | `app/(dashboard)/odevler/[id]/StatusBoardLoader.tsx` | Async server component: queries + StatusBoard render |
| Güncelle | `app/(dashboard)/odevler/[id]/page.tsx` | Suspense + StatusBoardLoader, queries buradan çıkar |
| Oluştur | `app/(dashboard)/yonetim/loading.tsx` | Skeleton |
| Oluştur | `app/(dashboard)/yonetim/ogrenciler/loading.tsx` | Skeleton |
| Oluştur | `app/(dashboard)/kullanicilar/loading.tsx` | Skeleton |
| Oluştur | `app/(dashboard)/odevler/analitik/loading.tsx` | Skeleton |
| Oluştur | `app/(dashboard)/odevler/takvim/loading.tsx` | Skeleton |
| Oluştur | `app/(dashboard)/odevler/[id]/duzenle/loading.tsx` | Skeleton |

---

## Task 1: 6 Eksik loading.tsx Dosyası

**Files:**
- Create: `app/(dashboard)/yonetim/loading.tsx`
- Create: `app/(dashboard)/yonetim/ogrenciler/loading.tsx`
- Create: `app/(dashboard)/kullanicilar/loading.tsx`
- Create: `app/(dashboard)/odevler/analitik/loading.tsx`
- Create: `app/(dashboard)/odevler/takvim/loading.tsx`
- Create: `app/(dashboard)/odevler/[id]/duzenle/loading.tsx`

- [ ] **Step 1: Yönetim loading.tsx oluştur**

`app/(dashboard)/yonetim/loading.tsx` içeriği:

```tsx
function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function YonetimLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="space-y-1.5">
        <Sk className="h-6 w-36" />
        <Sk className="h-3 w-52" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
            <Sk className="h-8 w-16" />
            <Sk className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Sk className="h-8 w-8 rounded-full shrink-0" />
            <Sk className="h-4 flex-1" />
            <Sk className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Yönetim/öğrenciler loading.tsx oluştur**

`app/(dashboard)/yonetim/ogrenciler/loading.tsx` içeriği:

```tsx
function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function OgrencilerLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-5 space-y-1.5">
        <Sk className="h-6 w-28" />
        <Sk className="h-3 w-40" />
      </div>
      <Sk className="h-10 w-full mb-4 rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3">
            <Sk className="h-4 w-8 shrink-0" />
            <Sk className="h-4 flex-1" />
            <Sk className="h-4 w-20" />
            <Sk className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Kullanıcılar loading.tsx oluştur**

`app/(dashboard)/kullanicilar/loading.tsx` içeriği:

```tsx
function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function KullanicilarLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="space-y-1.5">
        <Sk className="h-6 w-28" />
        <Sk className="h-3 w-44" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
        <Sk className="h-4 w-32" />
        <div className="flex gap-2">
          <Sk className="h-10 flex-1 rounded-xl" />
          <Sk className="h-10 w-32 rounded-xl" />
        </div>
        <Sk className="h-10 w-full rounded-xl" />
        <Sk className="h-10 w-28 rounded-xl" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3">
            <Sk className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Sk className="h-4 w-32" />
              <Sk className="h-3 w-20" />
            </div>
            <Sk className="h-6 w-20 rounded-full" />
            <Sk className="h-7 w-7 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Ödevler/analitik loading.tsx oluştur**

`app/(dashboard)/odevler/analitik/loading.tsx` içeriği:

```tsx
function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function AnalitikLoading() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="space-y-1.5">
        <Sk className="h-6 w-36" />
        <Sk className="h-3 w-52" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
            <Sk className="h-7 w-10" />
            <Sk className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
        <Sk className="h-4 w-28" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Sk className="h-3 w-20 shrink-0" />
            <Sk className="h-5 flex-1 rounded-full" />
            <Sk className="h-3 w-8" />
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
        <Sk className="h-4 w-36" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Sk className="h-4 w-4 shrink-0" />
            <Sk className="h-4 flex-1" />
            <Sk className="h-6 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Ödevler/takvim loading.tsx oluştur**

`app/(dashboard)/odevler/takvim/loading.tsx` içeriği:

```tsx
function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function TakvimLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-5 flex items-center justify-between">
        <div className="space-y-1.5">
          <Sk className="h-6 w-28" />
          <Sk className="h-3 w-40" />
        </div>
        <Sk className="h-9 w-24 rounded-xl" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <Sk className="h-7 w-7 rounded-lg" />
          <Sk className="h-5 w-32" />
          <Sk className="h-7 w-7 rounded-lg" />
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Sk key={i} className="h-4" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Sk key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Ödevler/[id]/duzenle loading.tsx oluştur**

`app/(dashboard)/odevler/[id]/duzenle/loading.tsx` içeriği:

```tsx
function Sk({ className }: { className?: string }) {
  return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
}

export default function OdevDuzenleLoading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-5 space-y-1.5">
        <Sk className="h-6 w-32" />
        <Sk className="h-3 w-44" />
      </div>
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Sk className="h-3 w-20" />
            <Sk className="h-10 w-full rounded-xl" />
          </div>
        ))}
        <div className="flex gap-3 pt-2">
          <Sk className="h-10 w-24 rounded-xl" />
          <Sk className="h-10 flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Build kontrolü**

```bash
cd C:\Users\mehme\zumre-takip && npm run build 2>&1 | tail -20
```

Beklenen: `✓ Compiled successfully` ya da sadece tip uyarısı (hata değil). Loading dosyaları saf JSX, derleme hatası olmamalı.

- [ ] **Step 8: Commit**

```bash
cd C:\Users\mehme\zumre-takip
git add app/(dashboard)/yonetim/loading.tsx
git add "app/(dashboard)/yonetim/ogrenciler/loading.tsx"
git add "app/(dashboard)/kullanicilar/loading.tsx"
git add "app/(dashboard)/odevler/analitik/loading.tsx"
git add "app/(dashboard)/odevler/takvim/loading.tsx"
git add "app/(dashboard)/odevler/[id]/duzenle/loading.tsx"
git commit -m "feat: add loading skeletons for 6 missing routes"
```

---

## Task 2: Kullanıcılar Sayfası — Duplicate Auth Fix

**Files:**
- Modify: `app/(dashboard)/kullanicilar/page.tsx`

- [ ] **Step 1: Dosyayı oku ve değişikliği uygula**

`kullanicilar/page.tsx`'in başındaki import satırı şu an:

```ts
import { getCurrentProfile } from '@/src/shared/auth'
```

`getCurrentUser`'ı da import et ve `supabase.auth.getUser()` çağrısını kaldır:

```ts
// ÖNCE (import):
import { getCurrentProfile } from '@/src/shared/auth'

// SONRA (import):
import { getCurrentProfile, getCurrentUser } from '@/src/shared/auth'
```

Ve fonksiyon içinde:

```ts
// ÖNCE:
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')

// SONRA:
const user = await getCurrentUser()
if (!user) redirect('/login')
const supabase = await createClient()
```

Dikkat: `supabase` değişkeni hâlâ kullanılıyor (profiles sorgusu için), sadece `user`'ı artık cache'den alıyoruz.

- [ ] **Step 2: Build kontrolü**

```bash
cd C:\Users\mehme\zumre-takip && npm run build 2>&1 | tail -20
```

Beklenen: derleme hatası yok.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\mehme\zumre-takip
git add "app/(dashboard)/kullanicilar/page.tsx"
git commit -m "perf: remove duplicate supabase.auth.getUser() in kullanicilar page"
```

---

## Task 3: Yoklama page.tsx — Bugünün Attendance Pre-fetch

**Files:**
- Modify: `app/(dashboard)/yoklama/page.tsx`

Mevcut kod:
```ts
export const revalidate = 30

import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { getEgitimYili, schoolYearStart } from '@/src/shared/utils'
import YoklamaClient from './YoklamaClient'

export default async function YoklamaPage() {
  const [supabase, profile] = await Promise.all([createClient(), getCurrentProfile()])
  if (!profile?.school_id) redirect('/anasayfa')

  const { data: rawClasses } = await supabase
    .from('classes')
    .select('id, name, grade, students(id, full_name, student_number, deleted_at)')
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .order('grade')
    .order('name')

  const classes: ClassWithStudents[] = (rawClasses ?? []).map(cls => ({
    ...cls,
    students: ((cls.students ?? []) as (Student & { deleted_at: string | null })[])
      .filter(s => !s.deleted_at),
  }))

  // Yıl içi devamsızlık sayaçları
  const studentIds = classes.flatMap(c => c.students.map(s => s.id))
  const absenceCounts: Record<string, number> = {}

  if (studentIds.length > 0) {
    const { data: absences } = await supabase
      .from('attendance')
      .select('student_id, status, date')
      .eq('school_id', profile.school_id)
      .in('student_id', studentIds)
      .gte('date', schoolYearStart())
      .in('status', ['absent', 'late'])

    for (const a of absences ?? []) {
      const [y, m, d] = (a.date as string).split('-').map(Number)
      const dow = new Date(y, m - 1, d).getDay()
      if (dow === 0 || dow === 6) continue
      const increment = a.status === 'absent' ? 1 : 0.5
      absenceCounts[a.student_id] = (absenceCounts[a.student_id] ?? 0) + increment
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yoklama</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{getEgitimYili()} — Devamsız öğrencilerin velisine otomatik e-posta gider</p>
      </div>
      <YoklamaClient classes={classes} absenceCounts={absenceCounts} />
    </div>
  )
}

interface Student          { id: string; full_name: string; student_number: string | null }
export interface ClassWithStudents { id: string; name: string; grade: number; students: Student[] }
```

- [ ] **Step 1: Yoklama page.tsx'i tam olarak yaz**

Dosyayı tamamen şununla değiştir:

```ts
export const revalidate = 30

import { redirect } from 'next/navigation'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { getEgitimYili, schoolYearStart } from '@/src/shared/utils'
import YoklamaClient from './YoklamaClient'
import { type AttendanceStatus } from '@/app/actions/yoklama'

export default async function YoklamaPage() {
  const [supabase, profile] = await Promise.all([createClient(), getCurrentProfile()])
  if (!profile?.school_id) redirect('/anasayfa')

  const { data: rawClasses } = await supabase
    .from('classes')
    .select('id, name, grade, students(id, full_name, student_number, deleted_at)')
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .order('grade')
    .order('name')

  const classes: ClassWithStudents[] = (rawClasses ?? []).map(cls => ({
    ...cls,
    students: ((cls.students ?? []) as (Student & { deleted_at: string | null })[])
      .filter(s => !s.deleted_at),
  }))

  const studentIds   = classes.flatMap(c => c.students.map(s => s.id))
  const firstClassId = classes[0]?.id ?? ''
  const todayISO     = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())

  // Yıllık devamsızlıklar + bugünün yoklaması paralel
  const [absencesRes, todayRes] = await Promise.all([
    studentIds.length > 0
      ? supabase
          .from('attendance')
          .select('student_id, status, date')
          .eq('school_id', profile.school_id)
          .in('student_id', studentIds)
          .gte('date', schoolYearStart())
          .in('status', ['absent', 'late'])
      : Promise.resolve({ data: [] as { student_id: string; status: string; date: string }[] }),
    firstClassId
      ? supabase
          .from('attendance')
          .select('student_id, status')
          .eq('class_id', firstClassId)
          .eq('school_id', profile.school_id)
          .eq('date', todayISO)
      : Promise.resolve({ data: [] as { student_id: string; status: string }[] }),
  ])

  const absenceCounts: Record<string, number> = {}
  for (const a of absencesRes.data ?? []) {
    const [y, m, d] = (a.date as string).split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay()
    if (dow === 0 || dow === 6) continue
    const increment = a.status === 'absent' ? 1 : 0.5
    absenceCounts[a.student_id] = (absenceCounts[a.student_id] ?? 0) + increment
  }

  const initialStatuses: Record<string, AttendanceStatus> = {}
  for (const row of todayRes.data ?? []) {
    initialStatuses[row.student_id] = row.status as AttendanceStatus
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yoklama</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{getEgitimYili()} — Devamsız öğrencilerin velisine otomatik e-posta gider</p>
      </div>
      <YoklamaClient
        classes={classes}
        absenceCounts={absenceCounts}
        initialStatuses={initialStatuses}
        initialDate={todayISO}
      />
    </div>
  )
}

interface Student          { id: string; full_name: string; student_number: string | null }
export interface ClassWithStudents { id: string; name: string; grade: number; students: Student[] }
```

**Notlar:**
- `AttendanceStatus` type'ını `YoklamaClient`'tan export alıyoruz (Task 4'te export eklenecek)
- `todayRes.data` değeri boş array olsa bile (hiç kayıt yoksa), `initialStatuses = {}` geçilir — bu da "kayıt yok" anlamına gelir ve fetch skip edilir
- Mevcut devamsızlık sayaç mantığı aynı kaldı, sadece destructuring değişti

- [ ] **Step 2: Build'e hazırlık notu**

Bu adım tek başına build vermez çünkü `YoklamaClient`'ta `AttendanceStatus` henüz export edilmemiş. Task 4 bittikten sonra build al.

---

## Task 4: YoklamaClient.tsx — initialStatuses Prop + Skip Mantığı

**Files:**
- Modify: `app/(dashboard)/yoklama/YoklamaClient.tsx`

- [ ] **Step 1: `AttendanceStatus`'un nereden geldiğini doğrula**

`YoklamaClient.tsx`'e bak — `AttendanceStatus` zaten `@/app/actions/yoklama`'dan geliyor:
```ts
import { getYoklama, saveYoklama, type AttendanceStatus } from '@/app/actions/yoklama'
```

`yoklama/page.tsx` de aynı yerden import ediyor (Task 3 Step 1'de zaten doğru yazıldı). Bu adımda `YoklamaClient.tsx`'e dokunmaya gerek yok.

- [ ] **Step 2: Props interface'ini güncelle**

`YoklamaClient.tsx` içinde `Props` interface'ini bul ve güncelle:

```ts
// ÖNCE:
interface Props {
  classes: ClassWithStudents[]
  absenceCounts: Record<string, number>
}

// SONRA:
interface Props {
  classes: ClassWithStudents[]
  absenceCounts: Record<string, number>
  initialStatuses?: Record<string, AttendanceStatus>
  initialDate?: string
}
```

- [ ] **Step 3: useState başlangıç değerlerini güncelle**

`export default function YoklamaClient({ classes, absenceCounts }: Props)` imzasını güncelle:

```ts
// ÖNCE:
export default function YoklamaClient({ classes, absenceCounts }: Props) {
  const [classId,   setClassId]   = useState(classes[0]?.id ?? '')
  const [date,      setDate]      = useState(todayISO())
  const [statuses,  setStatuses]  = useState<Record<string, AttendanceStatus>>({})
```

```ts
// SONRA:
export default function YoklamaClient({ classes, absenceCounts, initialStatuses, initialDate }: Props) {
  const [classId,   setClassId]   = useState(classes[0]?.id ?? '')
  const [date,      setDate]      = useState(initialDate ?? todayISO())
  const [statuses,  setStatuses]  = useState<Record<string, AttendanceStatus>>(initialStatuses ?? {})
```

- [ ] **Step 4: useRef ile skip mantığını ekle**

`useRef` zaten import edilmiş (mevcut kodda `isDirty` için kullanılıyor). Hemen `isDirty` ref'inin altına ekle:

```ts
// Mevcut:
const isDirty = useRef(false)

// Sonrası (hemen altına ekle):
// initialStatuses geçilmişse ilk mount'ta getYoklama çağrısını skip et
const skipInitialLoad = useRef(initialStatuses !== undefined)
```

- [ ] **Step 5: useEffect'i güncelle**

Mevcut `useEffect`:
```ts
useEffect(() => { loadYoklama() }, [loadYoklama])
```

Değiştir:
```ts
useEffect(() => {
  if (skipInitialLoad.current) {
    skipInitialLoad.current = false
    return
  }
  loadYoklama()
}, [loadYoklama])
```

**Bu mantık şu şekilde çalışır:**
- `initialStatuses` prop'u geçildiyse: ilk useEffect çalışmayı atlar (skip), `skipInitialLoad` false'a döner
- Kullanıcı sınıf veya tarih değiştirirse: `loadYoklama` callback'i değişir → useEffect yeniden çalışır → artık `skipInitialLoad.current = false` olduğu için `getYoklama()` çağrılır
- `initialStatuses` geçilmediyse: normal davranış (hiç skip yok)

- [ ] **Step 6: Build kontrolü**

```bash
cd C:\Users\mehme\zumre-takip && npm run build 2>&1 | tail -30
```

Beklenen: derleme hatası yok.

- [ ] **Step 7: Unit testleri çalıştır**

```bash
cd C:\Users\mehme\zumre-takip && npm run test:unit 2>&1 | tail -20
```

Beklenen: tüm unit testler geçer.

- [ ] **Step 8: Commit**

```bash
cd C:\Users\mehme\zumre-takip
git add "app/(dashboard)/yoklama/page.tsx" "app/(dashboard)/yoklama/YoklamaClient.tsx"
git commit -m "perf: pre-fetch today attendance server-side, skip client loadYoklama on initial mount"
```

---

## Task 5: StatusBoardLoader — Yeni Async Server Component

**Files:**
- Modify: `app/(dashboard)/odevler/[id]/StatusBoard.tsx` (StatusItem export)
- Create: `app/(dashboard)/odevler/[id]/StatusBoardLoader.tsx`

- [ ] **Step 1: StatusBoard.tsx'te StatusItem type'ını export et**

`StatusBoard.tsx` satır 65'te:

```ts
// ÖNCE:
type StatusItem = {

// SONRA:
export type StatusItem = {
```

Bu değişiklik tek bir karakter — `type` → `export type`. StatusBoard'a başka dokunma.

- [ ] **Step 2: StatusBoardLoader.tsx oluştur**

`app/(dashboard)/odevler/[id]/StatusBoardLoader.tsx` dosyasını oluştur:

```ts
import { createClient } from '@/src/infrastructure/supabase/server'
import { getClassWeekLoad } from '@/app/actions/homework'
import { format, parseISO } from '@/src/shared/date'
import type { ClassWeekLoad } from '@/src/domains/homework/lib/week-load'
import type { SubmissionStatus } from '@/src/shared/types'
import StatusBoard, { type StatusItem } from './StatusBoard'

interface Props {
  homeworkId: string
  classId: string
  dueDate: string | null
  schoolId: string
  homeworkTitle?: string
  className?: string
}

export default async function StatusBoardLoader({
  homeworkId,
  classId,
  dueDate,
  schoolId,
  homeworkTitle,
  className,
}: Props) {
  const supabase = await createClient()

  const [studentsResult, subsResult, otherHwRes, weekLoadResult] = await Promise.all([
    supabase
      .from('students')
      .select('id, full_name, student_number, veli_telefon, veli_ad, veli_email')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .is('deleted_at', null),
    supabase
      .from('homework_submissions')
      .select('student_id, status, note')
      .eq('homework_id', homeworkId)
      .eq('school_id', schoolId),
    supabase
      .from('homeworks')
      .select('id')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .eq('is_template', false)
      .neq('id', homeworkId),
    dueDate
      ? getClassWeekLoad([classId], dueDate)
      : Promise.resolve([] as ClassWeekLoad[]),
  ])

  const weekLoad: ClassWeekLoad | null = weekLoadResult[0] ?? null
  const otherHomeworkIds = otherHwRes.data?.map(h => h.id) ?? []

  const cumulativeResult = otherHomeworkIds.length > 0
    ? await supabase
        .from('homework_submissions')
        .select('student_id, status, homework_id')
        .in('homework_id', otherHomeworkIds)
    : { data: [] as { student_id: string; status: string; homework_id: string }[] }

  const students = studentsResult.data ?? []
  const subs     = subsResult.data ?? []
  const subMap   = new Map(subs.map(s => [s.student_id, s]))

  const cumulativeSubs   = cumulativeResult.data ?? []
  const totalHomeworkCount = new Set(cumulativeSubs.map(s => s.homework_id)).size
  const missedByStudent  = new Map<string, number>()
  for (const s of cumulativeSubs) {
    if (s.status === 'yapilmadi' || s.status === 'eksik') {
      missedByStudent.set(s.student_id, (missedByStudent.get(s.student_id) ?? 0) + 1)
    }
  }

  const items: StatusItem[] = students
    .map(student => {
      const sub = subMap.get(student.id)
      return {
        student_id:    student.id,
        full_name:     student.full_name,
        student_number: student.student_number,
        veli_telefon:  student.veli_telefon ?? null,
        veli_ad:       student.veli_ad ?? null,
        veli_email:    (student as typeof student & { veli_email?: string | null }).veli_email ?? null,
        status:        (sub?.status ?? 'yapilmadi') as SubmissionStatus,
        note:          sub?.note ?? null,
        hasRecord:     !!sub,
        missedCount:   missedByStudent.get(student.id) ?? 0,
        totalHomeworks: totalHomeworkCount,
      }
    })
    .sort((a, b) =>
      (a.student_number ?? '').localeCompare(b.student_number ?? '', 'tr', { numeric: true })
    )

  if (items.length === 0) {
    return (
      <p className="text-center text-gray-400 text-sm py-12">
        Bu sınıfta henüz öğrenci yok.
      </p>
    )
  }

  return (
    <StatusBoard
      homeworkId={homeworkId}
      items={items}
      homeworkTitle={homeworkTitle}
      totalHomeworks={totalHomeworkCount}
      classId={classId}
      dueDate={dueDate ? format(parseISO(dueDate), 'd MMMM yyyy') : ''}
      className={className}
      weekLoad={weekLoad}
    />
  )
}
```

**Notlar:**
- `students` select'inde `veli_telefon`, `veli_ad`, `veli_email` alanlarını çekiyoruz; Supabase client bu alanları tip olarak bilmeyebilir — mevcut `page.tsx`'teki `as typeof student & {...}` cast'leri korunuyor
- Boş öğrenci durumu (`items.length === 0`) artık burada handle ediliyor (page.tsx'ten taşındı)

- [ ] **Step 3: Build kontrolü**

```bash
cd C:\Users\mehme\zumre-takip && npm run build 2>&1 | tail -30
```

Beklenen: derleme hatası yok. `StatusBoardLoader.tsx` henüz hiçbir yerde kullanılmıyor ama TypeScript'in kendisini doğrulaması yeterli.

---

## Task 6: odevler/[id]/page.tsx — Suspense + StatusBoardLoader

**Files:**
- Modify: `app/(dashboard)/odevler/[id]/page.tsx`

Mevcut page.tsx tam içeriği (referans için):
```ts
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile, getCurrentUser } from '@/src/shared/auth'
import { notFound, redirect } from 'next/navigation'
import { getClassWeekLoad } from '@/app/actions/homework'
import type { ClassWeekLoad } from '@/src/domains/homework/lib/week-load'
import Link from 'next/link'
import StatusBoard from './StatusBoard'
import PrintButton from '@/components/PrintButton'
import { format, parseISO } from '@/src/shared/date'
import { isTeachingRole, isMudurOrAbove } from '@/src/shared/types'
import type { SubmissionStatus } from '@/src/shared/types'

export const revalidate = 30

export default async function OdevDetayPage({ params, searchParams }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const [profile, user] = await Promise.all([getCurrentProfile(), getCurrentUser()])
  if (!profile?.school_id || !user) redirect('/login')

  const supabase = await createClient()

  const { data: hw } = await supabase
    .from('homeworks')
    .select('*, classes(name)')
    .eq('id', id)
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .single()

  if (!hw || hw.is_template) notFound()

  const isManager = profile.role === 'zumre_baskani' || isMudurOrAbove(profile.role)
  if (!isManager && hw.teacher_id !== user.id) notFound()

  const canWrite = isTeachingRole(profile.role)

  const [studentsResult, subsResult, otherHwRes, weekLoadResult] = await Promise.all([...])
  // ... 5 parallel + sequential queries ...
  // ... items building ...
  const cls = hw.classes as { name: string } | null

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* guncellendi flash */}
      {/* nav bar */}
      {/* hw title/description */}
      {items.length === 0 ? (
        <p>Bu sınıfta henüz öğrenci yok.</p>
      ) : (
        <StatusBoard items={items} ... />
      )}
    </div>
  )
}
```

- [ ] **Step 1: page.tsx'i tamamen yeniden yaz**

```ts
import { Suspense } from 'react'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile, getCurrentUser } from '@/src/shared/auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import PrintButton from '@/components/PrintButton'
import { format, parseISO } from '@/src/shared/date'
import { isTeachingRole, isMudurOrAbove } from '@/src/shared/types'
import StatusBoardLoader from './StatusBoardLoader'

export const revalidate = 30

function StatusBoardSkeleton() {
  function Sk({ className }: { className?: string }) {
    return <div className={`bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse ${className ?? ''}`} />
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2 mb-3">
        <Sk className="h-8 w-20 rounded-full" />
        <Sk className="h-8 w-20 rounded-full" />
        <Sk className="h-8 w-20 rounded-full" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl">
          <Sk className="h-4 w-6 shrink-0" />
          <Sk className="h-4 flex-1" />
          <Sk className="h-8 w-28 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export default async function OdevDetayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ guncellendi?: string }>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const [profile, user] = await Promise.all([getCurrentProfile(), getCurrentUser()])
  if (!profile?.school_id || !user) redirect('/login')

  const supabase = await createClient()

  const { data: hw } = await supabase
    .from('homeworks')
    .select('*, classes(name)')
    .eq('id', id)
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .single()

  if (!hw || hw.is_template) notFound()

  const isManager = profile.role === 'zumre_baskani' || isMudurOrAbove(profile.role)
  if (!isManager && hw.teacher_id !== user.id) notFound()

  const canWrite = isTeachingRole(profile.role)
  const cls = hw.classes as { name: string } | null

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {sp.guncellendi && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 text-sm px-4 py-3 rounded-xl print:hidden">
          <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Ödev başarıyla güncellendi.
        </div>
      )}
      <div className="flex items-center justify-between mb-3 print:hidden">
        <Link href="/odevler" className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
          ← Ödevler
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/odevler/sinif/${hw.class_id}`}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M14 3v18" />
            </svg>
            Başarı Haritası
          </Link>
          {canWrite && (
            <>
              <Link
                href={`/odevler/${id}/duzenle`}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Düzenle
              </Link>
              <Link
                href={`/odevler/yeni?copy=${id}`}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Kopyala
              </Link>
            </>
          )}
          <PrintButton />
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{hw.title}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {cls?.name ?? '—'} · {hw.subject}
          {hw.due_date ? ` · Son: ${format(parseISO(hw.due_date), 'd MMMM yyyy')}` : ''}
        </p>
        {hw.description && (
          <p className="text-sm text-gray-700 dark:text-slate-300 mt-3 bg-gray-50 dark:bg-slate-800 rounded-xl p-3 border border-gray-200 dark:border-slate-700">
            {hw.description}
          </p>
        )}
      </div>

      <Suspense fallback={<StatusBoardSkeleton />}>
        <StatusBoardLoader
          homeworkId={id}
          classId={hw.class_id}
          dueDate={hw.due_date ?? null}
          schoolId={profile.school_id}
          homeworkTitle={hw.title}
          className={cls?.name}
        />
      </Suspense>
    </div>
  )
}
```

**Dikkat:** Kaldırılan import'lar: `getClassWeekLoad`, `ClassWeekLoad`, `StatusBoard`, `SubmissionStatus`. Eklenen: `Suspense`, `StatusBoardLoader`.

- [ ] **Step 2: Build kontrolü**

```bash
cd C:\Users\mehme\zumre-takip && npm run build 2>&1 | tail -40
```

Beklenen: derleme hatası yok. TypeScript tüm type'ları doğrular.

Hata gelirse: büyük ihtimalle import veya prop adı uyumsuzluğu. Hata mesajına göre düzelt.

- [ ] **Step 3: Tüm testleri çalıştır**

```bash
cd C:\Users\mehme\zumre-takip && npm run test:unit 2>&1 | tail -20
```

Beklenen: tüm testler geçer.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\mehme\zumre-takip
git add "app/(dashboard)/odevler/[id]/StatusBoard.tsx"
git add "app/(dashboard)/odevler/[id]/StatusBoardLoader.tsx"
git add "app/(dashboard)/odevler/[id]/page.tsx"
git commit -m "perf: stream StatusBoard with Suspense, extract loader to StatusBoardLoader"
```

---

## Task 7: Final — Tüm Testler + Push

- [ ] **Step 1: Tam test suite çalıştır**

```bash
cd C:\Users\mehme\zumre-takip && npm run test 2>&1 | tail -30
```

Beklenen: tüm unit testler geçer. Integration testler Supabase bağlantısı gerektirir — `.env.local` yoksa skip.

- [ ] **Step 2: Son build doğrulaması**

```bash
cd C:\Users\mehme\zumre-takip && npm run build 2>&1 | tail -20
```

Beklenen: `✓ Compiled successfully`, hata yok.

- [ ] **Step 3: Git log — tüm commit'leri doğrula**

```bash
cd C:\Users\mehme\zumre-takip && git log --oneline -6
```

Beklenen çıktı (sıralama yaklaşık):
```
xxxxxxx feat: add loading skeletons for 6 missing routes
xxxxxxx perf: remove duplicate supabase.auth.getUser() in kullanicilar page
xxxxxxx perf: pre-fetch today attendance server-side, skip client loadYoklama on initial mount
xxxxxxx perf: stream StatusBoard with Suspense, extract loader to StatusBoardLoader
```

- [ ] **Step 4: Push**

```bash
cd C:\Users\mehme\zumre-takip && git push origin main
```

Beklenen: push başarılı, Vercel deploy tetiklenir.
