import type { Metadata } from 'next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EduDesk',
  description: 'Öğretmen yönetim paneli',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="h-full">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const t = localStorage.getItem('theme');
            if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme:dark)').matches))
              document.documentElement.classList.add('dark');
          } catch {}
        ` }} />
      </head>
      <body className="h-full antialiased">
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
