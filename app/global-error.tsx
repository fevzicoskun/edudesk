'use client'

import { useEffect } from 'react'
import { reportClientError } from '@/app/actions/error-report'

// Root-level error boundary — yakalanacak layoutlar: app/layout.tsx
// error.tsx'in aksine <html> ve <body> içermek zorunda
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportClientError({
      message: (error.message || 'Bilinmeyen global hata').slice(0, 500),
      digest:  error.digest,
      url:     typeof window !== 'undefined' ? window.location.href.slice(0, 200) : undefined,
    }).catch(() => { /* raporlama hatası UI'ı etkilemesin */ })
  }, [error])

  return (
    <html lang="tr">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f9fafb' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <p style={{ fontSize: '3.5rem', fontWeight: 700, color: '#e5e7eb', margin: 0 }}>!</p>
            <h1 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', marginTop: '1rem' }}>
              Uygulama yüklenemedi
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
              Beklenmedik bir hata oluştu. Lütfen sayfayı yenileyin.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: '1.5rem',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.625rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Tekrar dene
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
