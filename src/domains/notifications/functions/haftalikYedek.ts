// Gece yedeği (2026-10-10'a kadar haftalıktı): her gece 03:00'te tüm okul verisini tek JSON dosyası
// olarak Supabase Storage'daki private 'yedekler' kovasına yazar. Saklama: yedekMath.eskiYedekMi.
// Platform dışı kopya: `npm run yedek` (scripts/yedek-al.mts) bilgisayara indirir.
//
// Neden: Supabase Free planda panelden geri yüklenebilir platform yedeği YOK (Pro: 7 gün). Asıl senaryo "Eylül'de
// bozulan bir şeyi Ekim'de fark etmek" — 7 gün buna yetmiyor. Burada 30 gün her gün,
// 12 haftaya kadar Pazar yedekleri saklanıyor. Bu, platform yedeğinin YERİNE geçmez, onu tamamlar.
import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { logger } from '@/src/infrastructure/observability/logger'
import { yedekDosyaAdi, eskiYedekMi } from '../yedekMath'
import { yedekTopla } from '../yedekTopla'

const KOVA = 'yedekler'

export const haftalikYedekFn = inngest.createFunction(
  { id: 'haftalik-yedek', triggers: [{ cron: 'TZ=Europe/Istanbul 0 3 * * *' }] },
  async ({ step }) => {
    // Toplama + yazma TEK adımda: step dönüşü Inngest'te saklanır ve 4MB ile sınırlı —
    // ham veri adımlar arasında taşınırsa büyüyen okulda yedek düşer. Dışarı yalnız özet çıkar.
    const yuklendi = await step.run('topla-ve-yaz', async () => {
      const db = createServiceClient()
      const { simdi, basarisiz, govde } = await yedekTopla(db)
      if (basarisiz.length) logger.warn({ event: 'yedek_tablo_okunamadi', basarisiz }, 'Yedek tablosu okunamadı')
      const dosya = yedekDosyaAdi(simdi)

      const { error } = await db.storage.from(KOVA).upload(dosya, govde, {
        contentType: 'application/json',
        upsert:      true, // aynı gün tekrar çalışırsa üstüne yaz
      })
      if (error) throw new Error(`Yedek yüklenemedi: ${error.message}`)

      // Eksik tablolu yedek "başarılı" görünmesin: kısmi dosya yine yazılır (hiç yoktan iyi) ama
      // fonksiyon hata verir → cronHataBildirimi app_errors'a yazar, /platform'da görünür
      if (basarisiz.length) throw new Error(`Yedek eksik: ${basarisiz.join(', ')} okunamadı (${dosya} kısmi yazıldı)`)
      return { dosya, boyut: govde.length, basarisiz }
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
      { event: 'haftalik_yedek', dosya: yuklendi.dosya, boyut: yuklendi.boyut, silinen, basarisiz: yuklendi.basarisiz },
      'Gece yedeği alındı',
    )

    return { dosya: yuklendi.dosya, boyut: yuklendi.boyut, silinen, basarisiz: yuklendi.basarisiz }
  },
)
