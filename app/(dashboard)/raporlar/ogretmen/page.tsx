import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import OgretmenPerformans from './OgretmenPerformans'

export default async function OgretmenRaporPage() {
  const [supabase, profile, user] = await Promise.all([createClient(), getCurrentProfile(), getCurrentUser()])
  if (!profile) return null

  const currentUserId = user?.id ?? ''

  let teachers: { id: string; full_name: string; subject: string | null }[] = []

  const sid = profile.school_id ?? ''

  if (isMudurOrAbove(profile.role)) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, subject')
      .eq('school_id', sid)
      .in('role', ['ogretmen', 'zumre_baskani'])
      .order('full_name')
    teachers = (data ?? []) as { id: string; full_name: string; subject: string | null }[]
  } else if (profile.role === 'zumre_baskani' && profile.subject) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, subject')
      .eq('school_id', sid)
      .in('role', ['ogretmen', 'zumre_baskani'])
      .eq('subject', profile.subject)
      .order('full_name')
    teachers = (data ?? []) as { id: string; full_name: string; subject: string | null }[]
  } else {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, subject')
      .eq('school_id', sid)
      .eq('id', currentUserId)
      .single()
    if (data) teachers = [data as { id: string; full_name: string; subject: string | null }]
  }

  return (
    <OgretmenPerformans
      teachers={teachers}
      currentUserId={currentUserId}
      schoolId={profile.school_id}
    />
  )
}
