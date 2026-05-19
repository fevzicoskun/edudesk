import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import OgretmenPerformans from './OgretmenPerformans'

export default async function OgretmenRaporPage() {
  const [supabase, profile, user] = await Promise.all([createClient(), getCurrentProfile(), getCurrentUser()])
  if (!profile) return null

  const currentUserId = user?.id ?? ''

  let teachers: { id: string; full_name: string; subject: string | null }[] = []

  if (isMudurOrAbove(profile.role)) {
    // Tüm öğretmenler
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, subject')
      .in('role', ['ogretmen', 'zumre_baskani'])
      .order('full_name')
    teachers = (data ?? []) as { id: string; full_name: string; subject: string | null }[]
  } else if (profile.role === 'zumre_baskani' && profile.subject) {
    // Aynı subject'teki öğretmenler
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, subject')
      .in('role', ['ogretmen', 'zumre_baskani'])
      .eq('subject', profile.subject)
      .order('full_name')
    teachers = (data ?? []) as { id: string; full_name: string; subject: string | null }[]
  } else {
    // Sadece kendi verisi
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, subject')
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
