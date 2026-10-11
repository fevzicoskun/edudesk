import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/src/infrastructure/supabase/database.types'
import { fetchAll } from '@/src/shared/utils/fetchAll'
import { todayLocalISO } from '@/src/shared/date'
import { odevTakibi, type TakipOdev, type TakipTeslim } from '@/src/domains/homework/lib/odev-takibi'

/** Ödev Takibi ekranı, okul karnesi ve aylık rapor için ortak ham okuma — hepsi aynı rakamı gösterir. */
export async function odevTakibiHamVeri(supabase: SupabaseClient<Database>, sid: string) {
  // fetchAll hata fırlatır → error.tsx; eksik veriyle "0 ödev" gibi yanıltıcı ekran gösterilmez
  const [homeworks, submissions, students, classes, profiles] = await Promise.all([
    fetchAll<TakipOdev>((f, t) => supabase
      .from('homeworks')
      .select('id, title, subject, class_id, teacher_id, due_date, assigned_date')
      .eq('school_id', sid).is('deleted_at', null).eq('is_template', false)
      .order('id').range(f, t)),
    fetchAll<TakipTeslim>((f, t) => supabase
      .from('homework_submissions')
      // yalnız öğretmenin işaretledikleri — otomatik açılan boş satırlar 'yapılmadı' değildir
      .select('homework_id, student_id, status, marked_at, homeworks!inner(id)')
      .eq('school_id', sid).not('marked_at', 'is', null)
      .is('homeworks.deleted_at', null).eq('homeworks.is_template', false)
      .order('id').range(f, t)),
    fetchAll<{ id: string; full_name: string; class_id: string }>((f, t) => supabase
      .from('students').select('id, full_name, class_id')
      .eq('school_id', sid).is('deleted_at', null)
      .order('id').range(f, t)),
    fetchAll<{ id: string; name: string }>((f, t) => supabase
      .from('classes').select('id, name').eq('school_id', sid)
      .order('id').range(f, t)),
    fetchAll<{ id: string; full_name: string }>((f, t) => supabase
      .from('profiles').select('id, full_name').eq('school_id', sid)
      .order('id').range(f, t)),
  ])

  return {
    homeworks, submissions, students,
    ogretmenler: new Map(profiles.map(p => [p.id, p.full_name])),
    siniflar: new Map(classes.map(c => [c.id, c.name])),
    bugun: todayLocalISO(),
  }
}

export async function odevTakibiVerisi(supabase: SupabaseClient<Database>, sid: string, ders: string | null) {
  return odevTakibi({ ...(await odevTakibiHamVeri(supabase, sid)), ders })
}
