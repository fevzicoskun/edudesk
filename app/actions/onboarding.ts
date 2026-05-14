'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'
import { z } from 'zod'

const schoolSchema = z.object({
  name: z.string().min(2, 'Okul adı en az 2 karakter olmalı').max(120).trim(),
})

export async function setupSchool(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const parsed = schoolSchema.safeParse({ name: formData.get('name') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const supabase = await createClient()

  // Check if profile already has school (idempotency)
  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()

  if (profile?.school_id) redirect('/anasayfa')

  // Create school
  const slug = parsed.data.name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 60) + '-' + Date.now().toString(36)

  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .insert({ name: parsed.data.name, slug })
    .select('id')
    .single()

  if (schoolErr || !school) return { error: schoolErr?.message ?? 'Okul oluşturulamadı' }

  // Assign to profile
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ school_id: school.id })
    .eq('id', user.id)

  if (profileErr) return { error: profileErr.message }

  redirect('/anasayfa')
}
