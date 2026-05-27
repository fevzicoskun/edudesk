import { getCurrentProfile } from '@/src/shared/auth'
import { redirect }          from 'next/navigation'
import { createClient }      from '@/src/infrastructure/supabase/server'
import { InspectionRepository } from '@/src/domains/inspection/repositories/InspectionRepository'
import NotebookCheckClient   from './NotebookCheckClient'

export default async function DefterKontrolPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const [checksResult, classesResult] = await Promise.all([
    InspectionRepository.findNotebookChecks(profile.id, profile.school_id),
    supabase.from('classes').select('id, name, grade')
      .eq('school_id', profile.school_id).order('grade').order('name'),
  ])

  const checks = checksResult.data ?? []
  const classes = classesResult.data ?? []

  return (
    <div>
      <h1 className="text-lg font-bold mb-4">Defter Kontrolü</h1>
      <NotebookCheckClient classes={classes} checks={checks} />
    </div>
  )
}
