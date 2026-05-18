'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { profileSchema, UUID } from '@/lib/validation'
import { UserService } from '../services/UserService'
import { AssignableRole } from '../validators'
import type { Role } from '@/src/shared/types'
import type { InviteResult, DeleteResult } from '../types'

export async function inviteUser(_: unknown, formData: FormData): Promise<InviteResult> {
  const email     = String(formData.get('email') ?? '').trim().toLowerCase()
  const full_name = String(formData.get('full_name') ?? '').trim()
  const subject   = String(formData.get('subject') ?? '').trim() || null
  const roleRaw   = String(formData.get('role') ?? '')
  const roleResult = AssignableRole.safeParse(roleRaw)
  if (!roleResult.success) return { error: 'Geçersiz rol' }

  const result = await UserService.invite({
    email,
    full_name,
    subject,
    role: roleResult.data as Role,
  })

  if (result.success) revalidatePath('/kullanicilar')
  return result
}

export async function removeUser(targetId: string): Promise<DeleteResult> {
  const result = await UserService.deleteUser(targetId)
  if (result.success) revalidatePath('/kullanicilar')
  return result
}

export async function assignRole(targetId: string, newRole: string) {
  UUID.parse(targetId)
  AssignableRole.parse(newRole)

  await UserService.assignRole(targetId, newRole)
  revalidatePath('/kullanicilar')
}

export async function updateProfile(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Giriş gerekli' }

  const parsed = profileSchema.safeParse({
    full_name: String(formData.get('full_name') ?? '').trim(),
    subject:   String(formData.get('subject') ?? '').trim() || null,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await UserService.updateProfile(user.id, {
    full_name: parsed.data.full_name,
    subject: parsed.data.subject ?? null,
  })
  if (!result.error) revalidatePath('/', 'layout')
  return result
}
