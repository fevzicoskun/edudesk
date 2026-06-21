import type { MetadataRoute } from 'next'

const BASE = 'https://myedudesk.com.tr'

// Public pazarlama/yasal sayfalar. App ve veli portalı auth-gated → sitemap dışı.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: BASE,                          lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: `${BASE}/platform`,            lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/gizlilik`,            lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/kullanim-kosullari`,  lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ]
}
