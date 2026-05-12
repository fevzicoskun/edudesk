'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateProfile(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Giriş gerekli' }

  const full_name = (formData.get('full_name') as string).trim()
  const subject = (formData.get('subject') as string).trim() || null

  if (!full_name) return { error: 'Ad Soyad boş olamaz' }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name, subject })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return {}
}
