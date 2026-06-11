'use server'

/**
 * Client hata köprüsü — error.tsx / global-error.tsx boundary'lerinden
 * yakalanan hataları sunucu tarafındaki kritik hata bildirimine iletir.
 *
 * Anonim isteklerde de çalışır (login sayfası çökerse de haber almalıyız);
 * spam koruması sendCriticalAlert içindeki rate limiter ile sağlanır.
 */
import { z } from 'zod'
import { getCurrentUser } from '@/src/shared/auth'
import { sendCriticalAlert } from '@/src/infrastructure/observability/alerts'

const reportSchema = z.object({
  message: z.string().min(1).max(500),
  digest:  z.string().max(100).optional(),
  url:     z.string().max(200).optional(),
}).strict()

export async function reportClientError(input: {
  message: string
  digest?: string
  url?:    string
}): Promise<{ ok: boolean }> {
  const parsed = reportSchema.safeParse(input)
  if (!parsed.success) return { ok: false }

  // Kullanıcı oturumu varsa context'e ekle; anonimse sessizce devam et
  let userId: string | undefined
  try {
    userId = (await getCurrentUser())?.id
  } catch {
    // anonim istek — userId olmadan raporla
  }

  sendCriticalAlert({
    name:    'ClientError',
    message: parsed.data.message,
    digest:  parsed.data.digest,
    context: {
      source: 'client-error-boundary',
      url:    parsed.data.url,
      userId,
    },
  })

  return { ok: true }
}
