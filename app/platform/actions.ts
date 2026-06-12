'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { getCurrentUser } from '@/src/shared/auth'
import { z } from 'zod'

async function requirePlatformAdmin() {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = createServiceClient()
  const { data } = await supabase.from('platform_admins').select('id').eq('id', user.id).maybeSingle()
  return data ? supabase : null
}

const NewSchoolSchema = z.object({
  name:         z.string().min(3).max(100),
  slug:         z.string().regex(/^[A-Z]{3,4}\d{3,4}$/, 'Format: ABC123'),
  status:       z.enum(['active', 'trial', 'suspended']),
  mudur_email:  z.string().email().optional().or(z.literal('')),
  mudur_name:   z.string().min(2).max(80).optional().or(z.literal('')),
})

export async function createSchool(_prev: { error?: string; ok?: boolean } | null, formData: FormData) {
  const supabase = await requirePlatformAdmin()
  if (!supabase) return { error: 'Yetkisiz' }

  const parsed = NewSchoolSchema.safeParse({
    name:        formData.get('name'),
    slug:        formData.get('slug'),
    status:      formData.get('status'),
    mudur_email: formData.get('mudur_email') || undefined,
    mudur_name:  formData.get('mudur_name') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { name, slug, status, mudur_email, mudur_name } = parsed.data

  // Okul oluştur
  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .insert({ name, slug, status })
    .select('id')
    .single()

  if (schoolErr) {
    if (schoolErr.code === '23505') return { error: 'Bu slug zaten kullanılıyor' }
    return { error: 'Okul oluşturulamadı' }
  }

  // Müdür daveti
  if (mudur_email) {
    const { data: invited, error: invErr } = await supabase.auth.admin.inviteUserByEmail(mudur_email, {
      data: { full_name: mudur_name || '' },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://myedudesk.com.tr'}/onboarding`,
    })

    if (!invErr && invited.user) {
      await supabase.from('profiles').upsert({
        id:        invited.user.id,
        school_id: school.id,
        role:      'mudur',
        full_name: mudur_name || '',
      })
    }
  }

  revalidatePath('/platform')
  return { ok: true }
}

export async function updateSchoolStatus(schoolId: string, status: 'active' | 'trial' | 'suspended') {
  const supabase = await requirePlatformAdmin()
  if (!supabase) return

  await supabase.from('schools').update({ status }).eq('id', schoolId)
  revalidatePath('/platform')
}

export async function cancelSchool(schoolId: string) {
  const supabase = await requirePlatformAdmin()
  if (!supabase) return { error: 'Yetkisiz' }

  await supabase
    .from('schools')
    .update({ status: 'cancelled', suspended_at: new Date().toISOString() })
    .eq('id', schoolId)

  revalidatePath('/platform')
  return { ok: true }
}
