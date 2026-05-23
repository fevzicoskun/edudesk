'use server'

import { redirect } from 'next/navigation'
import { UUID } from '@/src/shared/validation'
import { getCurrentUser } from '@/src/shared/auth'
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
  return TokenService.listRevokedTokens()
}
