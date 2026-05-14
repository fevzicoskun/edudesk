'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getCurrentProfile, requireSchoolId } from '@/lib/auth'
import { createPublicToken, extractJti } from '@/lib/public-tokens'
import { UUID } from '@/lib/validation'
import { logAudit } from '@/lib/audit'

/** Öğrenci için 7 günlük veli portalı linki oluştur */
export async function generateVeliToken(studentId: string): Promise<string> {
  UUID.parse(studentId)
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
  const { data: student } = await supabase
    .from('students')
    .select('id, full_name')
    .eq('id', studentId)
    .eq('school_id', school_id)
    .single()
  if (!student) throw new Error('Öğrenci bulunamadı')

  const token = await createPublicToken('veli', studentId, 7)

  await logAudit({
    user_id: user.id,
    action: 'student.create',
    table_name: 'students',
    record_id: studentId,
    new_data: { action: 'veli_token_generated', student_name: student.full_name },
  })

  return token
}

/** Yoklama yazdırma linki oluştur (1 günlük) */
export async function generateYoklamaToken(classId: string, date: string): Promise<string> {
  UUID.parse(classId)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Geçersiz tarih')

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const token = await createPublicToken('yoklama', classId, 1, { date })
  return token
}

/** Tutanak yazdırma linki oluştur (7 günlük) */
export async function generateTutanakToken(meetingId: string): Promise<string> {
  UUID.parse(meetingId)
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const token = await createPublicToken('tutanak', meetingId, 7)
  return token
}

/**
 * Bir token'ı iptal et (baskan yetkisi gerekli).
 * token parametresi ya tam token string'i ya da bare jti olabilir.
 */
export async function revokeToken(
  token: string,
  tokenType: 'veli' | 'yoklama' | 'tutanak',
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  const profile = await getCurrentProfile()
  if (profile?.role !== 'zumre_baskani') {
    return { ok: false, error: 'Bu işlem için Zümre Başkanı yetkisi gereklidir.' }
  }

  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'Giriş gerekli' }

  const jti = token.startsWith('v1.') ? extractJti(token) : token
  if (!jti) return { ok: false, error: 'Geçersiz token formatı' }

  const supabase = await createClient()
  const { error } = await supabase.from('revoked_tokens').insert({
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

  revalidatePath('/audit')
  return { ok: true }
}

/** İptal edilmiş token'ların listesi (baskan) */
export async function listRevokedTokens() {
  const profile = await getCurrentProfile()
  if (profile?.role !== 'zumre_baskani') return { data: null, error: 'Yetersiz yetki' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('revoked_tokens')
    .select('jti, token_type, revoked_at, reason')
    .order('revoked_at', { ascending: false })
    .limit(100)

  return { data, error: error?.message }
}
