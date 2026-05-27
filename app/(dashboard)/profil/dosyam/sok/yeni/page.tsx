import { getCurrentProfile } from '@/src/shared/auth'
import { redirect }          from 'next/navigation'
import { createClient }      from '@/src/infrastructure/supabase/server'
import SokForm               from './SokForm'

function getCurrentAcademicYear(): string {
  const now = new Date(); const m = now.getMonth() + 1; const y = now.getFullYear()
  const s = m >= 9 ? y : y - 1; return `${s}-${s + 1}`
}

export default async function YeniSokPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const [{ data: classesData }, { data: teachersData }] = await Promise.all([
    supabase.from('classes').select('id, name, grade')
      .eq('school_id', profile.school_id).order('grade').order('name'),
    supabase.from('profiles').select('id, full_name, subject')
      .eq('school_id', profile.school_id).eq('role', 'ogretmen'),
  ])

  const classes  = (classesData  ?? []) as { id: string; name: string; grade: number }[]
  const teachers = (teachersData ?? []) as { id: string; full_name: string; subject: string | null }[]

  const now = new Date()
  const month = now.getMonth() + 1
  const currentTerm: 1 | 2 = (month >= 9 || month <= 1) ? 1 : 2

  return (
    <SokForm
      classes={classes}
      teachers={teachers}
      currentTerm={currentTerm}
      academicYear={getCurrentAcademicYear()}
    />
  )
}
