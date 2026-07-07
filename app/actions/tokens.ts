'use server'

import { redirect } from 'next/navigation'
import { UUID } from '@/src/shared/validation'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { TokenService } from '@/src/domains/tokens/services/TokenService'
import type { TokenType } from '@/src/domains/tokens/types'
import { createPublicToken, extractJti } from '@/src/infrastructure/tokens'
import { TokenRepository } from '@/src/domains/tokens/repositories/TokenRepository'
import { createClient } from '@/src/infrastructure/supabase/server'

export async function generateVeliToken(studentId: string): Promise<string> {
  UUID.parse(studentId)
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return TokenService.generateVeliToken(studentId)
}

export async function generateYoklamaToken(classId: string, date: string): Promise<string> {
  UUID.parse(classId)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Geçersiz tarih')

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return TokenService.generateYoklamaToken(classId, date)
}

export async function revokeToken(
  token: string,
  tokenType: TokenType,
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return TokenService.revokeToken(token, tokenType, reason)
}

export async function getActiveVeliTokens(studentId: string) {
  UUID.parse(studentId)
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return TokenService.getActiveVeliTokens(studentId)
}

export async function listRevokedTokens() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return TokenService.listRevokedTokens()
}

export type BulkTokenResult = {
  studentId: string
  studentName: string
  veliAd: string | null
  veliTelefon: string | null
  token: string
}

export async function generateBulkVeliTokens(classId: string): Promise<BulkTokenResult[]> {
  UUID.parse(classId)
  const [user, profile] = await Promise.all([getCurrentUser(), getCurrentProfile()])
  if (!user || !profile?.school_id) redirect('/login')

  // UI bu modalı yalnız müdür/MY'ye gösterir — action da aynı kısıtı uygular
  // (tekil generateVeliToken tüm öğretmenlere açık kalır, tasarım gereği).
  if (!['mudur', 'mudur_yardimcisi'].includes(profile.role)) {
    throw new Error('Toplu veli linki yalnızca yöneticiler tarafından oluşturulabilir')
  }

  const supabase = await createClient()
  const { data: students } = await supabase
    .from('students')
    .select('id, full_name, veli_ad, veli_telefon')
    .eq('class_id', classId)
    .eq('school_id', profile.school_id)
    .is('deleted_at', null)
    .order('full_name')

  if (!students?.length) return []

  const schoolId = profile.school_id
  const userId   = user.id
  const ttlDays  = 7

  return Promise.all(
    students.map(async (s) => {
      const token = await createPublicToken('veli', s.id, ttlDays, { school_id: schoolId })
      const jti   = extractJti(token)
      if (jti) {
        await TokenRepository.insertVeliToken({
          student_id: s.id,
          school_id:  schoolId,
          issued_by:  userId,
          jti,
          expires_at: new Date(Date.now() + ttlDays * 86_400_000).toISOString(),
        })
      }
      return {
        studentId:   s.id,
        studentName: s.full_name,
        veliAd:      s.veli_ad      ?? null,
        veliTelefon: s.veli_telefon ?? null,
        token,
      }
    })
  )
}
