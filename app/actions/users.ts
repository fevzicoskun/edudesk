'use server'

import { revalidatePath } from 'next/cache'
import { UUID } from '@/src/shared/validation'
import { getCurrentUser } from '@/src/shared/auth'
import { profileSchema, AssignableRole } from '@/src/domains/users/validators'
import { UserService } from '@/src/domains/users/services/UserService'
import type { Role } from '@/src/shared/types'
import type { InviteResult } from '@/src/domains/users/types'
import type { ActionResult } from '@/src/shared/types'

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

export async function removeUser(targetId: string): Promise<ActionResult> {
  if (!UUID.safeParse(targetId).success) return { error: 'Geçersiz istek' }
  const result = await UserService.deleteUser(targetId)
  if (!result.error) revalidatePath('/kullanicilar')
  return result
}

export async function assignRole(targetId: string, newRole: string): Promise<ActionResult> {
  if (!UUID.safeParse(targetId).success) return { error: 'Geçersiz istek' }
  const roleResult = AssignableRole.safeParse(newRole)
  if (!roleResult.success) return { error: 'Geçersiz rol' }

  await UserService.assignRole(targetId, newRole)
  revalidatePath('/kullanicilar')
  return {}
}

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Giriş gerekli' }

  const parsed = profileSchema.safeParse({
    full_name: String(formData.get('full_name') ?? '').trim(),
    subject:   String(formData.get('subject') ?? '').trim() || null,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await UserService.updateProfile(user.id, {
    full_name: parsed.data.full_name,
    subject:   parsed.data.subject ?? null,
  })
  if (!result.error) revalidatePath('/', 'layout')
  return result
}
