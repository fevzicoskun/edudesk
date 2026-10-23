'use client'
import { useLayoutEffect, useRef, type ReactNode } from 'react'

// A4 baskı alanı (globals.css body dolgusu 15mm × 14mm): 297 − 30 = 267mm yükseklik, 210 − 28 = 182mm genişlik
const YUKSEKLIK_MM = 267
const GENISLIK_MM = 182
const PAY = 0.97 // break-inside-avoid kutuları ve yuvarlama için

/** İçeriği baskıda tek A4'e sığdırır: gerçek yüksekliği baskı genişliğinde ölçer, taşıyorsa YALNIZ baskıda `zoom` ile küçültür.
 *  2026-10-24: satır tahmini (dengeliBol yükü) gerçek kâğıtta 8 planın 5'ini 2. sayfaya taşırdı, zımbalamak gerekti.
 *  ponytail: zoom alt sınırı yok — aşırı yükte yazı küçülür ama kâğıt yine tek sayfa kalır. */
export default function TekSayfa({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const olc = () => {
      el.style.width = `${GENISLIK_MM}mm`
      const yukseklik = el.scrollHeight
      el.style.width = ''
      const sinir = (YUKSEKLIK_MM * 96) / 25.4
      const k = Math.min(1, (sinir * PAY) / yukseklik)
      el.style.setProperty('--sigdir', String(k))
      el.dataset.olcek = k.toFixed(2)
    }
    olc()
    document.fonts.ready.then(olc)
    window.addEventListener('beforeprint', olc)
    return () => window.removeEventListener('beforeprint', olc)
  }, [])
  return <div ref={ref} className="print:[zoom:var(--sigdir,1)]">{children}</div>
}
