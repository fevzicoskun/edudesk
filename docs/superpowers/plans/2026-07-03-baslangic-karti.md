# Başlangıç Kartı (Rol-Bazlı Kurulum Yönlendirmesi) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anasayfaya veriden-türetilen, rol-bazlı Başlangıç kartı: müdüre davet-kodu kartı, öğretmene 4 adımlı ✓/○ kurulum listesi.

**Architecture:** Yeni `src/domains/onboarding/` domain'i (setupMath → SetupRepository → SetupService). `anasayfa/page.tsx` müdür dalında mevcut `KurulumWidget` çağrısı `BaslangicKartiMudur` ile değiştirilir; `OgretmenDashboard` en üstüne `BaslangicKartiOgretmen` eklenir. Durum %100 DB count'larından türetilir — migration yok.

**Tech Stack:** Next.js App Router (server components), Supabase SSR (`createClient`), Vitest, Tailwind.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-03-onboarding-baslangic-karti-design.md`
- Yeni tablo/migration/localStorage YOK; durum count sorgularından türetilir.
- Görünürlük penceresi: `profiles.created_at` üzerinden **30 gün** (`ONBOARDING_WINDOW_DAYS`).
- Count sorguları `{ count: 'exact', head: true }` + `Promise.all`.
- Hata durumunda fail-quiet: hatalı count → adım tamamlanmış sayılır, `logger.error` ile loglanır; müdür dalında hata → kart gizlenir.
- Soluk metin: `text-gray-500 dark:text-slate-400` (WCAG AA — asla `text-gray-400`).
- Roller: `mudur` → müdür kartı; `ogretmen`, `zumre_baskani` → öğretmen kartı; `mudur_yardimcisi` ve `admin` → kart yok (MY mevcut `KurulumWidget` akışını korur — spec düzeltmesi, aşağıda).
- Commit mesajları Türkçe, `feat(onboarding):` öneki; her commit sonunda `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

### Spec düzeltmeleri (keşifte bulunan gerçekler)

1. **Öğretmen self-servis sınıf seçemez** — `teacher_classes` insert'i yalnız yönetici atama matrisinde (`UserRepository`). 0 sınıflı öğretmen zaten `BeklemeWidget` görür (dashboard render edilmez) → öğretmen kartındaki 1. adım "Sınıfların atandı" (kart göründüğünde daima ✓; ilerleme hissi verir).
2. **MY öğretmen kartı almaz** — MY `OgretmenDashboard`'a değil `MYWidgets`'a düşer ve orada mevcut `KurulumWidget` çalışır; dokunulmaz.

---

### Task 1: setupMath — saf adım/görünürlük mantığı

**Files:**
- Create: `src/domains/onboarding/setupMath.ts`
- Test: `tests/vitest/unit/domains/onboarding/setupMath.test.ts`

**Interfaces:**
- Produces: `SetupStep { key: string; title: string; href: string; done: boolean }`,
  `ONBOARDING_WINDOW_DAYS = 30`,
  `isWithinOnboardingWindow(createdAt: string, now?: Date): boolean`,
  `buildTeacherSteps(c: { classes: number; schedule: number; attendance: number; homework: number }): SetupStep[]`,
  `hasIncompleteStep(steps: SetupStep[]): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// tests/vitest/unit/domains/onboarding/setupMath.test.ts
import { describe, it, expect } from 'vitest'
import {
  isWithinOnboardingWindow, buildTeacherSteps, hasIncompleteStep,
} from '@/src/domains/onboarding/setupMath'

describe('setupMath', () => {
  const now = new Date('2026-07-03T12:00:00Z')

  it('isWithinOnboardingWindow: 30 gün penceresi (sınırlar dahil)', () => {
    expect(isWithinOnboardingWindow('2026-07-01T00:00:00Z', now)).toBe(true)   // 2 gün
    expect(isWithinOnboardingWindow('2026-06-03T12:00:00Z', now)).toBe(true)   // tam 30 gün
    expect(isWithinOnboardingWindow('2026-06-03T11:59:59Z', now)).toBe(false)  // 30 gün + 1sn
    expect(isWithinOnboardingWindow('2026-01-01T00:00:00Z', now)).toBe(false)  // eski hesap
  })

  it('isWithinOnboardingWindow: bozuk tarih → false (fail-quiet)', () => {
    expect(isWithinOnboardingWindow('garbage', now)).toBe(false)
  })

  it('buildTeacherSteps: count>0 olan adım done', () => {
    const steps = buildTeacherSteps({ classes: 2, schedule: 0, attendance: 0, homework: 1 })
    expect(steps.map(s => [s.key, s.done])).toEqual([
      ['classes', true], ['schedule', false], ['attendance', false], ['homework', true],
    ])
    expect(steps.every(s => s.href.startsWith('/'))).toBe(true)
  })

  it('hasIncompleteStep: tümü done → false, biri eksik → true', () => {
    const all = buildTeacherSteps({ classes: 1, schedule: 1, attendance: 1, homework: 1 })
    expect(hasIncompleteStep(all)).toBe(false)
    const one = buildTeacherSteps({ classes: 1, schedule: 1, attendance: 1, homework: 0 })
    expect(hasIncompleteStep(one)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/vitest/unit/domains/onboarding/setupMath.test.ts`
Expected: FAIL — "Failed to resolve import ... setupMath"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domains/onboarding/setupMath.ts
// Başlangıç kartı: saf adım/görünürlük mantığı (DB'siz, test edilebilir).

export interface SetupStep {
  key: string
  title: string
  href: string
  done: boolean
}

export const ONBOARDING_WINDOW_DAYS = 30

// Profil ilk 30 gün içinde mi? Bozuk tarih → false (kart kritik yol değil).
export function isWithinOnboardingWindow(createdAt: string, now: Date = new Date()): boolean {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  return now.getTime() - created <= ONBOARDING_WINDOW_DAYS * 86_400_000
}

// Öğretmen adımları. Not: 1. adım kart göründüğünde daima ✓ olur
// (0 sınıflı öğretmen BeklemeWidget görür, kart render edilmez) — ilerleme hissi.
export function buildTeacherSteps(c: {
  classes: number
  schedule: number
  attendance: number
  homework: number
}): SetupStep[] {
  return [
    { key: 'classes',    title: 'Sınıfların atandı',    href: '/siniflar',      done: c.classes > 0 },
    { key: 'schedule',   title: 'Ders programını gir',  href: '/ders-programi', done: c.schedule > 0 },
    { key: 'attendance', title: 'İlk yoklamanı al',     href: '/yoklama',       done: c.attendance > 0 },
    { key: 'homework',   title: 'İlk ödevini ver',      href: '/odevler/yeni',  done: c.homework > 0 },
  ]
}

export function hasIncompleteStep(steps: SetupStep[]): boolean {
  return steps.some(s => !s.done)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/vitest/unit/domains/onboarding/setupMath.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add src/domains/onboarding/setupMath.ts tests/vitest/unit/domains/onboarding/setupMath.test.ts
git commit -m "feat(onboarding): saf adım/görünürlük mantığı (setupMath)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: getCurrentProfile'a created_at ekle

**Files:**
- Modify: `src/shared/auth/index.ts:18,21-25` (select string + dönüş tipi)

**Interfaces:**
- Produces: `getCurrentProfile()` dönüşüne `created_at: string` alanı (Task 3'te 30-gün kapısı bunu okur)

- [ ] **Step 1: Select'e ve tipe created_at ekle**

`src/shared/auth/index.ts` içinde:

```ts
// ESKİ (satır 18):
    .select('id, full_name, subject, role, school_id, avatar_url, schools(name, slug)')
// YENİ:
    .select('id, full_name, subject, role, school_id, avatar_url, created_at, schools(name, slug)')
```

```ts
// ESKİ (satır 21-25):
  return data as Pick<Profile, 'id' | 'full_name' | 'subject' | 'role'> & {
    school_id: string
    avatar_url: string | null
    schools: { name: string; slug: string } | null
  } | null
// YENİ:
  return data as Pick<Profile, 'id' | 'full_name' | 'subject' | 'role'> & {
    school_id: string
    avatar_url: string | null
    created_at: string
    schools: { name: string; slug: string } | null
  } | null
```

- [ ] **Step 2: Tip kontrolü + mevcut testler**

Run: `npx tsc --noEmit && npm run test:unit`
Expected: her ikisi de temiz (alan ekleme geriye dönük uyumlu)

- [ ] **Step 3: Commit**

```bash
git add src/shared/auth/index.ts
git commit -m "feat(onboarding): getCurrentProfile'a created_at (30 gün penceresi için)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: SetupRepository + SetupService

**Files:**
- Create: `src/domains/onboarding/repositories/SetupRepository.ts`
- Create: `src/domains/onboarding/services/SetupService.ts`

**Interfaces:**
- Consumes: Task 1'in `setupMath` fonksiyonları; Task 2'nin `created_at`'i
- Produces: `SetupService.getSetupStatus(): Promise<SetupStatus>` —
  `type SetupStatus = { kind: 'mudur'; code: string } | { kind: 'ogretmen'; steps: SetupStep[] } | null`
  (Task 4/5'in kart bileşenleri bunu tüketir)

- [ ] **Step 1: Repository'yi yaz**

```ts
// src/domains/onboarding/repositories/SetupRepository.ts
import { createClient } from '@/src/infrastructure/supabase/server'

// RLS altında hafif count sorguları (head:true). İş mantığı yok.
export const SetupRepository = {
  // Okulda müdür dışında üye var mı? (davet ✓ koşulu)
  async countOtherMembers(schoolId: string) {
    const db = await createClient()
    return db
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .neq('role', 'mudur')
  },

  // Öğretmen adım sayaçları — 4 paralel count.
  async teacherCounts(userId: string, schoolId: string) {
    const db = await createClient()
    return Promise.all([
      db.from('teacher_classes')
        .select('class_id', { count: 'exact', head: true })
        .eq('teacher_id', userId),
      db.from('lesson_schedules')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', userId)
        .eq('school_id', schoolId),
      db.from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', userId)
        .eq('school_id', schoolId),
      db.from('homeworks')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', userId)
        .eq('school_id', schoolId)
        .is('deleted_at', null),
    ])
  },
}
```

- [ ] **Step 2: Service'i yaz**

```ts
// src/domains/onboarding/services/SetupService.ts
import { getCurrentProfile } from '@/src/shared/auth'
import { logger } from '@/src/infrastructure/observability/logger'
import { SetupRepository } from '../repositories/SetupRepository'
import {
  isWithinOnboardingWindow, buildTeacherSteps, hasIncompleteStep, type SetupStep,
} from '../setupMath'

export type SetupStatus =
  | { kind: 'mudur'; code: string }
  | { kind: 'ogretmen'; steps: SetupStep[] }
  | null

// Fail-quiet: count hatası → adım done sayılır / kart gizlenir. Kart kritik yol değil.
export const SetupService = {
  async getSetupStatus(): Promise<SetupStatus> {
    const profile = await getCurrentProfile()
    if (!profile?.school_id) return null
    if (!isWithinOnboardingWindow(profile.created_at)) return null

    if (profile.role === 'mudur') {
      const { count, error } = await SetupRepository.countOtherMembers(profile.school_id)
      if (error) {
        logger.error({ event: 'setup_status_failed', userId: profile.id, err: error.message }, 'Kurulum durumu okunamadı (müdür)')
        return null
      }
      if ((count ?? 0) > 0) return null // davet tamam → kart yok
      return { kind: 'mudur', code: profile.schools?.slug ?? '' }
    }

    if (profile.role === 'ogretmen' || profile.role === 'zumre_baskani') {
      const results = await SetupRepository.teacherCounts(profile.id, profile.school_id)
      const [classes, schedule, attendance, homework] = results.map(r => {
        if (r.error) {
          logger.error({ event: 'setup_status_failed', userId: profile.id, err: r.error.message }, 'Kurulum durumu okunamadı (öğretmen)')
          return 1 // fail-quiet: hatalı adım done sayılır
        }
        return r.count ?? 0
      })
      const steps = buildTeacherSteps({ classes, schedule, attendance, homework })
      return hasIncompleteStep(steps) ? { kind: 'ogretmen', steps } : null
    }

    return null // mudur_yardimcisi / admin: kart yok
  },
}
```

- [ ] **Step 3: Tip kontrolü**

Run: `npx tsc --noEmit`
Expected: temiz

- [ ] **Step 4: Commit**

```bash
git add src/domains/onboarding/repositories/SetupRepository.ts src/domains/onboarding/services/SetupService.ts
git commit -m "feat(onboarding): SetupRepository (count sorguları) + SetupService (rol -> durum)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Müdür kartı + anasayfa entegrasyonu

**Files:**
- Create: `app/(dashboard)/anasayfa/BaslangicKartiMudur.tsx` (client — kopyala butonu)
- Modify: `app/(dashboard)/anasayfa/page.tsx:53` (`KurulumWidget` → yeni kart; import değişimi satır 13)

**Interfaces:**
- Consumes: `SetupService.getSetupStatus()` (Task 3), `SetupStatus.kind === 'mudur'` dalı
- Produces: `<BaslangicKartiMudur code={string} />`

- [ ] **Step 1: Kart bileşenini yaz**

```tsx
// app/(dashboard)/anasayfa/BaslangicKartiMudur.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'

const KAYIT_URL = 'https://www.myedudesk.com.tr/kayit'

// Müdür Başlangıç kartı: davet kodu + kopyala + WhatsApp paylaş.
// Görünürlük SetupService'te: 30 gün içinde VE okulda müdürden başka üye yok.
export default function BaslangicKartiMudur({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard izni yoksa sessiz geç — kod ekranda zaten görünür
    }
  }

  const waText = encodeURIComponent(
    `EduDesk'e katıl! Okul kodumuz: ${code}\nKayıt: ${KAYIT_URL}`,
  )

  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
        Okulunuz hazır — şimdi ekibinizi davet edin
      </h2>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 mb-4">
        Öğretmenler bu kodla kayıt olup okulunuza katılır.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-2xl font-bold tracking-widest text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-700/60 border border-gray-200 dark:border-slate-600 rounded-lg px-4 py-2">
          {code}
        </span>
        <button
          type="button"
          onClick={copy}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {copied ? 'Kopyalandı ✓' : 'Kopyala'}
        </button>
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
        >
          WhatsApp ile paylaş
        </a>
      </div>

      <p className="text-xs text-gray-500 dark:text-slate-400 mt-4">
        Sonraki adımlar:{' '}
        <Link href="/siniflar" className="text-blue-600 dark:text-blue-400 hover:underline">sınıf ekle</Link>
        {' · '}
        <Link href="/yonetim/ogrenciler" className="text-blue-600 dark:text-blue-400 hover:underline">öğrenci ekle</Link>
      </p>
    </section>
  )
}
```

- [ ] **Step 2: page.tsx müdür dalını değiştir**

`app/(dashboard)/anasayfa/page.tsx`:

```tsx
// import bloğuna ekle (satır 13 civarı; KurulumWidget import'u MY kullandığı için KALIR):
import BaslangicKartiMudur from './BaslangicKartiMudur'
import { SetupService } from '@/src/domains/onboarding/services/SetupService'
```

`MudurWidgets` fonksiyonunu değiştir:

```tsx
// ESKİ (satır 41):
async function MudurWidgets({ fullName, classCount }: { fullName: string; classCount: number }) {
// YENİ (classCount parametresi kalır — çağıran taraf değişmez):
async function MudurWidgets({ fullName, classCount }: { fullName: string; classCount: number }) {
  const setup = await SetupService.getSetupStatus()
```

```tsx
// ESKİ (satır 53):
      {firstRunState('mudur', classCount) === 'setup' && <KurulumWidget />}
// YENİ (davet bitmemişse zengin kart; bitmiş ama okul boşsa eski widget):
      {setup?.kind === 'mudur'
        ? <BaslangicKartiMudur code={setup.code} />
        : firstRunState('mudur', classCount) === 'setup' && <KurulumWidget />}
```

Not: `MYWidgets` (satır 82) dokunulmaz — MY mevcut `KurulumWidget` akışını korur.

- [ ] **Step 3: Doğrula**

Run: `npx tsc --noEmit && npm run lint`
Expected: temiz

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/anasayfa/BaslangicKartiMudur.tsx" "app/(dashboard)/anasayfa/page.tsx"
git commit -m "feat(onboarding): müdür Başlangıç kartı (davet kodu + kopyala + WhatsApp)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Öğretmen kartı + OgretmenDashboard entegrasyonu + final doğrulama

**Files:**
- Create: `app/(dashboard)/anasayfa/BaslangicKartiOgretmen.tsx` (server component — salt linkler)
- Modify: `app/(dashboard)/anasayfa/OgretmenDashboard.tsx` (BeklemeWidget bloğundan sonra, ana içerik başına kart)

**Interfaces:**
- Consumes: `SetupService.getSetupStatus()`, `SetupStatus.kind === 'ogretmen'` dalı, `SetupStep`

- [ ] **Step 1: Kart bileşenini yaz**

```tsx
// app/(dashboard)/anasayfa/BaslangicKartiOgretmen.tsx
import Link from 'next/link'
import type { SetupStep } from '@/src/domains/onboarding/setupMath'

// Öğretmen Başlangıç kartı: 4 adımlı ✓/○ kurulum listesi.
// Görünürlük SetupService'te: 30 gün içinde VE en az bir adım eksik.
export default function BaslangicKartiOgretmen({ steps }: { steps: SetupStep[] }) {
  return (
    <section className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 mb-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Başlangıç</h2>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 mb-3">
        EduDesk&apos;i tanımak için şu adımları tamamla.
      </p>
      <ol className="space-y-1.5">
        {steps.map(s => (
          <li key={s.key}>
            <Link
              href={s.href}
              className="flex items-center gap-3 rounded-lg px-2 py-2 -mx-2 hover:bg-gray-50 dark:hover:bg-slate-700/60 transition-colors"
            >
              {s.done ? (
                <span aria-hidden className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">✓</span>
              ) : (
                <span aria-hidden className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-slate-500 shrink-0" />
              )}
              <span className={`text-sm ${s.done
                ? 'text-gray-500 dark:text-slate-400 line-through'
                : 'text-gray-900 dark:text-slate-100 font-medium'}`}>
                {s.title}
              </span>
              <span className="sr-only">{s.done ? '(tamamlandı)' : '(bekliyor)'}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
```

- [ ] **Step 2: OgretmenDashboard'a bağla**

`app/(dashboard)/anasayfa/OgretmenDashboard.tsx`:

```tsx
// import bloğuna ekle:
import BaslangicKartiOgretmen from './BaslangicKartiOgretmen'
import { SetupService } from '@/src/domains/onboarding/services/SetupService'
```

Durum sorgusu — `return (` (satır ~127) öncesindeki hesaplamaların sonuna:

```tsx
// ESKİ (satır 122-125):
  const todayHws = metrics.homeworks.filter(h => h.due_date === todayStr)
  const upcomingHws = metrics.homeworks
    .filter(h => h.due_date > todayStr && h.due_date <= next7Str)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
// YENİ (altına ekle):
  const setup = await SetupService.getSetupStatus()
```

Kart — başlık bloğu ile `BugunProgramWidget` arasına:

```tsx
// ESKİ (satır 134-138):
      </div>

      {/* Bugünkü ders programı şeridi (program kuruluysa kendini gösterir) */}
      <Suspense fallback={null}>
        <BugunProgramWidget />
// YENİ:
      </div>

      {/* Başlangıç kartı — ilk 30 gün + eksik kurulum adımı varsa */}
      {setup?.kind === 'ogretmen' && <BaslangicKartiOgretmen steps={setup.steps} />}

      {/* Bugünkü ders programı şeridi (program kuruluysa kendini gösterir) */}
      <Suspense fallback={null}>
        <BugunProgramWidget />
```

- [ ] **Step 3: Tip + lint + tüm birim testler**

Run: `npx tsc --noEmit && npm run lint && npm run test:unit`
Expected: hepsi temiz

- [ ] **Step 4: Build + e2e**

Run: `npm run build && npm run test:e2e`
Expected: build temiz; 67 e2e yeşil.
⚠️ Risk: e2e seed öğretmeninin 4 adımı da done değilse ve seed profili 30 günden
yeniyse kart görünür ve `ul li` gibi genel seçiciler kayabilir. Kırılan olursa:
kırılan spec'in seçicisini karta değil hedef listeye daraltın (örn.
`page.locator('section:has-text("Yoklama") ul li')`), kartı gizlemeye çalışmayın.

- [ ] **Step 5: Commit + push**

```bash
git add "app/(dashboard)/anasayfa/BaslangicKartiOgretmen.tsx" "app/(dashboard)/anasayfa/OgretmenDashboard.tsx"
git commit -m "feat(onboarding): öğretmen Başlangıç kartı (4 adımlı kurulum listesi)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```
