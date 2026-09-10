import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/src/infrastructure/supabase/server'
import type { Database } from '@/src/infrastructure/supabase/database.types'

export type CalendarDb = SupabaseClient<Database>

// Okuma metodları client'ı parametre alır:
//   /takvim → createClient (kullanıcı oturumu, RLS uygular):
//     parent_meetings: öğretmen kendi satırları, müdür/MY okul geneli (20260704120000).
//     school_events: SELECT okul üyeleri, yazma müdür/MY (20260705120000).
//   ICS beslemesi → service-role (RLS YOK). Bu yüzden kapsam RLS'e bırakılmaz: her sorgu school_id ile,
//   yönetici değilse teacherId ile AÇIKÇA filtrelenir (RLS ile aynı sonuç; çerezli yolda savunma katmanı).
export const CalendarRepository = {
  // Aralıktaki randevular (iptal hariç). teacherId verilirse yalnız o öğretmenin.
  async listMeetings(db: CalendarDb, schoolId: string, from: string, to: string, teacherId: string | null) {
    let q = db
      .from('parent_meetings')
      .select('id, meet_date, period, students(full_name)')
      .eq('school_id', schoolId)
      .gte('meet_date', from)
      .lte('meet_date', to)
      .neq('status', 'iptal')
    if (teacherId) q = q.eq('teacher_id', teacherId)
    return q.limit(1000)
  },

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
    return q.limit(1000)
  },

  // Aralıktaki okul etkinlikleri (okulun tüm üyelerine açık).
  async listEvents(db: CalendarDb, schoolId: string, from: string, to: string) {
    return db
      .from('school_events')
      .select('id, title, event_date, note')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .gte('event_date', from)
      .lte('event_date', to)
      .order('event_date')
      .limit(500)
  },

  async insertEvent(row: { school_id: string; title: string; event_date: string; note: string | null; created_by: string }) {
    const db = await createClient()
    return db.from('school_events').insert(row).select('id').single()
  },

  // Soft-delete (RLS UPDATE policy'si müdür/MY zorlar).
  async softDeleteEvent(id: string, schoolId: string, deletedBy: string) {
    const db = await createClient()
    return db
      .from('school_events')
      .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
      .eq('id', id)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
  },
}
