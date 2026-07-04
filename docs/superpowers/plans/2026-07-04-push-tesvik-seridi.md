# Push Teşvik Şeridi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard'a (tüm roller) kapatılabilir bir push-aboneliği teşvik şeridi ekle; "Daha sonra" 14 gün susturur, abone olununca kalıcı kaybolur.

**Architecture:** Saf snooze mantığı `src/domains/dashboard/lib/pushNudge.ts`'te (TDD). `WebPushButton`'daki abonelik durum makinesi `app/(dashboard)/usePushSubscription.ts` hook'una çıkarılır (DRY, davranış birebir korunur); yeni `PushTesvikSeridi.tsx` bileşeni aynı hook'u kullanır ve `app/(dashboard)/layout.tsx`'te `{children}` üstüne yerleşir. Migration/API/bağımlılık değişikliği YOK.

**Tech Stack:** Next.js App Router (client components), Web Push API (mevcut `/api/push/subscribe`), Vitest, Tailwind.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-04-push-tesvik-seridi-design.md`
- Şerit metni: `Sabah özetini ve bildirimleri telefonuna al` (🔔 önekli başlıkla), butonlar: **"Bildirimleri aç"** + **"Daha sonra"**.
- Görünürlük (HEPSİ): tarayıcı destekli + VAPID key tanımlı, `permission !== 'denied'`, aktif abonelik yok, snooze dolmuş. İlk boyamada gizli başlar (async kontrol).
- Snooze: `NUDGE_SNOOZE_DAYS = 14`, `NUDGE_STORAGE_KEY = 'edudesk-push-nudge-dismissed-at'`; null/bozuk değer → göster; tam 14 gün (≥) → göster.
- `WebPushButton`'ın görünür davranışı BİREBİR korunur (aynı state'ler, metinler, fetch çağrıları).
- Soluk metin: `text-gray-500 dark:text-slate-400` (asla `text-gray-400`); ikon-only kapat butonu `aria-label`'lı.
- localStorage erişimi her zaman try/catch içinde (gizli mod).
- `lint` script'i bu repoda YOK — çalıştırma; doğrulama `npx tsc --noEmit` + `npm run test:unit`.
- E2e çalıştırılacaksa dev server webpack modunda (playwright.config.ts zaten `--webpack`; turbopack YASAK — sunucuyu çökertiyor).
- Commit mesajları Türkçe, `feat(push):` öneki; her commit sonunda `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: pushNudge — saf snooze mantığı

**Files:**
- Create: `src/domains/dashboard/lib/pushNudge.ts`
- Test: `tests/vitest/unit/domains/dashboard/pushNudge.test.ts`

**Interfaces:**
- Produces: `NUDGE_SNOOZE_DAYS = 14`, `NUDGE_STORAGE_KEY = 'edudesk-push-nudge-dismissed-at'`,
  `shouldShowPushNudge(dismissedAtISO: string | null, now?: Date): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// tests/vitest/unit/domains/dashboard/pushNudge.test.ts
import { describe, it, expect } from 'vitest'
import { shouldShowPushNudge, NUDGE_SNOOZE_DAYS, NUDGE_STORAGE_KEY } from '@/src/domains/dashboard/lib/pushNudge'

describe('shouldShowPushNudge', () => {
  const now = new Date('2026-07-04T10:00:00Z')

  it('hiç kapatılmamış (null) → göster', () => {
    expect(shouldShowPushNudge(null, now)).toBe(true)
  })

  it('bozuk zaman damgası → göster (fail-open)', () => {
    expect(shouldShowPushNudge('garbage', now)).toBe(true)
  })

  it('13 gün önce kapatılmış → gizle', () => {
    expect(shouldShowPushNudge('2026-06-21T10:00:00Z', now)).toBe(false)
  })

  it('tam 14 gün önce kapatılmış → göster (sınır dahil)', () => {
    expect(shouldShowPushNudge('2026-06-20T10:00:00Z', now)).toBe(true)
  })

  it('15 gün önce kapatılmış → göster', () => {
    expect(shouldShowPushNudge('2026-06-19T10:00:00Z', now)).toBe(true)
  })

  it('sabitler dışa aktarılmış', () => {
    expect(NUDGE_SNOOZE_DAYS).toBe(14)
    expect(NUDGE_STORAGE_KEY).toBe('edudesk-push-nudge-dismissed-at')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/vitest/unit/domains/dashboard/pushNudge.test.ts`
Expected: FAIL — "Failed to resolve import ... pushNudge"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domains/dashboard/lib/pushNudge.ts
// Push teşvik şeridi: saf snooze mantığı (DB'siz, tarayıcı-API'siz, test edilebilir).
// Spec: docs/superpowers/specs/2026-07-04-push-tesvik-seridi-design.md

export const NUDGE_SNOOZE_DAYS = 14
export const NUDGE_STORAGE_KEY = 'edudesk-push-nudge-dismissed-at'

// "Daha sonra" damgasına göre şerit gösterilsin mi? Bozuk/eksik damga → göster (fail-open).
export function shouldShowPushNudge(dismissedAtISO: string | null, now: Date = new Date()): boolean {
  if (!dismissedAtISO) return true
  const dismissed = new Date(dismissedAtISO).getTime()
  if (Number.isNaN(dismissed)) return true
  return now.getTime() - dismissed >= NUDGE_SNOOZE_DAYS * 86_400_000
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/vitest/unit/domains/dashboard/pushNudge.test.ts`
Expected: PASS (6 test)

- [ ] **Step 5: Commit**

```bash
git add src/domains/dashboard/lib/pushNudge.ts tests/vitest/unit/domains/dashboard/pushNudge.test.ts
git commit -m "feat(push): teşvik şeridi saf snooze mantığı (pushNudge)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: usePushSubscription hook'u — WebPushButton'dan çıkarma (DRY)

**Files:**
- Create: `app/(dashboard)/usePushSubscription.ts`
- Modify: `app/(dashboard)/ayarlar/WebPushButton.tsx` (durum makinesi + subscribe/unsubscribe hook'a taşınır; render JSX'i AYNEN kalır)

**Interfaces:**
- Produces: `type PushState = 'unsupported' | 'loading' | 'denied' | 'subscribed' | 'unsubscribed'`,
  `usePushSubscription(): { state: PushState; subscribe: () => Promise<void>; unsubscribe: () => Promise<void> }`
- Davranış sözleşmesi: mount'ta destek/VAPID/permission/abonelik kontrolü; `subscribe()` SW register → izin iste → `pushManager.subscribe` → `POST /api/push/subscribe`; `unsubscribe()` `DELETE /api/push/subscribe` → `sub.unsubscribe()`. Mevcut WebPushButton mantığının birebir taşınması — davranış DEĞİŞMEZ.

- [ ] **Step 1: Hook'u yaz**

Mevcut `app/(dashboard)/ayarlar/WebPushButton.tsx` içindeki `useEffect` + `subscribe` + `unsubscribe` gövdeleri OLDUĞU GİBİ taşınır:

```ts
// app/(dashboard)/usePushSubscription.ts
'use client'

import { useEffect, useState } from 'react'

export type PushState = 'unsupported' | 'loading' | 'denied' | 'subscribed' | 'unsubscribed'

// Web push abonelik durum makinesi — WebPushButton'dan çıkarıldı (DRY),
// PushTesvikSeridi ile paylaşılır. Davranış birebir aynıdır.
export function usePushSubscription() {
  const [state, setState] = useState<PushState>('loading')

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    // VAPID public key tanımlı değilse subscribe edilemez — hiç gösterme
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') { setState('denied'); return }

    navigator.serviceWorker.getRegistration('/sw.js')
      .then((reg) => {
        if (!reg) { setState('unsubscribed'); return }
        reg.pushManager.getSubscription().then((sub) => {
          setState(sub ? 'subscribed' : 'unsubscribed')
        })
      })
      .catch(() => setState('unsubscribed'))
  }, [])

  async function subscribe() {
    setState('loading')
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setState('denied'); return }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })

      setState(res.ok ? 'subscribed' : 'unsubscribed')
    } catch (e) {
      console.error('[usePushSubscription] subscribe:', e)
      setState('unsubscribed')
    }
  }

  async function unsubscribe() {
    setState('loading')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState('unsubscribed')
    } catch (e) {
      console.error('[usePushSubscription] unsubscribe:', e)
      setState('unsubscribed')
    }
  }

  return { state, subscribe, unsubscribe }
}
```

- [ ] **Step 2: WebPushButton'ı hook'u kullanacak şekilde sadeleştir**

`app/(dashboard)/ayarlar/WebPushButton.tsx` dosyasının TAMAMI şu hale gelir (JSX/metinler değişmedi):

```tsx
// app/(dashboard)/ayarlar/WebPushButton.tsx
'use client'

import { usePushSubscription } from '../usePushSubscription'

export default function WebPushButton() {
  const { state, subscribe, unsubscribe } = usePushSubscription()

  if (state === 'unsupported') return null

  return (
    <div className="flex items-center gap-3">
      {state === 'subscribed' ? (
        <>
          <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            Tarayıcı bildirimleri açık
          </span>
          <button
            onClick={unsubscribe}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors underline"
          >
            Kapat
          </button>
        </>
      ) : state === 'denied' ? (
        <span className="text-sm text-amber-600 dark:text-amber-400">
          Bildirim izni reddedildi — tarayıcı ayarlarından etkinleştirin
        </span>
      ) : (
        <button
          onClick={subscribe}
          disabled={state === 'loading'}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          {state === 'loading' ? 'Yükleniyor...' : 'Tarayıcı bildirimleri aç'}
        </button>
      )}
    </div>
  )
}
```

Not: "Kapat" butonundaki mevcut `text-gray-400` sınıfı BİLİNÇLİ korunur — bu bir refactor, görsel değişiklik turu değil (davranış-birebir sözleşmesi).

- [ ] **Step 3: Tip kontrolü + tüm birim testler**

Run: `npx tsc --noEmit && npm run test:unit`
Expected: her ikisi de temiz

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/usePushSubscription.ts" "app/(dashboard)/ayarlar/WebPushButton.tsx"
git commit -m "feat(push): abonelik durum makinesi usePushSubscription hook'una çıkarıldı (DRY)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: PushTesvikSeridi bileşeni + layout entegrasyonu

**Files:**
- Create: `app/(dashboard)/PushTesvikSeridi.tsx`
- Modify: `app/(dashboard)/layout.tsx:34` (`<main>` içinde `{children}` öncesine bileşen) + import

**Interfaces:**
- Consumes: Task 1 `shouldShowPushNudge`/`NUDGE_STORAGE_KEY`; Task 2 `usePushSubscription` (`state`, `subscribe`).

- [ ] **Step 1: Bileşeni yaz**

```tsx
// app/(dashboard)/PushTesvikSeridi.tsx
'use client'

import { useEffect, useState } from 'react'
import { usePushSubscription } from './usePushSubscription'
import { shouldShowPushNudge, NUDGE_STORAGE_KEY } from '@/src/domains/dashboard/lib/pushNudge'

// Push teşvik şeridi: abone olmayan kullanıcıya nazik hatırlatma.
// İlk boyamada gizli (async kontrol); "Daha sonra" 14 gün susturur (localStorage);
// abone olunca / izin reddedilince kaybolur. Spec: 2026-07-04-push-tesvik-seridi-design.md
export default function PushTesvikSeridi() {
  const { state, subscribe } = usePushSubscription()
  const [snoozed, setSnoozed] = useState<boolean | null>(null) // null = henüz bakılmadı (ilk boyama gizli)
  const [busy, setBusy] = useState(false)
  const [justEnabled, setJustEnabled] = useState(false)

  useEffect(() => {
    let dismissedAt: string | null = null
    try {
      dismissedAt = localStorage.getItem(NUDGE_STORAGE_KEY)
    } catch {
      // gizli mod vb. — snooze okunamazsa göster (fail-open)
    }
    setSnoozed(!shouldShowPushNudge(dismissedAt))
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(NUDGE_STORAGE_KEY, new Date().toISOString())
    } catch {
      // yazılamazsa bir dahaki sefere yine görünür — kabul edilmiş davranış
    }
    setSnoozed(true)
  }

  async function enable() {
    setBusy(true)
    await subscribe()
    setBusy(false)
    setJustEnabled(true)
  }

  if (snoozed !== false) return null

  // Başarı: bu oturumda abone olundu → kısa onay (yenilemede tamamen kaybolur)
  if (justEnabled && state === 'subscribed') {
    return (
      <div className="px-4 pt-4 md:px-6 max-w-6xl mx-auto">
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          Bildirimler açıldı ✓ — sabah özetin artık telefonuna gelecek.
        </div>
      </div>
    )
  }

  // unsupported / denied / (önceden) subscribed / ilk-yükleme loading → gizli
  if (state !== 'unsubscribed' && !busy) return null

  return (
    <div className="px-4 pt-4 md:px-6 max-w-6xl mx-auto">
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
        <span aria-hidden>🔔</span>
        <span className="text-sm text-gray-700 dark:text-slate-300 flex-1 min-w-48">
          Sabah özetini ve bildirimleri telefonuna al
        </span>
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
        >
          {busy ? 'Açılıyor…' : 'Bildirimleri aç'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Daha sonra hatırlat"
          className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-2 py-2 transition-colors"
        >
          Daha sonra
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: layout.tsx'e bağla**

`app/(dashboard)/layout.tsx` — import bloğuna ekle:

```tsx
import PushTesvikSeridi from './PushTesvikSeridi'
```

`<main>` satırını değiştir (satır 34):

```tsx
// ESKİ:
          <main className="flex-1 overflow-auto pt-14 md:pt-0 pb-16 md:pb-0 mobile-main print:overflow-visible print:pt-0">{children}</main>
// YENİ:
          <main className="flex-1 overflow-auto pt-14 md:pt-0 pb-16 md:pb-0 mobile-main print:overflow-visible print:pt-0"><PushTesvikSeridi />{children}</main>
```

- [ ] **Step 3: Tip kontrolü + tüm birim testler**

Run: `npx tsc --noEmit && npm run test:unit`
Expected: her ikisi de temiz

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/PushTesvikSeridi.tsx" "app/(dashboard)/layout.tsx"
git commit -m "feat(push): dashboard'a push teşvik şeridi (14 gün snooze'lu)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Final doğrulama (build + e2e) + push

**Files:**
- Yok (yalnız doğrulama + push)

**Interfaces:**
- Consumes: Task 1-3'ün tamamı.

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 2: E2e (şerit layout'ta — tüm sayfaları etkiler, koşulmalı)**

Run: `npm run test:e2e`
Expected: 67 passed
⚠️ Risk: Playwright chromium'da `Notification.permission === 'default'` + abonelik yok + VAPID key `.env.local`'de tanımlı → şerit login'li TÜM sayfalarda mount-sonrası görünür. Genel seçicili bir spec kırılırsa: kırılan spec'in seçicisini hedef bölüme daraltın (örn. `main section`, `h1` bazlı) — şeridi gizlemeye/koşullu render etmeye ÇALIŞMAYIN.
Not: Playwright kendi sunucusunu `next dev --webpack` ile başlatır (config'de hazır). Turbopack YASAK.

- [ ] **Step 3: Push**

```bash
git push origin main
```

Expected: main güncellenir, Vercel deploy alır. MANUEL SMOKE (kullanıcıyla): dev/prod'da şerit görünür → "Bildirimleri aç" → izin → "açıldı ✓" → yenile → şerit yok; ayrı profide "Daha sonra" → yenile → yok.
