import { UserRepository } from '../repositories/UserRepository'
import { getAbility, requireAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import { logger } from '@/src/infrastructure/observability/logger'
import type { InviteResult } from '../types'
import type { Role, ActionResult } from '@/src/shared/types'
import { generateTempPassword } from '@/src/shared/utils'

export const UserService = {
  async invite(params: {
    email:     string
    full_name: string
    subject:   string | null
    role:      Role
  }): Promise<InviteResult> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.USERS.CREATE)) return { error: 'Yetki yok' }

    // users:manage → müdür → sadece mudur_yardimcisi atayabilir
    // sadece create → müdür yardımcısı → zumre_baskani veya ogretmen atayabilir
    const canManage  = ability.can(P.USERS.MANAGE)
    const allowedRoles: Role[] = canManage
      ? ['mudur_yardimcisi']
      : ['zumre_baskani', 'ogretmen']

    if (!allowedRoles.includes(params.role)) return { error: 'Bu rolü atayamazsınız' }

    const tempPassword = generateTempPassword()

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
      p_school_id: ability.schoolId,
    })
    if (profileError) {
      logger.error({ code: profileError.code, userId: userData.user.id }, 'adminSetProfile failed on invite — rolling back auth user')
      await UserRepository.deleteAuthUser(userData.user.id)
      return { error: 'Profil oluşturulamadı: ' + profileError.message }
    }

    return { success: true, tempPassword }
  },

  async deleteUser(targetId: string): Promise<ActionResult> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.USERS.DELETE)) return { error: 'Yetki yok' }

    const { data: target } = await UserRepository.getProfileById(targetId)
    if (!target || target.school_id !== ability.schoolId) return { error: 'Kullanıcı bulunamadı' }
    if (target.role === 'mudur') return { error: 'Müdür silinemez' }

    const canManage = ability.can(P.USERS.MANAGE)
    // Müdür → sadece mudur_yardimcisi silebilir
    // MY → sadece ogretmen/zumre_baskani silebilir
    const deletableRoles: Role[] = canManage
      ? ['mudur_yardimcisi']
      : ['ogretmen', 'zumre_baskani']
    if (!deletableRoles.includes(target.role as Role)) {
      return { error: 'Bu kullanıcıyı silemezsiniz' }
    }

    const { error } = await UserRepository.deleteAuthUser(targetId)
    if (error) return { error: error.message }

    return {}
  },

  async assignRole(targetId: string, newRole: string): Promise<void> {
    const ability = await requireAbility()
    if (ability.cannot(P.USERS.UPDATE)) throw new Error('Yetki yok')
    if (targetId === ability.userId) throw new Error('Kendi rolünüzü değiştiremezsiniz')

    const { data: target } = await UserRepository.getProfileById(targetId)
    if (!target || target.school_id !== ability.schoolId) throw new Error('Kullanıcı bulunamadı')

    const canManage = ability.can(P.USERS.MANAGE)
    if (canManage) {
      // Müdür → sadece mudur_yardimcisi atayabilir (invite ile tutarlı)
      if (newRole !== 'mudur_yardimcisi')
        throw new Error('Bu rolü atayamazsınız')
      if (target.role === 'mudur')
        throw new Error('Başka bir müdürün rolünü değiştiremezsiniz')
    } else {
      // MY → sadece ogretmen/zumre_baskani arasında atama yapabilir
      if (!['ogretmen', 'zumre_baskani'].includes(newRole))
        throw new Error('Bu rolü atayamazsınız')
      if (!['ogretmen', 'zumre_baskani'].includes(target.role))
        throw new Error('Yalnızca Öğretmen veya Zümre Başkanının rolünü değiştirebilirsiniz')
    }

    const { error } = await UserRepository.assignRole(targetId, newRole)
    if (error) throw new Error(error.message)
  },

  async updateProfile(
    userId: string,
    data: { full_name: string; subject: string | null }
  ): Promise<{ error?: string }> {
    const ability = await getAbility()
    if (!ability || ability.userId !== userId) return { error: 'Yetki yok' }

    const { error } = await UserRepository.updateProfile(userId, data)
    if (error) return { error: error.message }
    return {}
  },
}
