# EduDesk — PWA Tamamlama

**Tarih:** 2026-06-12  
**Kapsam:** SW otomatik kayıt, offline caching, install prompt, manifest shortcuts, iOS meta tags

---

## Mevcut Durum

- `manifest.json` var (temel, ikonlar, display:standalone)
- `public/sw.js` var — sadece push handler, caching/offline yok
- `WebPushButton.tsx` — SW'yi sadece push subscribe sırasında kaydediyor
- SW layout'ta kayıtlı değil → Chrome install butonu çıkmıyor

---

## Mimari

Vanilla Service Worker (Workbox yok) — mevcut sw.js genişletilir, next-pwa gibi build pipeline değişikliği gerektirmez.

### 1 — SW Otomatik Kayıt + Install Prompt (`ServiceWorkerInit.tsx`)

`app/layout.tsx`'e eklenen `'use client'` bileşeni:
- Sayfa yüklenince `navigator.serviceWorker.register('/sw.js')` çalıştırır
- `beforeinstallprompt` event'ini yakalar, `window.__pwaInstallPrompt` olarak saklar
- `pwa-install-ready` custom event fırlatır → `InstallBanner` dinler

### 2 — Caching Stratejisi (`public/sw.js` genişletme)

Mevcut push handler korunur. Fetch handler eklenir:

| İstek tipi | Strateji |
|---|---|
| Navigation (HTML) | Network-first → offline fallback (`/offline`) |
| Static assets (`/_next/static/`) | Cache-first (immutable) |
| Font dosyaları | Cache-first |
| API/Supabase | Network-only (veri stale olmasın) |

Cache isimleri versiyonlanan (`app-shell-v1`, `static-v1`) — SW `activate`'te eski cache'ler temizlenir.

### 3 — Offline Fallback (`app/offline/page.tsx`)

Statik sayfa, build sırasında SW cache'ine eklenir:
- "İnternet bağlantısı yok" mesajı
- Son online zamanı (localStorage'dan)
- "Yeniden dene" butonu (`window.location.reload()`)

### 4 — Install Banner (`components/InstallBanner.tsx`)

Client component, layout'ta render edilir:
- `pwa-install-ready` event gelince görünür
- "Ana ekrana ekle" butonu → `__pwaInstallPrompt.prompt()` çağırır
- Kullanıcı kabul ederse veya reddederse banner kaybolur
- `localStorage`'da `pwa-install-dismissed` → bir kez kapatınca tekrar göstermez
- Mobil tabanlı, bottom banner (desktop'ta gizli)

### 5 — Manifest Shortcuts

```json
"shortcuts": [
  { "name": "Yoklama Al", "url": "/yoklama", "icons": [...] },
  { "name": "Ödevler",    "url": "/odevler",  "icons": [...] }
]
```

### 6 — iOS Meta Tags (`app/layout.tsx`)

```html
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
```
(appleWebApp zaten var, eksik olanlar eklenir)

---

## Dosya Değişiklikleri

| Dosya | Değişiklik |
|---|---|
| `public/sw.js` | Fetch handler + cache stratejisi eklenir |
| `app/offline/page.tsx` | Yeni — offline fallback |
| `app/components/ServiceWorkerInit.tsx` | Yeni — SW kayıt + install prompt event |
| `app/components/InstallBanner.tsx` | Yeni — "Ana ekrana ekle" UI |
| `app/layout.tsx` | ServiceWorkerInit + InstallBanner eklenir |
| `public/manifest.json` | shortcuts + id alanı eklenir |

---

## Test

- Lighthouse PWA audit (hedef: tüm checkmark'lar)
- Chrome DevTools → Application → Service Workers: registered ✓
- Network tab "Offline" → offline sayfası görünür
- Mobile Chrome: install banner tetiklenir
- iOS Safari: "Paylaş → Ana Ekrana Ekle" çalışır

---

## Kapsam Dışı

- Workbox / next-pwa entegrasyonu
- Background sync (form submit offline iken)
- Periodic background sync
