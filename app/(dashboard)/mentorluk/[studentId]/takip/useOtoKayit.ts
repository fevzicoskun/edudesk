'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { kayitKuyrugu, type KayitDurumu, type KayitSonucu } from '@/src/domains/mentor/takip/kayitKuyrugu'
import type { HaftaVerisi } from '@/src/domains/mentor/takip/takipMath'

export type { KayitDurumu }

/** Kuyruğu (kayitKuyrugu.ts, testli) React'e bağlar + kaydedilmemiş değişiklikte çıkış uyarısı. */
export function useOtoKayit(
  veri: HaftaVerisi,
  kaydet: (v: HaftaVerisi, sonBilinen: string | null) => Promise<KayitSonucu>,
  ilkUpdatedAt: string | null,
) {
  const [durum, setDurum] = useState<KayitDurumu>({ tur: 'bos' })
  const [kuyruk] = useState(() => kayitKuyrugu(kaydet, ilkUpdatedAt, setDurum))
  const ilkVeri = useRef(veri)
  const anlikRef = useRef(false)

  useEffect(() => {
    // açılış = değişiklik değil (satır yaratma). Ref karşılaştırması: StrictMode'un çift effect'inde de doğru
    if (veri === ilkVeri.current) return
    kuyruk.degisti(veri, anlikRef.current)
    anlikRef.current = false
  }, [veri, kuyruk])

  useEffect(() => {
    const uyar = (e: BeforeUnloadEvent) => { if (kuyruk.bekleyenVar()) e.preventDefault() }
    window.addEventListener('beforeunload', uyar)
    return () => window.removeEventListener('beforeunload', uyar)
  }, [kuyruk])

  /** Bir SONRAKİ değişikliği gecikmesiz yazdır (setVeri'den önce çağrılır). */
  const anlik = useCallback(() => { anlikRef.current = true }, [])
  /** Bekleyeni hemen yaz; true = her şey kaydedildi. */
  const bosalt = useCallback(() => kuyruk.bosalt(), [kuyruk])

  return { durum, anlik, bosalt }
}
