import { getCurrentProfile } from '@/src/shared/auth'
import { createClient } from '@/src/infrastructure/supabase/server'
import { redirect } from 'next/navigation'
import ExportPanel from './ExportPanel'

const ALLOWED_ROLES = ['ogretmen', 'zumre_baskani', 'mudur_yardimcisi', 'mudur'] as const

export const revalidate = 300

export default async function RaporlarPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.role || !(ALLOWED_ROLES as readonly string[]).includes(profile.role)) redirect('/anasayfa')

  const supabase = await createClient()
  const { data: classes } = await supabase
    .from('classes')
    .select('id, name, grade')
    .eq('school_id', profile.school_id!)
    .is('deleted_at', null)
    .order('grade')
    .order('name')

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Raporlar</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Excel formatında dışa aktarma
        </p>
      </div>
      <ExportPanel classes={classes ?? []} />
    </div>
  )
}
