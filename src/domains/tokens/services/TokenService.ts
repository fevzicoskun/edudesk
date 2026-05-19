import { TokenRepository } from '../repositories/TokenRepository'
import { getCurrentUser, requireSchoolId } from '@/src/shared/auth'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import { createPublicToken, extractJti } from '@/src/infrastructure/tokens'
import { logAudit } from '@/src/shared/audit'
import { cacheRevocation } from '@/src/infrastructure/security/revocation'
import type { TokenType } from '../types'

export const TokenService = {
  async generateVeliToken(studentId: string): Promise<string> {
    const user = await getCurrentUser()
    if (!user) throw new Error('Giriş gerekli')

    const school_id = await requireSchoolId()

    const { data: student } = await TokenRepository.findStudentById(studentId, school_id)
    if (!student) throw new Error('Öğrenci bulunamadı')

    const token = await createPublicToken('veli', studentId, 7, { school_id })
    const jti = extractJti(token)
    const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString()

    if (jti) {
      await TokenRepository.insertVeliToken({
        student_id: studentId,
        school_id,
        issued_by:  user.id,
        jti,
        expires_at: expiresAt,
      })
    }

    await logAudit({
      user_id:    user.id,
      action:     'token.generate',
      table_name: 'students',
      record_id:  studentId,
      new_data:   { student_name: student.full_name },
      school_id,
    })

    return token
  },

  async generateYoklamaToken(classId: string, date: string): Promise<string> {
    const user = await getCurrentUser()
    if (!user) throw new Error('Giriş gerekli')

    const token = await createPublicToken('yoklama', classId, 1, { date })
    return token
  },

  async revokeToken(
    token:     string,
    tokenType: TokenType,
    reason?:   string
  ): Promise<{ ok: boolean; error?: string }> {
    const ability = await getAbility()
    if (!ability) return { ok: false, error: 'Giriş gerekli' }
    if (ability.cannot(P.ZUMRE.MANAGE)) {
      return { ok: false, error: 'Bu işlem için Zümre Başkanı veya Yönetici yetkisi gereklidir.' }
    }

    const jti = token.startsWith('v1.') ? extractJti(token) : token
    if (!jti) return { ok: false, error: 'Geçersiz token formatı' }

    const { error } = await TokenRepository.insertRevokedToken({
      jti,
      token_type: tokenType,
      revoked_by: ability.userId,
      reason:     reason?.slice(0, 200) ?? null,
    })

    if (error) {
      if (error.code === '23505') return { ok: false, error: 'Token zaten iptal edilmiş' }
      return { ok: false, error: error.message }
    }

    // Warm revocation cache immediately so subsequent checks skip the DB
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await cacheRevocation(jti, expiresAt)

    await logAudit({
      user_id:    ability.userId,
      action:     'token.revoke',
      table_name: 'revoked_tokens',
      new_data:   { jti, token_type: tokenType, reason },
    })

    return { ok: true }
  },

  async listRevokedTokens() {
    const ability = await getAbility()
    if (!ability || ability.cannot(P.ZUMRE.MANAGE)) return { data: null, error: 'Yetersiz yetki' }

    const { data, error } = await TokenRepository.listRevokedTokens()
    return { data, error: error?.message }
  },
}
