'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { updateSchoolSchema } from '@/lib/validation'
import { SchoolService } from '../services/SchoolService'

/** Müdürün ilk kurulum sihirbazı. Okul adını kaydeder ve ilk kodu üretir. */
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
