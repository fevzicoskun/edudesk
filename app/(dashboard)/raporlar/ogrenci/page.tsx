import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import OgrenciRaporClient from './OgrenciRaporClient'

export default async function OgrenciRaporPage() {
  const [supabase, profile, user] = await Promise.all([createClient(), getCurrentProfile(), getCurrentUser()])
  if (!profile) return null

  const isYonetici = isMudurOrAbove(profile.role) || profile.role === 'zumre_baskani'

  // Öğretmen kendi sınıflarını görür; yönetici hepsini
  const classesResult = isYonetici
    ? await supabase.from('classes').select('id, name, grade').order('grade').order('name')
    : await supabase
        .from('homeworks')
        .select('class_id, classes(id, name, grade)')
        .eq('teacher_id', user?.id ?? '')
        .limit(500)

  let classes: { id: string; name: string; grade: number | null }[] = []
  if (isYonetici) {
    classes = (classesResult.data ?? []) as { id: string; name: string; grade: number | null }[]
  } else {
    const seen = new Set<string>()
    for (const row of (classesResult.data ?? [] as unknown[])) {
      const typedRow = row as { class_id: string; classes: { id: string; name: string; grade: number | null } | null }
      const cls = typedRow.classes
      if (cls && !seen.has(cls.id)) {
        seen.add(cls.id)
        classes.push(cls)
      }
    }
  }

  return (
    <OgrenciRaporClient
      classes={classes}
      schoolId={profile.school_id}
    />
  )
}
