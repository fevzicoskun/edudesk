import type { CriticalAlertInput } from './alerts'

/**
 * Next.js onRequestError girdisini kritik hata kaydına çevirir (saf fonksiyon).
 *
 * Bilinçli olarak YAZILMAYANLAR: istek header'ları (cookie/oturum) ve sorgu dizesi
 * (ör. /api/takvim/ics?key=... abonelik anahtarı taşır).
 */
export function sunucuHatasiAlarmi(
  err: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string },
): CriticalAlertInput {
  const hata   = err instanceof Error ? err : null
  const digest = typeof err === 'object' && err !== null && 'digest' in err ? String(err.digest) : undefined

  return {
    name:    `ServerError:${hata?.name ?? 'Unknown'}`,
    message: hata?.message ?? String(err),
    digest,
    source:  'server',
    context: {
      path:      request.path.split('?')[0],
      method:    request.method,
      routePath: context.routePath,
      routeType: context.routeType,
    },
  }
}

/** Kullanıcı sayfa yüklenirken ayrıldı (geri tuşu, uygulamayı kapatma) — sunucu hatası değil.
 *  Kaydedilirse Hatalar paneli ve alarm e-postası gürültüyle dolar, gerçek hata kaybolur. */
const KOPMA_MESAJLARI = new Set(['aborted', 'The destination stream closed early.'])
const KOPMA_KODLARI   = new Set(['ECONNRESET', 'ERR_STREAM_PREMATURE_CLOSE', 'ABORT_ERR'])

export function istemciKoptu(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const kod = (err as { code?: unknown }).code
  return KOPMA_MESAJLARI.has(err.message) || (typeof kod === 'string' && KOPMA_KODLARI.has(kod))
}
