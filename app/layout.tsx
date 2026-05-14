import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'

export const metadata: Metadata = {
  title: 'EduDesk',
  description: 'Öğretmen yönetim paneli',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? ''

  return (
    <html lang="tr" className="h-full">
      <head>
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
