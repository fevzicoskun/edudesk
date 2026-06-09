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
