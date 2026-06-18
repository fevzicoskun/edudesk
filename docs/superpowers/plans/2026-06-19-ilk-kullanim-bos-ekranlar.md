# İlk-kullanım & Boş Ekranlar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yeni kayıt olan okulun/öğretmenin gördüğü sıfır-veri ekranlarını yönlendirici hale getirmek (paylaşılan EmptyState + rol-bazlı ilk-adımlar).

**Architecture:** Tek paylaşılan `<EmptyState>` sunum bileşeni; çıplak sayfa-düzeyi boşluklar buna geçirilir; dashboard'a rol-bazlı ilk-adımlar bloğu eklenir; varyant kararı tek saf helper `firstRunState` ile verilir ve test edilir.

**Tech Stack:** Next.js 16 App Router (server components), React 19, Tailwind v4, Supabase SSR, Vitest.

## Global Constraints

- Server component'ler Supabase'i doğrudan okur (mutation yok); `createClient()` → `@/src/infrastructure/supabase/server`.
- Her sorgu `school_id` filtreli + `.is('deleted_at', null)`.
- Roller: `ogretmen`, `zumre_baskani`, `mudur_yardimcisi`, `mudur`, `admin`.
- Dashboard rol yönlendirmesi: `mudur`→MudurWidgets, `mudur_yardimcisi`→MYWidgets, diğerleri→OgretmenDashboard.
- Tüm metin Türkçe, tam ortografi (diakritikler korunur).
- Dark mode her görsel öğede zorunlu (`dark:` sınıfları).
- Test komutu: `npx vitest run --project unit <dosya>`.

---

### Task 1: `firstRunState` saf karar helper'ı (TDD)

**Files:**
- Create: `src/domains/dashboard/lib/firstRun.ts`
- Test: `tests/vitest/unit/domains/dashboard/firstRun.test.ts`

**Interfaces:**
- Consumes: yok
- Produces: `firstRunState(role: Role, classCount: number): 'setup' | 'waiting' | null` ve `type Role`.

- [ ] **Step 1: Failing test yaz**

`tests/vitest/unit/domains/dashboard/firstRun.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { firstRunState } from '@/src/domains/dashboard/lib/firstRun'

describe('firstRunState', () => {
  it('sınıf varsa hiçbir rol için ilk-kullanım göstermez', () => {
    for (const r of ['ogretmen', 'zumre_baskani', 'mudur_yardimcisi', 'mudur', 'admin'] as const) {
      expect(firstRunState(r, 1)).toBeNull()
    }
  })

  it('müdür/MY + 0 sınıf → setup', () => {
    expect(firstRunState('mudur', 0)).toBe('setup')
    expect(firstRunState('mudur_yardimcisi', 0)).toBe('setup')
  })

  it('öğretmen/zümre başkanı/admin + 0 sınıf → waiting', () => {
    expect(firstRunState('ogretmen', 0)).toBe('waiting')
    expect(firstRunState('zumre_baskani', 0)).toBe('waiting')
    expect(firstRunState('admin', 0)).toBe('waiting')
  })
})
```

- [ ] **Step 2: Testi çalıştır, fail ettiğini doğrula**

Run: `npx vitest run --project unit tests/vitest/unit/domains/dashboard/firstRun.test.ts`
Expected: FAIL — "Cannot find module '.../firstRun'".

- [ ] **Step 3: Minimal implementasyon**

`src/domains/dashboard/lib/firstRun.ts`:

```ts
export type Role = 'ogretmen' | 'zumre_baskani' | 'mudur_yardimcisi' | 'mudur' | 'admin'

/**
 * Yeni-hesap ilk-kullanım durumu.
 * - 'setup'   → müdür/MY, okulda hiç sınıf yok: kurulum adımları göster
 * - 'waiting' → öğretmen/zümre başkanı/admin, atanmış sınıf yok: pasif bekleme
 * - null      → sınıf var, normal dashboard
 * Not: admin dashboard'da öğretmen rotasına düşer, bu yüzden 'waiting'.
 */
export function firstRunState(role: Role, classCount: number): 'setup' | 'waiting' | null {
  if (classCount > 0) return null
  if (role === 'mudur' || role === 'mudur_yardimcisi') return 'setup'
  return 'waiting'
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `npx vitest run --project unit tests/vitest/unit/domains/dashboard/firstRun.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add src/domains/dashboard/lib/firstRun.ts tests/vitest/unit/domains/dashboard/firstRun.test.ts
git commit -m "feat(dashboard): firstRunState ilk-kullanım karar helper'ı"
```

---

### Task 2: Paylaşılan `<EmptyState>` bileşeni + odevler refactor

**Files:**
- Create: `app/components/EmptyState.tsx`
- Modify: `app/(dashboard)/odevler/EmptyState.tsx` (tüm dosya)

**Interfaces:**
- Consumes: yok
- Produces: default export `EmptyState(props: EmptyStateProps)` ve `export interface EmptyStateAction { label: string; href: string }`.
  `EmptyStateProps = { icon?: React.ReactNode; title: string; description?: string; action?: EmptyStateAction; secondaryAction?: EmptyStateAction }`.
  `action` → mavi gradient birincil buton, `secondaryAction` → nötr çerçeveli buton, ikisi de `Link`.

- [ ] **Step 1: Paylaşılan bileşeni oluştur**

`app/components/EmptyState.tsx`:

```tsx
import Link from 'next/link'

export interface EmptyStateAction {
  label: string
  href: string
}

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: EmptyStateAction
  secondaryAction?: EmptyStateAction
}

const DEFAULT_ICON = (
  <svg className="w-8 h-8 text-gray-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
)

export default function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
        {icon ?? DEFAULT_ICON}
      </div>
      <p className="text-gray-900 dark:text-slate-100 font-semibold text-base">{title}</p>
      {description && <p className="text-gray-400 text-sm mt-1 max-w-xs">{description}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-5 inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/25"
        >
          {action.label}
        </Link>
      )}
      {secondaryAction && (
        <Link
          href={secondaryAction.href}
          className="mt-3 inline-flex items-center gap-2 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
        >
          {secondaryAction.label}
        </Link>
      )}
    </div>
  )
}
```

- [ ] **Step 2: odevler/EmptyState'i paylaşılanı kullanacak şekilde refactor et**

`app/(dashboard)/odevler/EmptyState.tsx` (tamamını değiştir; `HomeworkSection.tsx`'in beklediği `{ hasFilters, canWrite }` imzası korunur):

```tsx
import EmptyState from '@/app/components/EmptyState'

const ODEV_ICON = (
  <svg className="w-8 h-8 text-gray-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)

export default function OdevlerEmptyState({ hasFilters, canWrite }: { hasFilters: boolean; canWrite: boolean }) {
  if (hasFilters) {
    return (
      <EmptyState
        icon={ODEV_ICON}
        title="Bu kriterlere uygun ödev bulunamadı"
        description="Farklı filtreler deneyin veya filtreyi temizleyin."
        secondaryAction={{ label: 'Filtreyi Sıfırla', href: '/odevler' }}
      />
    )
  }
  return (
    <EmptyState
      icon={ODEV_ICON}
      title="Henüz ödev yok"
      description="Sınıflarınıza ödev tanımlamak için yeni bir ödev oluşturun."
      action={canWrite ? { label: 'İlk Ödevi Oluştur', href: '/odevler/yeni' } : undefined}
    />
  )
}
```

Not: orijinaldeki birincil butonun "+" ikonu bilinçli olarak düşürüldü (paylaşılan bileşen label-odaklı); metin CTA korunuyor.

- [ ] **Step 3: Tip kontrolü + build**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add app/components/EmptyState.tsx "app/(dashboard)/odevler/EmptyState.tsx"
git commit -m "feat(ui): paylaşılan EmptyState bileşeni + odevler refactor"
```

---

### Task 3: Sayfa-düzeyi boşlukları EmptyState'e geçir

**Files:**
- Modify: `app/(dashboard)/siniflar/page.tsx:62-63`
- Modify: `app/(dashboard)/yoklama/cizelge/page.tsx:42-45`
- Modify: `app/(dashboard)/yonetim/ogrenciler/page.tsx:50-51`

**Interfaces:**
- Consumes: `EmptyState` (Task 2) `@/app/components/EmptyState`
- Produces: yok

- [ ] **Step 1: siniflar/page.tsx**

Import ekle (dosya başındaki importların yanına):

```tsx
import EmptyState from '@/app/components/EmptyState'
```

Mevcut boş hali (satır 62-63):

```tsx
      {!classes?.length ? (
        <div className="text-center py-20 text-gray-400 text-sm">Henüz sınıf eklenmemiş.</div>
```

şununla değiştir:

```tsx
      {!classes?.length ? (
        <EmptyState
          title="Henüz sınıf yok"
          description={canManageClasses
            ? 'Yukarıdaki formdan ilk sınıfını ekleyerek başla.'
            : 'Müdürün sınıf eklediğinde burada görünecek.'}
        />
```

- [ ] **Step 2: yoklama/cizelge/page.tsx**

Import ekle:

```tsx
import EmptyState from '@/app/components/EmptyState'
```

Mevcut boş hali (satır 42-45):

```tsx
      {classes.length === 0 ? (
        <p className="text-sm text-gray-400">
          Henüz sınıf eklenmemiş.
        </p>
```

şununla değiştir:

```tsx
      {classes.length === 0 ? (
        <EmptyState
          title="Henüz sınıf yok"
          description="Çizelge için önce sınıf eklenmeli."
          action={['mudur', 'mudur_yardimcisi'].includes(profile.role)
            ? { label: 'Sınıf ekle', href: '/siniflar' }
            : undefined}
        />
```

- [ ] **Step 3: yonetim/ogrenciler/page.tsx**

Import ekle:

```tsx
import EmptyState from '@/app/components/EmptyState'
```

Mevcut render (satır 50-51):

```tsx
      <OgrencilerClient classes={classes} />
```

şununla değiştir:

```tsx
      {totalStudents === 0 ? (
        <EmptyState
          title="Henüz öğrenci yok"
          description="Sınıflarına öğrenci ekleyerek başla."
          action={{ label: 'Sınıflara git', href: '/siniflar' }}
        />
      ) : (
        <OgrencilerClient classes={classes} />
      )}
```

(`totalStudents` zaten satır 30'da hesaplı.)

- [ ] **Step 4: Tip kontrolü + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc exit 0, build exit 0.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/siniflar/page.tsx" "app/(dashboard)/yoklama/cizelge/page.tsx" "app/(dashboard)/yonetim/ogrenciler/page.tsx"
git commit -m "feat(ui): sayfa-düzeyi boş ekranları EmptyState'e geçir"
```

---

### Task 4: `IlkAdimlarWidget` + dashboard'a bağla

**Files:**
- Create: `app/(dashboard)/anasayfa/IlkAdimlarWidget.tsx`
- Modify: `app/(dashboard)/anasayfa/OgretmenDashboard.tsx`
- Modify: `app/(dashboard)/anasayfa/page.tsx`

**Interfaces:**
- Consumes: `EmptyState` (Task 2), `firstRunState` (Task 1)
- Produces: named export `KurulumWidget()` ve `BeklemeWidget()`.

- [ ] **Step 1: IlkAdimlarWidget bileşenini oluştur**

`app/(dashboard)/anasayfa/IlkAdimlarWidget.tsx`:

```tsx
import Link from 'next/link'
import EmptyState from '@/app/components/EmptyState'

const SETUP_STEPS = [
  { n: 1, title: 'Sınıf ekle', href: '/siniflar' },
  { n: 2, title: 'Öğrenci ekle', href: '/yonetim/ogrenciler' },
  { n: 3, title: 'Öğretmen davet et', href: '/kullanicilar' },
]

/** Müdür/MY, okulda 0 sınıf → 3 adımlık kurulum yönlendirmesi. */
export function KurulumWidget() {
  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Okulunu kur</h2>
      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 mb-4">Başlamak için şu adımları tamamla.</p>
      <ol className="space-y-2">
        {SETUP_STEPS.map(s => (
          <li key={s.n}>
            <Link
              href={s.href}
              className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/60 transition-colors"
            >
              <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-sm font-bold flex items-center justify-center shrink-0">
                {s.n}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{s.title}</span>
              <svg className="w-4 h-4 text-gray-300 dark:text-slate-600 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Öğretmen/zümre başkanı, atanmış 0 sınıf → pasif bekleme. */
export function BeklemeWidget() {
  return (
    <EmptyState
      title="Henüz sana sınıf atanmadı"
      description="Müdürün sınıf atadığında dersleriniz ve yoklamalarınız burada görünecek."
    />
  )
}
```

- [ ] **Step 2: OgretmenDashboard'a bekleme varyantını bağla**

`app/(dashboard)/anasayfa/OgretmenDashboard.tsx` import bloğuna ekle:

```tsx
import { firstRunState } from '@/src/domains/dashboard/lib/firstRun'
import { BeklemeWidget } from './IlkAdimlarWidget'
```

`const greeting = getGreeting(...)` satırından (satır 48) hemen sonra, `canEditAfterLock` tanımından **önce** şu erken-dönüşü ekle:

```tsx
  // İlk-kullanım: atanmış sınıf yoksa sade bekleme ekranı göster.
  if (firstRunState(profile.role as 'ogretmen' | 'zumre_baskani' | 'mudur_yardimcisi' | 'mudur' | 'admin', metrics.yoklamaDurumu.length) === 'waiting') {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{greeting}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{format(today, 'd MMMM yyyy, EEEE')}</p>
        </div>
        <BeklemeWidget />
      </div>
    )
  }
```

- [ ] **Step 3: page.tsx — müdür/MY kurulum varyantı + sınıf sayısı**

`app/(dashboard)/anasayfa/page.tsx` import bloğuna ekle:

```tsx
import { createClient } from '@/src/infrastructure/supabase/server'
import { firstRunState } from '@/src/domains/dashboard/lib/firstRun'
import { KurulumWidget } from './IlkAdimlarWidget'
```

`MudurWidgets` ve `MYWidgets` imzalarına `classCount` ekle:

```tsx
async function MudurWidgets({ fullName, classCount }: { fullName: string; classCount: number }) {
```
```tsx
async function MYWidgets({ fullName, classCount }: { fullName: string; classCount: number }) {
```

Her iki fonksiyonda da başlık `<div>`'inden (greeting bloğu) hemen sonra, ilk `<Suspense>`'ten önce kurulum bloğunu ekle.

`MudurWidgets` içinde:

```tsx
      {firstRunState('mudur', classCount) === 'setup' && <KurulumWidget />}
```

`MYWidgets` içinde:

```tsx
      {firstRunState('mudur_yardimcisi', classCount) === 'setup' && <KurulumWidget />}
```

`AnasayfaPage` içindeki rol dallanmasını (satır 98-99) şununla değiştir:

```tsx
  if (profile.role === 'mudur' || profile.role === 'mudur_yardimcisi') {
    const supabase = await createClient()
    const { count } = await supabase
      .from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', profile.school_id!)
      .is('deleted_at', null)
    const classCount = count ?? 0
    return profile.role === 'mudur'
      ? <MudurWidgets fullName={fullName} classCount={classCount} />
      : <MYWidgets fullName={fullName} classCount={classCount} />
  }
```

- [ ] **Step 4: Tip kontrolü + build + tüm testler**

Run: `npx tsc --noEmit && npx vitest run --project unit && npm run build`
Expected: tsc exit 0; tüm testler PASS; build exit 0.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/anasayfa/IlkAdimlarWidget.tsx" "app/(dashboard)/anasayfa/OgretmenDashboard.tsx" "app/(dashboard)/anasayfa/page.tsx"
git commit -m "feat(dashboard): rol-bazlı ilk-adımlar (kurulum/bekleme) bloğu"
```

---

## Self-Review Notları

- **Spec kapsamı:** EmptyState (Task 2) ✓, 3 sayfa-düzeyi boşluk (Task 3) ✓, IlkAdimlar kurulum+bekleme (Task 4) ✓, firstRunState helper+test (Task 1) ✓, inline boşluklar kapsam dışı (dokunulmadı) ✓.
- **Tip tutarlılığı:** `firstRunState(role, count)` imzası tüm çağrılarda aynı; `EmptyStateAction { label, href }` tüm kullanımlarda tutarlı; `OdevlerEmptyState` `{ hasFilters, canWrite }` imzası `HomeworkSection.tsx`'le uyumlu kaldı.
- **Placeholder taraması:** temiz; her çağrı kesin rol stringi içeriyor (MudurWidgets→`'mudur'`, MYWidgets→`'mudur_yardimcisi'`).
