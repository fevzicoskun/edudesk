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
  const sonVeri = useRef(veri)
  const anlikRef = useRef(false)
  // Haftanın DB'de satırı var mı: açılışta kayıt varsa ya da ilk başarılı yazımdan sonra (taslak etiketi için)
  const [kayitli, setKayitli] = useState(ilkUpdatedAt !== null)
  useEffect(() => { if (durum.tur === 'kaydedildi') setKayitli(true) }, [durum])

  useEffect(() => { sonVeri.current = veri }, [veri])

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

  /** Taslak hafta da kayda dönsün (Kâğıdı yazdır, Herkese uygula): değişiklik olmasa bile şimdiki hâli yazar. */
  const kaydiZorla = useCallback(() => { if (!kayitli) kuyruk.degisti(sonVeri.current, true); return kuyruk.bosalt() }, [kuyruk, kayitli])

  return { durum, anlik, bosalt, kayitli, kaydiZorla }
}
