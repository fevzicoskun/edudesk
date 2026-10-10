'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { redirect } from 'next/navigation'
import { updateSchoolSchema } from '@/src/domains/school/validators'
import { SchoolService } from '@/src/domains/school/services/SchoolService'

export async function setupSchool(_: unknown, formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const result = await SchoolService.setupSchool(name)
  if (result.error) return { error: result.error }

  revalidatePath('/', 'layout')
  redirect('/anasayfa')
}

export async function updateSchoolSettings(_: unknown, formData: FormData) {
  const parsed = updateSchoolSchema.safeParse({ name: formData.get('name') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const result = await SchoolService.updateSchoolSettings(parsed.data.name)
  if (result.error) return { error: result.error }

  revalidatePath('/anasayfa')
  return { success: true }
}

export async function regenerateSchoolCode() {
  const result = await SchoolService.regenerateSchoolCode()
  if (result.error) return { error: result.error }

  revalidatePath('/anasayfa')
  return { code: result.code }
}

/** Yoklama modülü aç/kapat — yalnız müdür/MY (servis + RPC doğrular). Tüm sayfalar yeniden hesaplanır. */
export async function setYoklamaAktif(aktif: unknown) {
  const parsed = z.boolean().safeParse(aktif)
  if (!parsed.success) return { error: 'Geçersiz değer' }
  const result = await SchoolService.setYoklamaAktif(parsed.data)
  if (result.error) return { error: result.error }
  revalidatePath('/', 'layout')
  return { success: true }
}
