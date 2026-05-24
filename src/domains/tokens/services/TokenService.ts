import { TokenRepository } from '../repositories/TokenRepository'
import { getCurrentUser, getCurrentProfile, requireSchoolId } from '@/src/shared/auth'
import { createPublicToken, extractJti } from '@/src/infrastructure/tokens'
import { cacheRevocation } from '@/src/infrastructure/security/revocation'
import type { TokenType } from '../types'

const REVOKE_ROLES = ['zumre_baskani', 'mudur_yardimcisi', 'mudur'] as const

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

    return token
  },

  async generateYoklamaToken(classId: string, date: string): Promise<string> {
    const user = await getCurrentUser()
    if (!user) throw new Error('Giriş gerekli')

    const school_id = await requireSchoolId()

    const { data: cls } = await TokenRepository.findClassById(classId, school_id)
    if (!cls) throw new Error('Sınıf bulunamadı')

    return createPublicToken('yoklama', classId, 1, { date, school_id })
  },

  async revokeToken(
    token:     string,
    tokenType: TokenType,
    reason?:   string
  ): Promise<{ ok: boolean; error?: string }> {
    const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
    if (!user || !profile) return { ok: false, error: 'Giriş gerekli' }

    const jti = token.startsWith('v1.') ? extractJti(token) : token
    if (!jti) return { ok: false, error: 'Geçersiz token formatı' }

    const hasManagerRole = REVOKE_ROLES.includes(profile.role as typeof REVOKE_ROLES[number])

    if (!hasManagerRole) {
      const { data: veliToken } = await TokenRepository.findVeliTokenByJti(jti)
      if (!veliToken || veliToken.issued_by !== user.id) {
        return { ok: false, error: 'Bu linki yalnızca oluşturan kişi veya yöneticiler devre dışı bırakabilir.' }
      }
    }

    const { error } = await TokenRepository.insertRevokedToken({
      jti,
      token_type: tokenType,
      revoked_by: user.id,
      reason:     reason?.slice(0, 200) ?? null,
    })

    if (error) {
      if (error.code === '23505') return { ok: false, error: 'Token zaten iptal edilmiş' }
      return { ok: false, error: error.message }
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await cacheRevocation(jti, expiresAt)

    return { ok: true }
  },

  async getActiveVeliTokens(studentId: string): Promise<{ jti: string; expires_at: string; created_at: string }[]> {
    const school_id = await requireSchoolId()
    const { data: tokens } = await TokenRepository.listActiveVeliTokens(studentId, school_id)
    if (!tokens?.length) return []

    const jtis = tokens.map(t => t.jti)
    const { data: revoked } = await TokenRepository.listRevokedByJtis(jtis)
    const revokedSet = new Set(revoked?.map(r => r.jti) ?? [])

    return tokens.filter(t => !revokedSet.has(t.jti))
  },

  async listRevokedTokens() {
    const profile = await getCurrentProfile()
    const hasManagerRole = REVOKE_ROLES.includes(profile?.role as typeof REVOKE_ROLES[number])
    if (!hasManagerRole) return { data: null, error: 'Yetersiz yetki' }

    const { data, error } = await TokenRepository.listRevokedTokens()
    return { data, error: error?.message }
  },
}
