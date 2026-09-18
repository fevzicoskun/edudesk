import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { logger } from '@/src/infrastructure/observability/logger'
import { hataKaydiOlustur, type HataKaynagi } from './hataKaydi'

/**
 * Hatayı app_errors tablosuna kalıcı yazar.
 *
 * Fire-and-forget: çağıran akışı asla bloklamaz ve kendi hatasını yukarı fırlatmaz.
 * Yazım service_role ile yapılır (tabloda RLS açık, policy yok = deny-all).
 */

// Reentrancy guard: DB yazımının kendisi hata verirse tekrar kaydetmeye çalışma,
// yoksa hata → kayıt → hata → kayıt döngüsü oluşur.
let yazmaDevamEdiyor = false

export function kaydetHata(girdi: {
  name: string
  message: string
  source: HataKaynagi
  context?: Record<string, unknown>
  userId?: string | null
  schoolId?: string | null
}): void {
  if (yazmaDevamEdiyor) return

  const kayit = hataKaydiOlustur(girdi)

  yazmaDevamEdiyor = true
  void (async () => {
    try {
      const db = createServiceClient()
      const { error } = await db.from('app_errors').insert({
        name:        kayit.name,
        message:     kayit.message,
        fingerprint: kayit.fingerprint,
        source:      kayit.source,
        // context serbest biçimli; jsonb sınırında Json tipine daraltılıyor
        context:     kayit.context as Record<string, never>,
        user_id:     girdi.userId   ?? null,
        school_id:   girdi.schoolId ?? null,
      })
      if (error) {
        // Yalnız logla — kaydetHata'yı ÇAĞIRMA (döngü)
        logger.warn({ event: 'hata_kaydi_yazilamadi', code: error.code }, 'app_errors insert başarısız')
      }
    } catch (e) {
      logger.warn({ event: 'hata_kaydi_istisna', err: String(e) }, 'app_errors yazımında istisna')
    } finally {
      yazmaDevamEdiyor = false
    }
  })()
}
