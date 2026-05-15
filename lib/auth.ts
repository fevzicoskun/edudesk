import { cache } from 'react'
import { createClient } from './supabase/server'
import type { Profile } from './types'

export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('full_name, subject, role, school_id, schools(name)')
    .eq('id', user.id)
    .single()
  return data as Pick<Profile, 'full_name' | 'subject' | 'role'> & { school_id: string; schools: { name: string } | null } | null
})

/** Returns school_id for the current user — throws if not found. */
export async function requireSchoolId(): Promise<string> {
  const profile = await getCurrentProfile()
  if (!profile?.school_id) throw new Error('Okul bilgisi bulunamadı')
  return profile.school_id
}
