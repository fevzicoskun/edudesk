import { TokenRepository } from '../repositories/TokenRepository'
import { getCurrentProfile, getCurrentUser, requireSchoolId } from '@/src/shared/auth'
import { createPublicToken, extractJti } from '@/lib/public-tokens'
import { logAudit } from '@/src/shared/audit'
import type { TokenType } from '../types'

export const TokenService = {
  async generateVeliToken(studentId: string): Promise<string> {
    const user = await getCurrentUser()
    if (!user) throw new Error('Giriş gerekli')

    const school_id = await requireSchoolId()

    const { data: student } = await TokenRepository.findStudentById(studentId, school_id)
    if (!student) throw new Error('Öğrenci bulunamadı')

    const token = await createPublicToken('veli', studentId, 7)
    const jti = extractJti(token)
    const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString()

    if (jti) {
      await TokenRepository.insertVeliToken({
        student_id: studentId,
        school_id,
        issued_by: user.id,
        jti,
        expires_at: expiresAt,
      })
    }

    await logAudit({
      user_id: user.id,
      action: 'token.generate',
      table_name: 'students',
      record_id: studentId,
      new_data: { student_name: student.full_name },
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
    token: string,
    tokenType: TokenType,
    reason?: string
  ): Promise<{ ok: boolean; error?: string }> {
    const profile = await getCurrentProfile()
    if (!profile || !['mudur', 'mudur_yardimcisi', 'zumre_baskani'].includes(profile.role)) {
      return { ok: false, error: 'Bu işlem için Zümre Başkanı veya Yönetici yetkisi gereklidir.' }
    }

    const user = await getCurrentUser()
    if (!user) return { ok: false, error: 'Giriş gerekli' }

    const jti = token.startsWith('v1.') ? extractJti(token) : token
    if (!jti) return { ok: false, error: 'Geçersiz token formatı' }

    const { error } = await TokenRepository.insertRevokedToken({
      jti,
      token_type: tokenType,
      revoked_by: user.id,
      reason: reason?.slice(0, 200) ?? null,
    })

    if (error) {
      if (error.code === '23505') return { ok: false, error: 'Token zaten iptal edilmiş' }
      return { ok: false, error: error.message }
    }

    await logAudit({
      user_id: user.id,
      action: 'token.revoke',
      table_name: 'revoked_tokens',
      new_data: { jti, token_type: tokenType, reason },
    })

    return { ok: true }
  },

  async listRevokedTokens() {
    const profile = await getCurrentProfile()
    if (profile?.role !== 'zumre_baskani') return { data: null, error: 'Yetersiz yetki' }

    const { data, error } = await TokenRepository.listRevokedTokens()
    return { data, error: error?.message }
  },
}
