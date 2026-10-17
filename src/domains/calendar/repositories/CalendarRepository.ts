import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAllResult } from '@/src/shared/utils/fetchAll'
import type { Database } from '@/src/infrastructure/supabase/database.types'

export type CalendarDb = SupabaseClient<Database>

// Okuma metodları client'ı parametre alır:
//   /takvim → createClient (kullanıcı oturumu, RLS uygular):
//   ICS beslemesi → service-role (RLS YOK). Bu yüzden kapsam RLS'e bırakılmaz: her sorgu school_id ile,
//   yönetici değilse teacherId ile AÇIKÇA filtrelenir (RLS ile aynı sonuç; çerezli yolda savunma katmanı).
export const CalendarRepository = {
  // Aralıkta teslim tarihi olan ödevler. teacherId verilirse yalnız o öğretmenin.
  async listHomeworks(db: CalendarDb, schoolId: string, from: string, to: string, teacherId: string | null) {
    let q = db
      .from('homeworks')
      .select('id, title, due_date, classes(name)')
      .eq('school_id', schoolId)
      .eq('is_template', false)
      .is('deleted_at', null)
      .gte('due_date', from)
      .lte('due_date', to)
    if (teacherId) q = q.eq('teacher_id', teacherId)
    q = q.order('id')
    return fetchAllResult((f, t) => q.range(f, t)) // .limit(1000) = max_rows: sessiz kesilirdi
  },
}
