import { getCurrentProfile } from '@/src/shared/auth'
import { redirect }          from 'next/navigation'
import { createClient }      from '@/src/infrastructure/supabase/server'
import ChecklistClient       from './ChecklistClient'

function getCurrentAcademicYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const start = month >= 9 ? year : year - 1
  return `${start}-${start + 1}`
}

export default async function OgretmenDosyasiPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const academicYear = getCurrentAcademicYear()

  const { data } = await supabase
    .from('ogretmen_dosyasi')
    .select('checked_items')
    .eq('teacher_id', profile.id)
    .eq('academic_year', academicYear)
    .maybeSingle()

  const checkedItems: string[] = data?.checked_items ?? []

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1">Öğretmen Dosyası</h1>
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-5">
        Dosyanızda bulunması gereken belgeleri işaretleyin.
      </p>
      <ChecklistClient initialChecked={checkedItems} academicYear={academicYear} />
    </div>
  )
}
