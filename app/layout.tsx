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
        {/* Dark mode init — runs before paint, nonce whitelisted in CSP.
            Landing ('/') light-only marka sayfası — stone paleti dark override'ı yok,
            bu yüzden orada dark uygulanmaz (aksi halde koyu zeminde koyu yazı okunamaz). */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `try{if(location.pathname!=='/'){const t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}}catch{}`
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
