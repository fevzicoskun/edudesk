'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentProfile, requireSchoolId } from '@/lib/auth'
import { updateSchoolSchema } from '@/lib/validation'

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ'
  const letters = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  const digits  = Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)).join('')
  return letters + digits
}

/** Müdürün ilk kurulum sihirbazı. Okul adını kaydeder ve ilk kodu üretir. */
export async function setupSchool(_: unknown, formData: FormData) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'mudur') return { error: 'Yetki yok' }
  if (!profile.school_id) return { error: 'Okul kaydı bulunamadı' }

  const name = String(formData.get('name') ?? '').trim()
  if (name.length < 2) return { error: 'Okul adı en az 2 karakter olmalı' }
  if (name.length > 200) return { error: 'Okul adı çok uzun' }

  const code = randomCode()
  const admin = createServiceClient()
  const { error } = await admin
    .from('schools')
    .update({ name, slug: code })
    .eq('id', profile.school_id)

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/anasayfa')
}

export async function updateSchoolSettings(_: unknown, formData: FormData) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'mudur') return { error: 'Yetki yok' }

  const parsed = updateSchoolSchema.safeParse({ name: formData.get('name') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const school_id = await requireSchoolId()
  const admin = createServiceClient()
  const { error } = await admin.from('schools').update({ name: parsed.data.name }).eq('id', school_id)
  if (error) return { error: error.message }

  revalidatePath('/anasayfa')
  return { success: true }
}

export async function regenerateSchoolCode() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'mudur') return { error: 'Yetki yok' }

  const school_id = await requireSchoolId()
  const code = randomCode()

  const admin = createServiceClient()
  const { error } = await admin.from('schools').update({ slug: code }).eq('id', school_id)
  if (error) return { error: error.message }

  revalidatePath('/anasayfa')
  return { code }
}
