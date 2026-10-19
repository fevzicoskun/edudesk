'use client'

import { useEffect, useState } from 'react'

// Öğretmen isteği (2026-10-19): programı telefonda Fotoğraflar'a kaydetmek. Paylaşım menüsünden
// "Görüntüyü Kaydet" (iOS) / galeriye kaydet (Android). Paylaşım yoksa (masaüstü) PNG indirilir.
// Resmi sunucu çizer (/api/ders-programi/gorsel); önceden indirilir: iOS share()'i dokunmayla
// aynı görevde ister, araya await girerse reddeder.

const ADRES = '/api/ders-programi/gorsel'

async function resimAl(): Promise<File> {
  const r = await fetch(ADRES, { cache: 'no-store' })
  if (!r.ok) throw new Error(`gorsel ${r.status}`)
  return new File([await r.blob()], 'ders-programi.png', { type: 'image/png' })
}

export default function FotografaKaydet() {
  const [paylasilir, setPaylasilir] = useState(false)
  const [dosya, setDosya] = useState<File | null>(null)
  const [hata, setHata] = useState(false)

  useEffect(() => {
    const deneme = new File([''], 'x.png', { type: 'image/png' })
    setPaylasilir(!!navigator.canShare?.({ files: [deneme] }))
  }, [])

  useEffect(() => {
    if (!paylasilir) return
    let iptal = false
    resimAl().then(f => { if (!iptal) setDosya(f) }, () => { if (!iptal) setHata(true) })
    return () => { iptal = true }
  }, [paylasilir])

  const cls =
    'text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors'

  if (paylasilir) {
    return (
      <button
        type="button"
        className={cls}
        disabled={!dosya}
        aria-busy={!dosya && !hata}
        onClick={() => {
          if (!dosya) return
          // await YOK: share() dokunmayla aynı görevde çağrılmalı. Menüyü kapatmak hata değil.
          navigator.share({ files: [dosya] }).catch(() => {})
        }}
      >
        {hata ? 'Resim hazırlanamadı' : dosya ? 'Fotoğraflara kaydet' : 'Resim hazırlanıyor…'}
      </button>
    )
  }

  return (
    <a href={ADRES} download="ders-programi.png" className={cls}>
      Resim olarak indir
    </a>
  )
}
