'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, requireSchoolId } from '@/lib/auth'
import { updateSchoolSchema } from '@/lib/validation'

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ'
  const letters = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  const digits  = Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)).join('')
  return letters + digits
}

export async function updateSchoolSettings(_: unknown, formData: FormData) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'mudur') return { error: 'Yetki yok' }

  const parsed = updateSchoolSchema.safeParse({ name: formData.get('name') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
  const { error } = await supabase.from('schools').update({ name: parsed.data.name }).eq('id', school_id)
  if (error) return { error: error.message }

  revalidatePath('/anasayfa')
  return { success: true }
}

export async function regenerateSchoolCode() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'mudur') return { error: 'Yetki yok' }

  const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
  const code = randomCode()

  const { error } = await supabase.from('schools').update({ slug: code }).eq('id', school_id)
  if (error) return { error: error.message }

  revalidatePath('/anasayfa')
  return { code }
}
