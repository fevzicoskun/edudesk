'use client'

import { useEffect, useState, type RefObject } from 'react'

// Öğretmen isteği (2026-10-19): programı telefonda Fotoğraflar'a kaydetmek. Paylaşım menüsünden
// "Görüntüyü Kaydet" (iOS) / galeriye kaydet (Android). Paylaşım yoksa (masaüstü) PNG indirilir.
// Resim önceden hazırlanır: iOS share()'i dokunmayla aynı görevde ister, araya await girerse reddeder.

async function resimCek(kok: HTMLElement): Promise<File> {
  // "Bugün" vurgusu fotoğrafa girmesin — resim bütün yıl kullanılır. Vurgusuz bir komşunun renkleri kopyalanır.
  const duzBaslik = kok.querySelector('th[data-gun]:not([data-bugun])')
  const duzHucre = kok.querySelector('td[data-gun]:not([data-bugun])')
  const renk = duzBaslik ? getComputedStyle(duzBaslik).color : ''
  const zemin = duzHucre ? getComputedStyle(duzHucre).backgroundColor : ''
  const { domToBlob } = await import('modern-screenshot')
  const blob = await domToBlob(kok, {
    scale: 3,
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    type: 'image/png',
    // Kopya bitince bir kez: hesaplanmış stiller satır içine yazıldığı için düzeltme doğrudan kopyada yapılır
    onCloneNode: kopya => {
      if (!(kopya instanceof HTMLElement)) return
      kopya.querySelectorAll<HTMLElement>('th[data-bugun], th[data-bugun] *').forEach(el => {
        // Kütüphane yazı rengini -webkit-text-fill-color olarak da satır içine yazıyor; ikisi birden ezilir
        if (renk) { el.style.color = renk; el.style.setProperty('-webkit-text-fill-color', renk) }
      })
      kopya.querySelectorAll<HTMLElement>('td[data-bugun]').forEach(el => { if (zemin) el.style.backgroundColor = zemin })
    },
  })
  return new File([blob], 'ders-programi.png', { type: 'image/png' })
}

export default function FotografaKaydet({ hedef }: { hedef: RefObject<HTMLElement | null> }) {
  const [paylasilir, setPaylasilir] = useState(false)
  const [dosya, setDosya] = useState<File | null>(null)
  const [hata, setHata] = useState(false)

  useEffect(() => {
    const deneme = new File([''], 'x.png', { type: 'image/png' })
    setPaylasilir(!!navigator.canShare?.({ files: [deneme] }))
  }, [])

  useEffect(() => {
    if (!paylasilir || !hedef.current) return
    let iptal = false
    resimCek(hedef.current).then(f => { if (!iptal) setDosya(f) }, () => { if (!iptal) setHata(true) })
    return () => { iptal = true }
  }, [paylasilir, hedef])

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
    <button
      type="button"
      className={cls}
      onClick={async () => {
        if (!hedef.current) return
        const f = await resimCek(hedef.current)
        const url = URL.createObjectURL(f)
        Object.assign(document.createElement('a'), { href: url, download: f.name }).click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }}
    >
      Resim olarak indir
    </button>
  )
}
