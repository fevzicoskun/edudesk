const APP_SHELL = 'app-shell-v2'
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

// --- Push Notification Handler ---
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
