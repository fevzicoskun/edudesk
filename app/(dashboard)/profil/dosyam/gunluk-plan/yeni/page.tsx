import { getCurrentProfile } from '@/src/shared/auth'
import { redirect }          from 'next/navigation'
import { createClient }      from '@/src/infrastructure/supabase/server'
import GunlukPlanForm        from './GunlukPlanForm'

export default async function YeniGunlukPlanPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: classesData } = await supabase
    .from('classes')
    .select('id, name, grade')
    .eq('school_id', profile.school_id)
    .order('grade')
    .order('name')
  const classes = (classesData ?? []) as { id: string; name: string; grade: number }[]

  return <GunlukPlanForm classes={classes} />
}
