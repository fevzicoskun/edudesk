import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { logger } from '@/src/infrastructure/observability/logger'
import { hataKaydiOlustur, type HataKaynagi } from './hataKaydi'

/**
 * Hatayı app_errors tablosuna kalıcı yazar.
 *
 * Kendi hatasını asla yukarı fırlatmaz; döndürdüğü promise yazım bitince resolve olur.
 * Çağıran BEKLEMELİ: Vercel'de cevap döndükten sonra askıda kalan promise'in
 * tamamlanması garanti değil — beklenmeyen kayıt sessizce kaybolabilir.
 * Yazım service_role ile yapılır (tabloda RLS açık, policy yok = deny-all).
 *
 * Yazım hatası yalnız loglanır, kaydetHata'ya geri dönmez — döngü yapısal olarak
 * imkânsız, bu yüzden "yazım sürüyor" bayrağı yok (eşzamanlı hataları düşürürdü).
 */
export async function kaydetHata(girdi: {
  name: string
  message: string
  source: HataKaynagi
  context?: Record<string, unknown>
  userId?: string | null
  schoolId?: string | null
}): Promise<void> {
  try {
    const kayit = hataKaydiOlustur(girdi)
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
      logger.warn({ event: 'hata_kaydi_yazilamadi', code: error.code }, 'app_errors insert başarısız')
    }
  } catch (e) {
    logger.warn({ event: 'hata_kaydi_istisna', err: String(e) }, 'app_errors yazımında istisna')
  }
}
