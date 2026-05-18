import { UserRepository } from '../repositories/UserRepository'
import { getCurrentUser, getCurrentProfile } from '@/lib/auth'
import { PermissionService } from '@/src/domains/rbac/services/PermissionService'
import type { InviteResult, DeleteResult } from '../types'
import type { Role } from '@/lib/types'

function randomTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export const UserService = {
  async invite(params: {
    email:     string
    full_name: string
    subject:   string | null
    role:      Role
  }): Promise<InviteResult> {
    const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
    if (!user || !profile?.school_id) return { error: 'Giriş gerekli' }

    const canInvite = await PermissionService.check(user.id, profile.school_id, 'users', 'create')
    if (!canInvite) return { error: 'Yetki yok' }

    if (!params.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.email))
      return { error: 'Geçerli bir e-posta girin' }
    if (!params.full_name || params.full_name.length < 2)
      return { error: 'Ad soyad en az 2 karakter olmalı' }

    // users:manage → müdür; sadece create → müdür yardımcısı
    const canManage  = await PermissionService.check(user.id, profile.school_id, 'users', 'manage')
    const allowedRoles: Role[] = canManage
      ? ['mudur_yardimcisi', 'zumre_baskani', 'ogretmen']
      : ['zumre_baskani', 'ogretmen']

    if (!allowedRoles.includes(params.role)) return { error: 'Bu rolü atayamazsınız' }

    const tempPassword = randomTempPassword()

    const { data: userData, error: createError } = await UserRepository.createAuthUser(
      params.email,
      tempPassword,
      params.full_name
    )
    if (createError) {
      if (createError.message.includes('already been registered')) return { error: 'Bu e-posta zaten kayıtlı' }
      return { error: createError.message }
    }

    const { error: profileError } = await UserRepository.adminSetProfile({
      p_id:        userData.user.id,
      p_full_name: params.full_name,
      p_subject:   params.subject ?? '',
      p_role:      params.role,
      p_school_id: profile.school_id,
    })
    if (profileError) {
      await UserRepository.deleteAuthUser(userData.user.id)
      return { error: 'Profil oluşturulamadı: ' + profileError.message }
    }

    return { success: true, tempPassword }
  },

  async deleteUser(targetId: string): Promise<DeleteResult> {
    const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
    if (!user || !profile?.school_id) return { error: 'Giriş gerekli' }

    const canDelete = await PermissionService.check(user.id, profile.school_id, 'users', 'delete')
    if (!canDelete) return { error: 'Yetki yok' }

    const { data: target } = await UserRepository.getProfileById(targetId)
    if (!target || target.school_id !== profile.school_id) return { error: 'Kullanıcı bulunamadı' }
    if (target.role === 'mudur') return { error: 'Müdür silinemez' }

    // users:manage yoksa sadece ogretmen/zumre_baskani silebilir
    const canManage = await PermissionService.check(user.id, profile.school_id, 'users', 'manage')
    if (!canManage && !['ogretmen', 'zumre_baskani'].includes(target.role)) {
      return { error: 'Bu kullanıcıyı silemezsiniz' }
    }

    const { error } = await UserRepository.deleteAuthUser(targetId)
    if (error) return { error: error.message }

    return { success: true }
  },

  async assignRole(targetId: string, newRole: string): Promise<void> {
    const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
    if (!user || !profile?.school_id) throw new Error('Giriş gerekli')

    const canUpdate = await PermissionService.check(user.id, profile.school_id, 'users', 'update')
    if (!canUpdate) throw new Error('Yetki yok')

    if (targetId === user.id) throw new Error('Kendi rolünüzü değiştiremezsiniz')

    const canManage = await PermissionService.check(user.id, profile.school_id, 'users', 'manage')
    if (!canManage) {
      if (!['ogretmen', 'zumre_baskani'].includes(newRole))
        throw new Error('Bu rolü atayamazsınız')
      const { data: target } = await UserRepository.getProfileByIdWithClient(targetId)
      if (!target || !['ogretmen', 'zumre_baskani'].includes(target.role))
        throw new Error('Yalnızca Öğretmen veya Zümre Başkanının rolünü değiştirebilirsiniz')
    }

    const { error } = await UserRepository.assignRole(targetId, newRole)
    if (error) throw new Error(error.message)
  },

  async updateProfile(
    userId: string,
    data: { full_name: string; subject: string | null }
  ): Promise<{ error?: string }> {
    const { error } = await UserRepository.updateProfile(userId, data)
    if (error) return { error: error.message }
    return {}
  },
}
