import { NextRequest, NextResponse } from 'next/server'
import { CalendarFeedService } from '@/src/domains/calendar/services/CalendarFeedService'
import { looksLikeToken } from '@/src/infrastructure/tokens'
import { logger } from '@/src/infrastructure/observability/logger'

// Takvim aboneliği beslemesi. Takvim uygulamaları çerez taşımaz → kimlik imzalı token'dan gelir
// (routeAccess PUBLIC_PATHS'te; proxy auth redirect'i uygulamaz, rate-limit uygular).
// Geçersiz / iptal / başka okula geçmiş / silinmiş kullanıcı → 404 (varlık bilgisi sızdırmaz).
// Okul aboneliği kilitli → 403 (token geçerli olduğu için sahibine bilgi sızıntısı değil).

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t') ?? ''
  if (token.length > 2048 || !looksLikeToken(token)) {
    return new NextResponse('Bulunamadı', { status: 404, headers: NO_STORE })
  }

  try {
    const result = await CalendarFeedService.renderFeed(token)
    if (result.status !== 200) {
      const message = result.status === 403 ? 'Okul aboneliği aktif değil' : 'Bulunamadı'
      return new NextResponse(message, { status: result.status, headers: NO_STORE })
    }

    return new NextResponse(result.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'private, max-age=900',
        'Content-Disposition': 'inline; filename="edudesk.ics"',
        'X-Robots-Tag': 'noindex',
      },
    })
  } catch (err) {
    logger.error(
      { event: 'takvim_ics_failed', err: err instanceof Error ? err.message : String(err) },
      'Takvim ICS beslemesi üretilemedi',
    )
    return new NextResponse('Geçici hata', { status: 500, headers: NO_STORE })
  }
}
