// Haftalık yedek: Pazar 03:00'te tüm okul verisini tek JSON dosyası olarak
// Supabase Storage'daki private 'yedekler' kovasına yazar.
//
// Neden: Supabase Free plan yedeği 7 gün geriye gidiyor. Asıl senaryo "Eylül'de
// bozulan bir şeyi Ekim'de fark etmek" — 7 gün buna yetmiyor. Burada 12 hafta
// saklanıyor. Bu, platform yedeğinin YERİNE geçmez, onu tamamlar.
import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { logger } from '@/src/infrastructure/observability/logger'
import { YEDEKLENEN_TABLOLAR, yedekDosyaAdi, eskiYedekMi } from '../yedekMath'

const KOVA = 'yedekler'
/** Tablo başına üst sınır — beklenmedik büyümede fonksiyonu kilitlemesin */
const SATIR_SINIRI = 50_000

export const haftalikYedekFn = inngest.createFunction(
  { id: 'haftalik-yedek', triggers: [{ cron: 'TZ=Europe/Istanbul 0 3 * * 0' }] },
  async ({ step }) => {
    const sonuc = await step.run('tablolari-topla', async () => {
      const db = createServiceClient()
      const veri: Record<string, unknown[]> = {}
      const basarisiz: string[] = []

      for (const tablo of YEDEKLENEN_TABLOLAR) {
        const { data, error } = await db.from(tablo).select('*').limit(SATIR_SINIRI)
        if (error) {
          // Tek tablonun hatası yedeği tümden iptal etmesin; eksik olan raporlanır.
          basarisiz.push(tablo)
          logger.warn({ event: 'yedek_tablo_okunamadi', tablo, code: error.code }, 'Yedek tablosu okunamadı')
          continue
        }
        veri[tablo] = data ?? []
      }

      return { veri, basarisiz }
    })

    const yuklendi = await step.run('storage-yaz', async () => {
      const db = createServiceClient()
      const simdi = new Date()
      const dosya = yedekDosyaAdi(simdi)

      const govde = JSON.stringify({
        alindi:    simdi.toISOString(),
        surum:     1,
        basarisiz: sonuc.basarisiz,
        satirlar:  Object.fromEntries(Object.entries(sonuc.veri).map(([t, r]) => [t, r.length])),
        veri:      sonuc.veri,
      })

      const { error } = await db.storage.from(KOVA).upload(dosya, govde, {
        contentType: 'application/json',
        upsert:      true, // aynı gün tekrar çalışırsa üstüne yaz
      })
      if (error) throw new Error(`Yedek yüklenemedi: ${error.message}`)

      return { dosya, boyut: govde.length }
    })

    // Saklama süresi dolmuş yedekleri temizle
    const silinen = await step.run('eski-yedekleri-sil', async () => {
      const db = createServiceClient()
      const { data: dosyalar, error } = await db.storage.from(KOVA).list('', { limit: 200 })
      if (error || !dosyalar) return 0

      const bugun = new Date()
      const silinecek = dosyalar.map(d => d.name).filter(ad => eskiYedekMi(ad, bugun))
      if (silinecek.length === 0) return 0

      const { error: silmeHatasi } = await db.storage.from(KOVA).remove(silinecek)
      if (silmeHatasi) {
        logger.warn({ event: 'eski_yedek_silinemedi', adet: silinecek.length }, 'Eski yedekler silinemedi')
        return 0
      }
      return silinecek.length
    })

    // app_errors birikmesin — 30 günden eskiyi at (yedeğe de girmiyor)
    await step.run('eski-hatalari-sil', async () => {
      const db = createServiceClient()
      const sinir = new Date()
      sinir.setDate(sinir.getDate() - 30)
      const { error } = await db.from('app_errors').delete().lt('created_at', sinir.toISOString())
      if (error) logger.warn({ event: 'eski_hata_silinemedi', code: error.code }, 'Eski hata kayıtları silinemedi')
      return true
    })

    logger.info(
      { event: 'haftalik_yedek', dosya: yuklendi.dosya, boyut: yuklendi.boyut, silinen, basarisiz: sonuc.basarisiz },
      'Haftalık yedek alındı',
    )

    return { dosya: yuklendi.dosya, boyut: yuklendi.boyut, silinen, basarisiz: sonuc.basarisiz }
  },
)
