'use server'

import { revalidatePath } from 'next/cache'
import { getAbility } from '@/src/shared/authorization/server'
import { createClient } from '@/src/infrastructure/supabase/server'

function getCurrentAcademicYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const start = month >= 9 ? year : year - 1
  return `${start}-${start + 1}`
}

export async function toggleDosyaItemAction(itemKey: string) {
  const ability = await getAbility()
  if (!ability) return { error: 'Giriş gerekli' }

  const supabase = await createClient()
  const academicYear = getCurrentAcademicYear()

  const { data: existing } = await supabase
    .from('ogretmen_dosyasi')
    .select('checked_items')
    .eq('teacher_id', ability.userId)
    .eq('academic_year', academicYear)
    .maybeSingle()

  const current: string[] = existing?.checked_items ?? []
  const newItems = current.includes(itemKey)
    ? current.filter(k => k !== itemKey)
    : [...current, itemKey]

  const { error } = await supabase
    .from('ogretmen_dosyasi')
    .upsert(
      {
        teacher_id:    ability.userId,
        school_id:     ability.schoolId,
        academic_year: academicYear,
        checked_items: newItems,
        updated_at:    new Date().toISOString(),
      },
      { onConflict: 'teacher_id,academic_year' },
    )

  if (error) return { error: error.message }

  revalidatePath('/ogretmen-dosyasi')
  return {}
}
