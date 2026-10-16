'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { HaftaVerisi } from '@/src/domains/mentor/takip/takipMath'

export type KayitDurumu = { tur: 'bos' } | { tur: 'kaydediliyor' } | { tur: 'kaydedildi'; saat: string } | { tur: 'hata'; mesaj: string } | { tur: 'cakisma' }
type Kaydet = (v: HaftaVerisi, sonBilinen: string | null) => Promise<{ error?: string; cakisma?: boolean; updatedAt?: string }>

const GECIKME = 800

/** Gecikmeli kayıt; tek seferde tek istek (sıradaki son hali yazar). Kaydedilmemiş değişiklikte çıkış uyarısı. */
export function useOtoKayit(veri: HaftaVerisi, kaydet: Kaydet, ilkUpdatedAt: string | null) {
  const [durum, setDurum] = useState<KayitDurumu>({ tur: 'bos' })
  const sonBilinen = useRef(ilkUpdatedAt)
  const bekleyen = useRef<HaftaVerisi | null>(null)
  const calisiyor = useRef(false)
  const zaman = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ilkVeri = useRef(veri)
  const anlikRef = useRef(false)

  const yaz = useCallback(async () => {
    if (calisiyor.current || !bekleyen.current) return
    calisiyor.current = true
    const v = bekleyen.current
    bekleyen.current = null
    setDurum({ tur: 'kaydediliyor' })
    try {
      const r = await kaydet(v, sonBilinen.current)
      if (r.cakisma) { setDurum({ tur: 'cakisma' }); return }
      if (r.error || !r.updatedAt) { bekleyen.current ??= v; setDurum({ tur: 'hata', mesaj: r.error ?? 'Kaydedilemedi' }); return }
      sonBilinen.current = r.updatedAt
      setDurum({ tur: 'kaydedildi', saat: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) })
    } catch {
      bekleyen.current ??= v
      setDurum({ tur: 'hata', mesaj: 'Bağlantı hatası' })
    } finally {
      calisiyor.current = false
    }
    if (bekleyen.current && !zaman.current) void yaz()
  }, [kaydet])

  useEffect(() => {
    // açılış = değişiklik değil (satır yaratma). Ref karşılaştırması: StrictMode'un çift effect'inde de doğru
    if (veri === ilkVeri.current) return
    bekleyen.current = veri
    if (zaman.current) clearTimeout(zaman.current)
    // anlik setVeri'den ÖNCE işaretlenir; effect yeni veri commit edildikten sonra çalıştığından doğru hali yazar
    const gecikme = anlikRef.current ? 0 : GECIKME
    anlikRef.current = false
    zaman.current = setTimeout(() => { zaman.current = null; void yaz() }, gecikme)
  }, [veri, yaz])

  useEffect(() => {
    const uyar = (e: BeforeUnloadEvent) => { if (bekleyen.current || calisiyor.current) e.preventDefault() }
    window.addEventListener('beforeunload', uyar)
    return () => window.removeEventListener('beforeunload', uyar)
  }, [])

  const bosalt = useCallback(() => {
    if (zaman.current) { clearTimeout(zaman.current); zaman.current = null }
    void yaz()
  }, [yaz])
  const anlik = useCallback(() => { anlikRef.current = true }, [])

  return { durum, anlik, bosalt }
}
