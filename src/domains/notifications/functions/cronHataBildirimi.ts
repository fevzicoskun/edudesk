// Cron hata yakalayıcı: herhangi bir Inngest fonksiyonu tüm denemelerini
// tüketip başarısız olduğunda tetiklenir.
//
// Neden tek fonksiyon: her cron'a ayrı ayrı onFailure eklemek yerine Inngest'in
// 'inngest/function.failed' sistem olayını dinliyoruz — yeni cron eklendiğinde
// burada hiçbir şey değişmez, otomatik kapsanır.
//
// Sabah özeti gitmediğinde veya veli bildirimi çöktüğünde eskiden hiçbir iz
// kalmıyordu (yalnız Vercel logu); artık e-posta + app_errors kaydı üretir.
import { inngest } from '@/src/infrastructure/inngest'
import { sendCriticalAlert } from '@/src/infrastructure/observability/alerts'

type FailureEventData = {
  error?: { name?: string; message?: string; stack?: string }
  function_id?: string
  run_id?: string
  event?: { name?: string }
}

export const cronHataBildirimiFn = inngest.createFunction(
  { id: 'cron-hata-bildirimi', triggers: [{ event: 'inngest/function.failed' }] },
  async ({ event }) => {
    const data = (event.data ?? {}) as FailureEventData

    const fonksiyon = data.function_id ?? 'bilinmeyen-fonksiyon'
    const mesaj     = data.error?.message ?? 'Hata mesajı yok'

    sendCriticalAlert({
      name:    `CronFailed: ${fonksiyon}`,
      message: mesaj,
      source:  'cron',
      context: {
        fonksiyon,
        runId:        data.run_id,
        tetikleyici:  data.event?.name,
        hataTipi:     data.error?.name,
      },
    })

    return { bildirildi: fonksiyon }
  },
)
