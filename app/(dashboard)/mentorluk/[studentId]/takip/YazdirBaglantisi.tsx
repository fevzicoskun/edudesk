'use client'
import { useState } from 'react'

/**
 * Önce bekleyen kaydı bitirir, sonra çıktıyı YENİ SEKMEDE açar:
 * - kâğıt sunucudan okunur → son yazılan da kâğıda girsin (kayıt/okuma yarışı yok)
 * - takip sayfası açık kalır → "geri" ile önbellekteki eski hâle dönülmez
 * Sekme tıklama anında açılır (açılır pencere engelleyicisi), adres kayıt bitince verilir.
 */
export default function YazdirBaglantisi({ href, bosalt, children, className }: {
  href: string; bosalt: () => Promise<boolean>; children: React.ReactNode; className: string
}) {
  const [hata, setHata] = useState(false)
  return (
    <>
      <a href={href} target="_blank" rel="noopener" className={className} onClick={async e => {
        e.preventDefault()
        const sekme = window.open('', '_blank')
        if (!(await bosalt())) { sekme?.close(); setHata(true); return }
        setHata(false)
        if (sekme) sekme.location.href = href
        else window.location.href = href
      }}>{children}</a>
      {hata && <span role="alert" className="text-sm text-red-700 dark:text-red-400">Önce kayıt hatasını giderin</span>}
    </>
  )
}
