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
