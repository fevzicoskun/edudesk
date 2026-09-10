'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/src/shared/auth'
import { CalendarFeedService } from '@/src/domains/calendar/services/CalendarFeedService'
import type { ActionResult } from '@/src/shared/types/index'

// Girdi almaz: kullanıcı yalnız KENDİ abonelik bağlantısını oluşturur/yeniler; kimlik oturumdan gelir.
export async function yenileTakvimBaglantisi(): Promise<ActionResult<{ url?: string }>> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const result = await CalendarFeedService.rotateMyFeedUrl()
  if (result.error || !result.url) return { error: result.error ?? 'Bağlantı oluşturulamadı' }

  revalidatePath('/ayarlar')
  return { url: result.url }
}
