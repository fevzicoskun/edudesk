'use client'

import { useActionState, useEffect, useRef, type ReactNode } from 'react'
import { formGonder } from '@/src/shared/utils/formGonder'

type Durum = { ok: boolean; error?: string } | null

/** Sunucu bileşenindeki `throw` eden action'lı form için: hata sayfaya düşmez, yazılan silinmez
 *  (formGonder), hata mesajı gösterilir; yalnız başarıda form temizlenir. */
export default function SunucuFormu({ action, className, children }: {
  action: (fd: FormData) => Promise<void>
  className?: string
  children: ReactNode
}) {
  const [durum, gonder, bekliyor] = useActionState(async (_: Durum, fd: FormData): Promise<Durum> => {
    try {
      await action(fd)
      return { ok: true }
    } catch {
      // Üretimde Next fırlatılan mesajı gizler (İngilizce genel metin) → sabit Türkçe mesaj
      return { ok: false, error: 'Kaydedilemedi. Yazdıklarınız duruyor, tekrar deneyin.' }
    }
  }, null)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => { if (durum?.ok) formRef.current?.reset() }, [durum])

  return (
    <form ref={formRef} onSubmit={formGonder(gonder)} className={className} aria-busy={bekliyor}>
      {children}
      {durum?.error && <p role="alert" className="basis-full w-full text-sm text-red-600 dark:text-red-400 mt-1">{durum.error}</p>}
    </form>
  )
}
