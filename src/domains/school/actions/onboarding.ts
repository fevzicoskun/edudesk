'use server'

import { redirect } from 'next/navigation'
import { OnboardingService } from '../services/OnboardingService'
import { createSchoolSchema, joinSchoolSchema } from '../validators'

/** Yeni okul oluştur ve profile ata — kurucu otomatik zumre_baskani olur */
export async function setupSchool(formData: FormData): Promise<{ error?: string }> {
  const parsed = createSchoolSchema.safeParse({ name: formData.get('name') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const result = await OnboardingService.setupSchool(parsed.data.name)
  if ('redirect' in result) redirect('/anasayfa')
  if (result.error) return result

  redirect('/anasayfa')
}

/** Mevcut okula slug/kod ile katıl */
export async function joinSchool(formData: FormData): Promise<{ error?: string }> {
  const parsed = joinSchoolSchema.safeParse({ code: formData.get('code') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const result = await OnboardingService.joinSchool(parsed.data.code)
  if ('redirect' in result) redirect('/anasayfa')
  if (result.error) return result

  redirect('/anasayfa')
}
