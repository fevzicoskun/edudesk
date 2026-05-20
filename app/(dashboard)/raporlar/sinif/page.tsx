import { createClient } from '@/src/infrastructure/supabase/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import SinifIstatistikler from './SinifIstatistikler'

export default async function SinifRaporPage() {
  const [supabase, profile] = await Promise.all([createClient(), getCurrentProfile()])
  if (!profile) return null

  const isYonetici = isMudurOrAbove(profile.role) || profile.role === 'zumre_baskani'

  let classes: { id: string; name: string; grade: number | null }[] = []

  if (isYonetici) {
    const { data } = await supabase
      .from('classes')
      .select('id, name, grade')
      .order('grade')
      .order('name')
    classes = (data ?? []) as { id: string; name: string; grade: number | null }[]
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('homeworks')
      .select('class_id, classes(id, name, grade)')
      .eq('teacher_id', user?.id ?? '')
      .limit(500)
    const seen = new Set<string>()
    for (const row of (data ?? [] as unknown[])) {
      const typedRow = row as { class_id: string; classes: { id: string; name: string; grade: number | null } | null }
      const cls = typedRow.classes
      if (cls && !seen.has(cls.id)) { seen.add(cls.id); classes.push(cls) }
    }
  }

  return (
    <SinifIstatistikler
      classes={classes}
      schoolId={profile.school_id}
    />
  )
}
