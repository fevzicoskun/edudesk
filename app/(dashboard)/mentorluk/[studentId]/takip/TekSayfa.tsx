'use client'
import { useLayoutEffect, useRef, type ReactNode } from 'react'

// A4 baskı alanı (globals.css body dolgusu 15mm × 14mm): 297 − 30 = 267mm yükseklik, 210 − 28 = 182mm genişlik
const YUKSEKLIK_MM = 267
const GENISLIK_MM = 182
const PAY = 0.97 // break-inside-avoid kutuları ve yuvarlama için

/** İçeriği baskıda tek A4'e sığdırır: gerçek yüksekliği baskı genişliğinde ölçer.
 *  Taşarsa önce boşluklar daralır (`data-sik` → çocuklarda group-data-[sik]:…), yine taşarsa YALNIZ baskıda `zoom`.
 *  2026-10-24: satır tahmini gerçek kâğıtta 9 planın 5'ini 2. sayfaya taşırdı; kullanıcı: "yazıyı değil boşlukları küçült".
 *  ponytail: zoom alt sınırı yok — aşırı yükte son çare yazı küçülür ama kâğıt yine tek sayfa kalır. */
export default function TekSayfa({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const sinir = ((YUKSEKLIK_MM * 96) / 25.4) * PAY
    const yukseklik = () => {
      el.style.width = `${GENISLIK_MM}mm`
      const h = el.scrollHeight
      el.style.width = ''
      return h
    }
    const olc = () => {
      delete el.dataset.sik
      if (yukseklik() > sinir) el.dataset.sik = ''
      const k = Math.min(1, sinir / yukseklik())
      el.style.setProperty('--sigdir', String(k))
      el.dataset.olcek = k.toFixed(2)
    }
    olc()
    document.fonts.ready.then(olc)
    window.addEventListener('beforeprint', olc)
    return () => window.removeEventListener('beforeprint', olc)
  }, [])
  return <div ref={ref} className="group print:[zoom:var(--sigdir,1)]">{children}</div>
}
