// Haftalık yedek: Pazar 03:00'te tüm okul verisini tek JSON dosyası olarak
// Supabase Storage'daki private 'yedekler' kovasına yazar.
//
// Neden: Supabase Free plan yedeği 7 gün geriye gidiyor. Asıl senaryo "Eylül'de
// bozulan bir şeyi Ekim'de fark etmek" — 7 gün buna yetmiyor. Burada 12 hafta
// saklanıyor. Bu, platform yedeğinin YERİNE geçmez, onu tamamlar.
import { inngest } from '@/src/infrastructure/inngest'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { logger } from '@/src/infrastructure/observability/logger'
import { fetchAll } from '@/src/shared/utils/fetchAll'
import { YEDEKLENEN_TABLOLAR, yedekDosyaAdi, eskiYedekMi, yedekSiralama } from '../yedekMath'

const KOVA = 'yedekler'

export const haftalikYedekFn = inngest.createFunction(
  { id: 'haftalik-yedek', triggers: [{ cron: 'TZ=Europe/Istanbul 0 3 * * 0' }] },
  async ({ step }) => {
    // Toplama + yazma TEK adımda: step dönüşü Inngest'te saklanır ve 4MB ile sınırlı —
    // ham veri adımlar arasında taşınırsa büyüyen okulda yedek düşer. Dışarı yalnız özet çıkar.
    const yuklendi = await step.run('topla-ve-yaz', async () => {
      const db = createServiceClient()
      const veri: Record<string, unknown[]> = {}
      const basarisiz: string[] = []

      for (const tablo of YEDEKLENEN_TABLOLAR) {
        try {
          // Sayfalı: PostgREST max_rows=1000 tek istekte fazlasını SESSİZCE keser
          veri[tablo] = await fetchAll((from, to) => {
            let q = db.from(tablo).select('*')
            for (const kolon of yedekSiralama(tablo)) q = q.order(kolon)
            return q.range(from, to)
          })
        } catch (e) {
          // Tek tablonun hatası yedeği tümden iptal etmesin; eksik olan raporlanır.
          basarisiz.push(tablo)
          logger.warn({ event: 'yedek_tablo_okunamadi', tablo, hata: (e as Error).message }, 'Yedek tablosu okunamadı')
        }
      }

      const simdi = new Date()
      const dosya = yedekDosyaAdi(simdi)
      const satirlar = Object.fromEntries(Object.entries(veri).map(([t, r]) => [t, r.length]))
      const govde = JSON.stringify({ alindi: simdi.toISOString(), surum: 1, basarisiz, satirlar, veri })

      const { error } = await db.storage.from(KOVA).upload(dosya, govde, {
        contentType: 'application/json',
        upsert:      true, // aynı gün tekrar çalışırsa üstüne yaz
      })
      if (error) throw new Error(`Yedek yüklenemedi: ${error.message}`)

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
      'Haftalık yedek alındı',
    )

    return { dosya: yuklendi.dosya, boyut: yuklendi.boyut, silinen, basarisiz: yuklendi.basarisiz }
  },
)
