'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAnnouncementSchema } from '@/src/domains/announcements/validators'
import { AnnouncementService } from '@/src/domains/announcements/services/AnnouncementService'

export async function createAnnouncement(_: unknown, formData: FormData) {
  const rawRoles = formData.getAll('target_roles') as string[]

  const parsed = createAnnouncementSchema.safeParse({
    message: formData.get('message'),
    target_roles: rawRoles,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await AnnouncementService.createAnnouncement(parsed.data)
  if (result.error) return { error: result.error }

  revalidatePath('/duyurular')
  return { success: true }
}

export async function markAnnouncementRead(announcementId: string) {
  await AnnouncementService.markRead(announcementId)
  redirect('/anasayfa')
}
