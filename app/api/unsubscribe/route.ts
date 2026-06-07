import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { verifyUnsubscribeToken } from '@/src/lib/unsubscribeToken'
import { logger } from '@/src/infrastructure/observability/logger'

export async function GET(req: NextRequest) {
  const id  = req.nextUrl.searchParams.get('id')
  const sig = req.nextUrl.searchParams.get('sig')

  if (!id || !sig || !verifyUnsubscribeToken(id, sig)) {
    return new NextResponse('Geçersiz bağlantı.', { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('students')
    .update({ veli_email_opt_out: true })
    .eq('id', id)

  if (error) {
    logger.error({ event: 'unsubscribe_db_failed', err: error.message }, 'Veli email opt-out DB hatası')
    return new NextResponse('Bir hata oluştu. Lütfen tekrar deneyin.', { status: 500 })
  }

  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Abonelik İptal Edildi</title></head><body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center">
      <h2>Bildirimler durduruldu.</h2>
      <p>Bu öğrenciye ait ödev hatırlatma e-postaları artık gönderilmeyecek.</p>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
