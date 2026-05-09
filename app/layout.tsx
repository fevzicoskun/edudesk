import type { Metadata } from 'next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Zümre Takip',
  description: 'Öğretmen zümre ve ödev takip sistemi',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="h-full">
      <body className="h-full antialiased">
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
