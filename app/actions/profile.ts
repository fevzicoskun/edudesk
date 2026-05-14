'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { profileSchema } from '@/lib/validation'

export async function updateProfile(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Giriş gerekli' }

  const parsed = profileSchema.safeParse({
    full_name: String(formData.get('full_name') ?? '').trim(),
    subject: String(formData.get('subject') ?? '').trim() || null,
    okul_adi: String(formData.get('okul_adi') ?? '').trim() || null,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

  const { error } = await supabase
    .from('profiles')
    .update(parsed.data)
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return {}
}

export async function updateSchoolSlug(slug: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'zumre_baskani') return { error: 'Yetkisiz' }
  if (!profile.school_id) return { error: 'Okul bulunamadı' }

  const cleaned = slug.trim().toLowerCase()
    .replace(/[çÇ]/g, 'c').replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u').replace(/[öÖ]/g, 'o').replace(/[ıİ]/g, 'i')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  if (cleaned.length < 3) return { error: 'Kod en az 3 karakter olmalı' }
  if (cleaned.length > 60) return { error: 'Kod en fazla 60 karakter olabilir' }

  const { error } = await supabase
    .from('schools')
    .update({ slug: cleaned })
    .eq('id', profile.school_id)

  if (error) return { error: error.code === '23505' ? 'Bu kod zaten kullanımda, başka bir kod deneyin.' : error.message }

  revalidatePath('/profil')
  return {}
}
