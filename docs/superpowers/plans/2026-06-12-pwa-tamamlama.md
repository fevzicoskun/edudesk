# PWA Tamamlama — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** EduDesk'i tam PWA yaparak Chrome/Safari'de "Ana ekrana ekle" prompt'u, offline fallback ve navigation caching sağlamak.

**Architecture:** Vanilla SW (Workbox yok, next-pwa yok) — mevcut `public/sw.js` genişletilir. SW otomatik kayıt + `beforeinstallprompt` capture için `ServiceWorkerInit` istemci bileşeni `app/layout.tsx`'e eklenir. Navigation → network-first/offline-fallback, static assets → cache-first.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, vanilla Service Worker API

---

## Dosya Haritası

| Dosya | Değişiklik |
|---|---|
| `public/manifest.json` | `id` + `shortcuts` eklenir |
| `public/sw.js` | install/activate/fetch handler eklenir (push handler korunur) |
| `app/offline/page.tsx` | YENİ — offline fallback sayfası |
| `app/components/ServiceWorkerInit.tsx` | YENİ — SW kayıt + `beforeinstallprompt` capture |
| `app/components/InstallBanner.tsx` | YENİ — "Ana ekrana ekle" mobil banner |
| `app/layout.tsx` | `ServiceWorkerInit` + `InstallBanner` + last-online script eklenir |

---

### Task 1: manifest.json — id ve shortcuts

**Files:**
- Modify: `public/manifest.json`

- [ ] **Step 1: manifest.json'u güncelle**

`public/manifest.json` içeriğini tamamen şununla değiştir:

```json
{
  "id": "/",
  "name": "EduDesk",
  "short_name": "EduDesk",
  "description": "Öğretmen yönetim paneli",
  "start_url": "/anasayfa",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#4361ee",
  "lang": "tr",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml"
    }
  ],
  "categories": ["education", "productivity"],
  "shortcuts": [
    {
      "name": "Yoklama Al",
      "short_name": "Yoklama",
      "url": "/yoklama",
      "icons": [{ "src": "/icon-192.png", "sizes": "192x192" }]
    },
    {
      "name": "Ödevler",
      "short_name": "Ödevler",
      "url": "/odevler",
      "icons": [{ "src": "/icon-192.png", "sizes": "192x192" }]
    }
  ],
  "screenshots": []
}
```

- [ ] **Step 2: Commit**

```bash
git add public/manifest.json
git commit -m "feat(pwa): manifest shortcuts + canonical id"
```

---

### Task 2: Offline Fallback Sayfası

**Files:**
- Create: `app/offline/page.tsx`

- [ ] **Step 1: Dosyayı oluştur**

```tsx
'use client'

import { useEffect, useState } from 'react'
import EduDeskLogo from '@/components/EduDeskLogo'

export default function OfflinePage() {
  const [lastOnline, setLastOnline] = useState<string | null>(null)

  useEffect(() => {
    try {
      const t = localStorage.getItem('edudesk-last-online')
      if (t) setLastOnline(new Date(t).toLocaleString('tr-TR'))
    } catch {}
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center px-6 text-center">
      <EduDeskLogo size="lg" className="mb-6" />
      <div className="text-5xl mb-4">📡</div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        İnternet bağlantısı yok
      </h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 max-w-xs">
        Bağlantınızı kontrol edip tekrar deneyin.
        {lastOnline && (
          <>
            <br />
            <span className="text-xs">Son çevrimiçi: {lastOnline}</span>
          </>
        )}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Yeniden dene
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/offline/page.tsx
git commit -m "feat(pwa): offline fallback page"
```

---

### Task 3: Service Worker — Caching Stratejisi

**Files:**
- Modify: `public/sw.js`

- [ ] **Step 1: sw.js'i tamamen yeniden yaz**

Mevcut push handler'ı koru, başına install/activate/fetch handler'ları ekle:

```js
const APP_SHELL = 'app-shell-v1'
const STATIC_CACHE = 'static-v1'
const OFFLINE_URL = '/offline'

// Install: offline sayfasını cache'e al
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL).then((cache) => cache.add(OFFLINE_URL))
  )
  self.skipWaiting()
})

// Activate: eski cache versiyonlarını temizle
self.addEventListener('activate', (event) => {
  const keep = [APP_SHELL, STATIC_CACHE]
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// Fetch
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // API, Supabase, Inngest → network only (veri stale olmasın)
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname !== self.location.hostname
  ) {
    return
  }

  // Next.js static chunk'ları → cache-first (immutable, hash'li URL'ler)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) cache.put(request, response.clone())
        return response
      })
    )
    return
  }

  // HTML navigation → network-first, bağlantı yoksa offline sayfası
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(APP_SHELL)
        return (await cache.match(OFFLINE_URL)) ?? Response.error()
      })
    )
    return
  }
})

// --- Push Notification Handler (mevcut, dokunma) ---
self.addEventListener('push', (event) => {
  if (!event.data) return
  const { title, body, url, icon } = event.data.json()
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon ?? '/icon.svg',
      badge: '/icon.svg',
      data: { url: url ?? '/' },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      return clients.openWindow(target)
    })
  )
})
```

- [ ] **Step 2: Commit**

```bash
git add public/sw.js
git commit -m "feat(pwa): service worker caching — app shell + static cache + offline fallback"
```

---

### Task 4: ServiceWorkerInit Bileşeni

SW'yi sayfa yüklenince otomatik kaydeder, `beforeinstallprompt`'u yakalar.

**Files:**
- Create: `app/components/ServiceWorkerInit.tsx`

- [ ] **Step 1: Dosyayı oluştur**

```tsx
'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    __pwaInstallPrompt?: BeforeInstallPromptEvent
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function ServiceWorkerInit() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('[SW] Kayıt hatası:', err)
    })

    const handler = (e: Event) => {
      e.preventDefault()
      window.__pwaInstallPrompt = e as BeforeInstallPromptEvent
      window.dispatchEvent(new CustomEvent('pwa-install-ready'))
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/ServiceWorkerInit.tsx
git commit -m "feat(pwa): ServiceWorkerInit — auto-register SW + capture install prompt"
```

---

### Task 5: InstallBanner Bileşeni

Mobilde "Ana ekrana ekle" banner'ı gösterir.

**Files:**
- Create: `app/components/InstallBanner.tsx`

- [ ] **Step 1: Dosyayı oluştur**

```tsx
'use client'

import { useEffect, useState } from 'react'

const DISMISSED_KEY = 'pwa-install-dismissed'

export default function InstallBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return
    } catch {
      return
    }

    const show = () => setVisible(true)
    window.addEventListener('pwa-install-ready', show)
    return () => window.removeEventListener('pwa-install-ready', show)
  }, [])

  async function handleInstall() {
    const prompt = window.__pwaInstallPrompt
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      try { localStorage.setItem(DISMISSED_KEY, '1') } catch {}
    }
    setVisible(false)
  }

  function handleDismiss() {
    try { localStorage.setItem(DISMISSED_KEY, '1') } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:hidden">
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-2xl shadow-lg p-4 flex items-center gap-3">
        <img src="/icon-192.png" alt="EduDesk" className="w-10 h-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Ana ekrana ekle</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">Hızlı erişim için yükle</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleDismiss}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 px-2 py-1 transition-colors"
            aria-label="Kapat"
          >
            Kapat
          </button>
          <button
            onClick={handleInstall}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Yükle
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/InstallBanner.tsx
git commit -m "feat(pwa): InstallBanner — mobile install prompt UI"
```

---

### Task 6: layout.tsx Entegrasyonu

SW kayıt + install banner'ı layout'a bağla, last-online timestamp'i tut.

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: layout.tsx'i güncelle**

Mevcut `app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'

export const metadata: Metadata = {
  title: 'EduDesk',
  description: 'Öğretmen yönetim paneli',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'EduDesk',
    statusBarStyle: 'default',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? ''

  return (
    <html lang="tr" className="h-full">
      <head>
        <meta name="theme-color" content="#4361ee" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        {/* Dark mode init — runs before paint, nonce whitelisted in CSP */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch{}`
          }}
        />
      </head>
      <body className="h-full antialiased">{children}</body>
    </html>
  )
}
```

Bunu şununla değiştir:

```tsx
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import ServiceWorkerInit from '@/app/components/ServiceWorkerInit'
import InstallBanner from '@/app/components/InstallBanner'
import './globals.css'

export const metadata: Metadata = {
  title: 'EduDesk',
  description: 'Öğretmen yönetim paneli',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'EduDesk',
    statusBarStyle: 'default',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? ''

  return (
    <html lang="tr" className="h-full">
      <head>
        <meta name="theme-color" content="#4361ee" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        {/* Dark mode init — runs before paint, nonce whitelisted in CSP */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `try{const t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch{}`
          }}
        />
        {/* Last-online timestamp — offline sayfasında "Son çevrimiçi" için */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `try{localStorage.setItem('edudesk-last-online',new Date().toISOString())}catch{}`
          }}
        />
      </head>
      <body className="h-full antialiased">
        <ServiceWorkerInit />
        <InstallBanner />
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: TypeScript derlemesini kontrol et**

```bash
npx tsc --noEmit
```

Beklenen: 0 hata

- [ ] **Step 3: Build al**

```bash
npm run build
```

Beklenen: başarılı build, hata yok

- [ ] **Step 4: Testleri çalıştır**

```bash
npm run test
```

Beklenen: tüm testler pass (694+ test, 0 fail)

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/components/ServiceWorkerInit.tsx app/components/InstallBanner.tsx app/offline/page.tsx public/sw.js public/manifest.json
git commit -m "feat(pwa): complete PWA — auto SW register, offline cache, install banner"
```

- [ ] **Step 6: Push**

```bash
git push origin main
```

---

## Manuel Test Kontrol Listesi (deploy sonrası)

Vercel deploy bittikten sonra Chrome DevTools ile:

1. **Application → Manifest**: tüm alanlar görünüyor, shortcuts var ✓
2. **Application → Service Workers**: Status "activated and running" ✓
3. **Network → Offline checkbox**: `/anasayfa` açık, offline yap → `/offline` sayfası görünür ✓
4. **Mobile Chrome**: adres barında install ikonu veya `InstallBanner` görünür ✓
5. **iOS Safari**: Paylaş → "Ana Ekrana Ekle" → uygulama standalone açılır ✓
6. **Shortcuts**: Android uzun basınca "Yoklama Al" ve "Ödevler" kısayolları görünür ✓
