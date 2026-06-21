import type { MetadataRoute } from 'next'

const BASE = 'https://myedudesk.com.tr'

// Yalnız public pazarlama sayfaları taransın; auth-gated app, veli portalı (token'lı)
// ve API taramaya kapalı.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/veli/',
        '/anasayfa',
        '/yoklama',
        '/odevler',
        '/siniflar',
        '/ders-programi',
        '/ayarlar',
        '/profil',
        '/kullanicilar',
        '/yonetim',
        '/rapor',
        '/onboarding',
        '/login',
        '/kayit',
        '/sifremi-unuttum',
        '/offline',
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  }
}
