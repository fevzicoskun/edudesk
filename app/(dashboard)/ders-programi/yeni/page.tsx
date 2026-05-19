import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/src/shared/auth'
import YeniProgramForm from './YeniProgramForm'

type Teacher = { id: string; full_name: string | null; subject: string | null }
type Cls = { id: string; name: string; grade: number }

export default async function YeniProgramPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return null

  const { data: profileData } = await supabase
    .from('profiles').select('school_id').eq('id', user.id).single()

  const [{ data: teachers }, { data: classes }, { data: lastOkul }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, subject')
      .eq('school_id', profileData?.school_id)
      .in('role', ['ogretmen', 'zumre_baskani'])
      .order('full_name'),
    supabase
      .from('classes')
      .select('id, name, grade')
      .order('grade').order('name'),
    supabase
      .from('lesson_schedules')
      .select('type_label')
      .eq('schedule_type', 'okul')
      .limit(1)
      .maybeSingle(),
  ])

  const okulLabel = lastOkul?.type_label ?? 'Okul Programı'

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Yeni Ders Programı</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Öğretmen veya sınıf bazında program oluşturun</p>
      </div>
      <YeniProgramForm
        teachers={(teachers ?? []) as Teacher[]}
        classes={(classes ?? []) as Cls[]}
        okulLabel={okulLabel}
      />
    </div>
  )
}
