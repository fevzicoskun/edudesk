'use server'

import { revalidatePath } from 'next/cache'
import { UUID } from '@/src/shared/validation'
import { getCurrentUser } from '@/src/shared/auth'
import { logger } from '@/src/infrastructure/observability/logger'
import { z } from 'zod'
import { profileSchema, AssignableRole } from '@/src/domains/users/validators'
import { UserService } from '@/src/domains/users/services/UserService'
import type { Role } from '@/src/shared/types'
import type { InviteResult } from '@/src/domains/users/types'
import type { ActionResult } from '@/src/shared/types'

const inviteSchema = z.object({
  email:     z.string().email('Geçerli bir e-posta girin'),
  full_name: z.string().min(2, 'Ad soyad en az 2 karakter olmalı').max(120),
  subject:   z.string().max(100).optional(),
  role:      AssignableRole,
})

export async function inviteUser(_: unknown, formData: FormData): Promise<InviteResult> {
  const parsed = inviteSchema.safeParse({
    email:     String(formData.get('email') ?? '').trim().toLowerCase(),
    full_name: String(formData.get('full_name') ?? '').trim(),
    subject:   String(formData.get('subject') ?? '').trim() || undefined,
    role:      String(formData.get('role') ?? ''),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const result = await UserService.invite({
    email:     parsed.data.email,
    full_name: parsed.data.full_name,
    subject:   parsed.data.subject ?? null,
    role:      parsed.data.role as Role,
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

  try {
    await UserService.assignRole(targetId, newRole)
  } catch (e) {
    logger.error({ targetId, newRole, err: e instanceof Error ? e.message : String(e) }, 'assignRole: rol ataması başarısız')
    return { error: e instanceof Error ? e.message : 'Rol atanamadı' }
  }
  revalidatePath('/kullanicilar')
  return {}
}

export async function assignTeacherClass(teacherId: string, classId: string): Promise<ActionResult> {
  if (!UUID.safeParse(teacherId).success || !UUID.safeParse(classId).success) return { error: 'Geçersiz istek' }
  const result = await UserService.assignTeacherClass(teacherId, classId)
  if (!result.error) revalidatePath('/kullanicilar')
  return result
}

export async function removeTeacherClass(teacherId: string, classId: string): Promise<ActionResult> {
  if (!UUID.safeParse(teacherId).success || !UUID.safeParse(classId).success) return { error: 'Geçersiz istek' }
  const result = await UserService.removeTeacherClass(teacherId, classId)
  if (!result.error) revalidatePath('/kullanicilar')
  return result
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
