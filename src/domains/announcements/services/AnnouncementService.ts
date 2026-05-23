import { AnnouncementRepository } from '../repositories/AnnouncementRepository'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { MUDUR_TARGET_ROLES, MY_TARGET_ROLES } from '../validators'
import type { Announcement, AnnouncementWithSender } from '../types'

export const AnnouncementService = {
  async getFirstUnread(): Promise<AnnouncementWithSender | null> {
    const user = await getCurrentUser()
    const profile = await getCurrentProfile()
    if (!user || !profile?.school_id) return null
    return AnnouncementRepository.getFirstUnread(user.id, profile.role, profile.school_id)
  },

  async markRead(announcementId: string): Promise<void> {
    const user = await getCurrentUser()
    if (!user) return
    await AnnouncementRepository.markRead(announcementId, user.id)
  },

  async createAnnouncement(data: {
    message: string
    target_roles: string[]
  }): Promise<{ error?: string }> {
    const user = await getCurrentUser()
    const profile = await getCurrentProfile()
    if (!user || !profile?.school_id) return { error: 'Giriş gerekli' }

    const allowedRoles: readonly string[] =
      profile.role === 'mudur' ? MUDUR_TARGET_ROLES : MY_TARGET_ROLES

    if (!['mudur', 'mudur_yardimcisi'].includes(profile.role)) {
      return { error: 'Bu işlem için yetkiniz yok' }
    }

    const invalidRoles = data.target_roles.filter(r => !allowedRoles.includes(r))
    if (invalidRoles.length > 0) {
      return { error: 'Geçersiz hedef grup seçimi' }
    }

    return AnnouncementRepository.create({
      school_id: profile.school_id,
      message: data.message,
      created_by: user.id,
      target_roles: data.target_roles,
    })
  },

  async listSent(): Promise<Announcement[]> {
    const user = await getCurrentUser()
    if (!user) return []
    return AnnouncementRepository.listByCreator(user.id)
  },
}
