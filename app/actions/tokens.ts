'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { UUID } from '@/lib/validation'
import { getCurrentUser } from '@/lib/auth'
import { TokenService } from '@/src/domains/tokens/services/TokenService'
import type { TokenType } from '@/src/domains/tokens/types'

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
  const result = await TokenService.revokeToken(token, tokenType, reason)
  if (result.ok) revalidatePath('/audit')
  return result
}

export async function listRevokedTokens() {
  return TokenService.listRevokedTokens()
}
