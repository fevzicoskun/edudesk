# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `myedudesk.com.tr` için hibrit landing page — pazarlama içeriği + mevcut kullanıcı girişi, WhatsApp CTA ile.

**Architecture:** 6 odaklı server component (`LandingNavbar`, `LandingHero`, `LandingFeatures`, `LandingHowItWorks`, `LandingForWhom`, `LandingFooter`) `app/components/landing/` altında toplanır. `app/page.tsx`'teki `redirect('/login')` kaldırılır, landing render edilir. Middleware'deki `if (user && pathname === '/')` → `/anasayfa` redirect'i mevcut olduğu için giriş yapmış kullanıcılar landing'i görmez.

**Tech Stack:** Next.js 16 App Router, Tailwind v4, server components, `NEXT_PUBLIC_WHATSAPP_NUMBER` env var

---

## Dosya Haritası

| İşlem | Dosya |
|-------|-------|
| Oluştur | `app/components/landing/whatsapp.ts` |
| Oluştur | `app/components/landing/LandingNavbar.tsx` |
| Oluştur | `app/components/landing/LandingHero.tsx` |
| Oluştur | `app/components/landing/LandingFeatures.tsx` |
| Oluştur | `app/components/landing/LandingHowItWorks.tsx` |
| Oluştur | `app/components/landing/LandingForWhom.tsx` |
| Oluştur | `app/components/landing/LandingFooter.tsx` |
| Oluştur | `tests/vitest/unit/landing/whatsapp.test.ts` |
| Değiştir | `app/page.tsx` |

---

### Task 1: WhatsApp URL yardımcısı + test

**Files:**
- Create: `app/components/landing/whatsapp.ts`
- Create: `tests/vitest/unit/landing/whatsapp.test.ts`

- [ ] **Step 1: Başarısız test yaz**

```ts
// tests/vitest/unit/landing/whatsapp.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const ORIG_ENV = { ...process.env }

beforeEach(() => {
  vi.resetModules()
  process.env = { ...ORIG_ENV }
})

afterEach(() => {
  process.env = { ...ORIG_ENV }
})

describe('getWhatsAppHref()', () => {
  it('env var ayarlandığında doğru wa.me URL üretir', async () => {
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER = '905551234567'
    const { getWhatsAppHref } = await import('@/app/components/landing/whatsapp')
    const href = getWhatsAppHref()
    expect(href).toBe(
      'https://wa.me/905551234567?text=EduDesk%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum'
    )
  })

  it('env var yokken fallback numarasıyla URL üretir', async () => {
    delete process.env.NEXT_PUBLIC_WHATSAPP_NUMBER
    const { getWhatsAppHref } = await import('@/app/components/landing/whatsapp')
    const href = getWhatsAppHref()
    expect(href).toContain('wa.me/')
    expect(href).toContain('EduDesk')
  })
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

```bash
npx vitest run tests/vitest/unit/landing/whatsapp.test.ts
```

Beklenen: `FAIL` — `Cannot find module '@/app/components/landing/whatsapp'`

- [ ] **Step 3: Yardımcı fonksiyonu yaz**

```ts
// app/components/landing/whatsapp.ts
const WA_MESSAGE = 'EduDesk hakkında bilgi almak istiyorum'

export function getWhatsAppHref(): string {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '905000000000'
  return `https://wa.me/${number}?text=${encodeURIComponent(WA_MESSAGE)}`
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

```bash
npx vitest run tests/vitest/unit/landing/whatsapp.test.ts
```

Beklenen: `PASS` — 2 test

- [ ] **Step 5: Commit**

```bash
git add app/components/landing/whatsapp.ts tests/vitest/unit/landing/whatsapp.test.ts
git commit -m "feat(landing): WhatsApp URL yardımcısı + 2 test"
```

---

### Task 2: LandingNavbar

**Files:**
- Create: `app/components/landing/LandingNavbar.tsx`

- [ ] **Step 1: Bileşeni yaz**

```tsx
// app/components/landing/LandingNavbar.tsx
import Link from 'next/link'
import EduDeskLogo from '@/components/EduDeskLogo'
import { getWhatsAppHref } from './whatsapp'

export default function LandingNavbar() {
  const waHref = getWhatsAppHref()
  return (
    <nav className="sticky top-0 z-50 border-b border-stone-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <EduDeskLogo size="md" />
        <div className="flex items-center gap-3">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            WhatsApp&apos;tan Bilgi Al
          </a>
          <Link
            href="/login"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            Giriş Yap →
          </Link>
        </div>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: TypeScript doğrula**

```bash
npx tsc --noEmit
```

Beklenen: 0 hata

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/LandingNavbar.tsx
git commit -m "feat(landing): LandingNavbar bileşeni"
```

---

### Task 3: LandingHero

**Files:**
- Create: `app/components/landing/LandingHero.tsx`

- [ ] **Step 1: Bileşeni yaz**

```tsx
// app/components/landing/LandingHero.tsx
import Link from 'next/link'
import { getWhatsAppHref } from './whatsapp'

export default function LandingHero() {
  const waHref = getWhatsAppHref()
  return (
    <section className="bg-gradient-to-b from-emerald-50 to-stone-50 px-4 py-20 text-center">
      <div className="mx-auto max-w-3xl">
        <span className="mb-4 inline-block rounded-full bg-emerald-100 px-4 py-1 text-sm font-medium text-emerald-800">
          Türk okulları için tasarlandı
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
          Okulunuzun tüm takibini{' '}
          <span className="text-emerald-600">tek ekranda</span> yapın
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-stone-600">
          Yoklama, ödev, veli iletişimi ve zümre toplantıları — hepsi bir arada.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-xl bg-orange-500 px-8 py-4 text-base font-semibold text-white shadow-md hover:bg-orange-600 transition-colors sm:w-auto"
          >
            📱 WhatsApp&apos;tan Bilgi Al
          </a>
          <Link
            href="/login"
            className="w-full rounded-xl border border-stone-300 px-8 py-4 text-base font-semibold text-stone-700 hover:bg-stone-100 transition-colors sm:w-auto"
          >
            Giriş Yap →
          </Link>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: TypeScript doğrula**

```bash
npx tsc --noEmit
```

Beklenen: 0 hata

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/LandingHero.tsx
git commit -m "feat(landing): LandingHero bileşeni"
```

---

### Task 4: LandingFeatures

**Files:**
- Create: `app/components/landing/LandingFeatures.tsx`

- [ ] **Step 1: Bileşeni yaz**

```tsx
// app/components/landing/LandingFeatures.tsx
const FEATURES = [
  {
    icon: '✅',
    title: 'Yoklama Takibi',
    desc: 'Günlük yoklama, devamsızlık trendi ve otomatik veli bildirimi tek yerden.',
  },
  {
    icon: '📚',
    title: 'Ödev Yönetimi',
    desc: 'Teslim takibi, tamamlanma oranı ve gecikme uyarıları anlık görünür.',
  },
  {
    icon: '👨‍👩‍👧',
    title: 'Veli Portalı',
    desc: 'QR bağlantı ile anında erişim; veliler çocuğunun durumunu her an görür.',
  },
  {
    icon: '📊',
    title: 'Analitik Dashboard',
    desc: 'Risk analizi, sınıf karşılaştırması ve trend grafikleriyle hızlı karar alın.',
  },
  {
    icon: '📋',
    title: 'Zümre Toplantıları',
    desc: 'Toplantı notları, alınan kararlar ve müfredat planı dijital ortamda.',
  },
  {
    icon: '⚙️',
    title: 'Okul Yönetimi',
    desc: 'Öğretmen rolleri, okul ayarları ve sistem kontrolü tek panelde.',
  },
] as const

export default function LandingFeatures() {
  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-4 text-center text-3xl font-bold text-stone-900">
          Her şey burada
        </h2>
        <p className="mb-12 text-center text-stone-500">
          Okulunuzun ihtiyaç duyduğu tüm araçlar tek bir platformda
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="mb-3 text-3xl">{f.icon}</div>
              <h3 className="mb-2 text-lg font-semibold text-stone-900">{f.title}</h3>
              <p className="text-sm leading-relaxed text-stone-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: TypeScript doğrula**

```bash
npx tsc --noEmit
```

Beklenen: 0 hata

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/LandingFeatures.tsx
git commit -m "feat(landing): LandingFeatures bileşeni"
```

---

### Task 5: LandingHowItWorks

**Files:**
- Create: `app/components/landing/LandingHowItWorks.tsx`

- [ ] **Step 1: Bileşeni yaz**

```tsx
// app/components/landing/LandingHowItWorks.tsx
const STEPS = [
  {
    num: '1',
    title: 'Okulunuzu kurun',
    desc: '10 dakikada okul profilinizi ve sınıflarınızı oluşturun.',
  },
  {
    num: '2',
    title: 'Öğretmenlerinizi davet edin',
    desc: 'Davet bağlantısıyla öğretmenleriniz hemen sisteme katılır.',
  },
  {
    num: '3',
    title: 'Takibe başlayın',
    desc: 'Yoklama, ödev ve veli iletişiminiz tek panelde hazır.',
  },
] as const

export default function LandingHowItWorks() {
  return (
    <section className="bg-stone-50 px-4 py-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-12 text-center text-3xl font-bold text-stone-900">
          Nasıl çalışır?
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.num} className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">
                {s.num}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-stone-900">{s.title}</h3>
              <p className="text-sm leading-relaxed text-stone-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: TypeScript doğrula**

```bash
npx tsc --noEmit
```

Beklenen: 0 hata

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/LandingHowItWorks.tsx
git commit -m "feat(landing): LandingHowItWorks bileşeni"
```

---

### Task 6: LandingForWhom

**Files:**
- Create: `app/components/landing/LandingForWhom.tsx`

- [ ] **Step 1: Bileşeni yaz**

```tsx
// app/components/landing/LandingForWhom.tsx
const PERSONAS = [
  {
    emoji: '🏫',
    title: 'Okul Müdürü',
    desc: 'Okul geneli görünüm, öğretmen aktivitesi, anlık raporlar ve sistem yönetimi.',
  },
  {
    emoji: '👩‍🏫',
    title: 'Öğretmen',
    desc: 'Yoklama, ödev takibi ve not defteri — tüm sınıf yönetimi tek ekranda.',
  },
  {
    emoji: '👨‍👩‍👧',
    title: 'Veli',
    desc: 'Çocuğunuzun devamsızlık ve ödev durumunu her an, her yerden görün.',
  },
] as const

export default function LandingForWhom() {
  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-12 text-center text-3xl font-bold text-stone-900">
          Kimler için?
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {PERSONAS.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-orange-100 bg-orange-50 p-6"
            >
              <div className="mb-3 text-4xl">{p.emoji}</div>
              <h3 className="mb-2 text-lg font-semibold text-stone-900">{p.title}</h3>
              <p className="text-sm leading-relaxed text-stone-600">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: TypeScript doğrula**

```bash
npx tsc --noEmit
```

Beklenen: 0 hata

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/LandingForWhom.tsx
git commit -m "feat(landing): LandingForWhom bileşeni"
```

---

### Task 7: LandingFooter

**Files:**
- Create: `app/components/landing/LandingFooter.tsx`

- [ ] **Step 1: Bileşeni yaz**

```tsx
// app/components/landing/LandingFooter.tsx
import Link from 'next/link'
import { getWhatsAppHref } from './whatsapp'

export default function LandingFooter() {
  const waHref = getWhatsAppHref()
  return (
    <footer className="border-t border-stone-200 bg-stone-900 px-4 py-16 text-center">
      <div className="mx-auto max-w-4xl">
        <p className="mb-2 text-xl font-semibold text-white">
          Okulunuz için EduDesk&apos;i deneyin
        </p>
        <p className="mb-8 text-stone-400">
          Fiyat ve detaylar için bizimle iletişime geçin.
        </p>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-xl bg-emerald-600 px-8 py-4 text-base font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          📱 WhatsApp&apos;tan Bilgi Al
        </a>
        <div className="mt-12 flex justify-center gap-6 text-sm text-stone-500">
          <Link href="/gizlilik" className="hover:text-stone-300 transition-colors">
            Gizlilik Politikası
          </Link>
          <Link href="/kullanim-kosullari" className="hover:text-stone-300 transition-colors">
            Kullanım Koşulları
          </Link>
        </div>
        <p className="mt-6 text-xs text-stone-600">© 2026 EduDesk. Tüm hakları saklıdır.</p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: TypeScript doğrula**

```bash
npx tsc --noEmit
```

Beklenen: 0 hata

- [ ] **Step 3: Commit**

```bash
git add app/components/landing/LandingFooter.tsx
git commit -m "feat(landing): LandingFooter bileşeni"
```

---

### Task 8: app/page.tsx güncelleme + metadata + build doğrulama

**Files:**
- Modify: `app/page.tsx`

**Bağlam:** Middleware `proxy.ts` satır 193 — `if (user && pathname === '/')` → `/anasayfa` redirect var. Giriş yapmış kullanıcılar landing'i görmez. `redirect('/login')` kaldırıp landing render edilebilir.

- [ ] **Step 1: app/page.tsx'i güncelle**

Mevcut içerik:
```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/login')
}
```

Yeni içerik:
```tsx
import type { Metadata } from 'next'
import LandingNavbar from '@/app/components/landing/LandingNavbar'
import LandingHero from '@/app/components/landing/LandingHero'
import LandingFeatures from '@/app/components/landing/LandingFeatures'
import LandingHowItWorks from '@/app/components/landing/LandingHowItWorks'
import LandingForWhom from '@/app/components/landing/LandingForWhom'
import LandingFooter from '@/app/components/landing/LandingFooter'

export const metadata: Metadata = {
  title: 'EduDesk — Okulunuzun tüm takibi tek ekranda',
  description:
    'Yoklama, ödev, veli iletişimi ve zümre toplantıları. Türk okulları için tasarlanmış okul yönetim platformu.',
}

export default function HomePage() {
  return (
    <main>
      <LandingNavbar />
      <LandingHero />
      <LandingFeatures />
      <LandingHowItWorks />
      <LandingForWhom />
      <LandingFooter />
    </main>
  )
}
```

- [ ] **Step 2: TypeScript doğrula**

```bash
npx tsc --noEmit
```

Beklenen: 0 hata

- [ ] **Step 3: Tüm testleri çalıştır**

```bash
npm run test:unit
```

Beklenen: 702/702 test PASS (700 mevcut + 2 yeni whatsapp testi)

- [ ] **Step 4: Production build doğrula**

```bash
npm run build
```

Beklenen: 0 hata, `/` route'u static olarak derlenir

- [ ] **Step 5: Son commit**

```bash
git add app/page.tsx
git commit -m "feat(landing): landing page tamamlandı — 6 bileşen, SEO metadata, 702 test"
git push origin main
```

---

## Sonrası

- Vercel'e `NEXT_PUBLIC_WHATSAPP_NUMBER` env var ekle (format: `905XXXXXXXXX`, başında + yok)
- Yapılacak: `/gizlilik` ve `/kullanim-kosullari` sayfaları mevcut, footer linkleri çalışır
- İsteğe bağlı: `public:` rate-limit bucket'ı landing için yeterli (60 req/dk/IP, `proxy.ts:161`)
