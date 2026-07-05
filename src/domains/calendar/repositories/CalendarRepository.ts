import { createClient } from '@/src/infrastructure/supabase/server'

// Not: createClient (kullanıcı oturumu) → RLS uygular:
//   parent_meetings: öğretmen kendi satırları, müdür/MY okul geneli (20260704120000).
//   school_events: SELECT okul üyeleri, yazma müdür/MY (20260705120000).
export const CalendarRepository = {
  // Ay aralığındaki randevular (iptal hariç). Görünürlüğü RLS kırpar.
  async listMeetings(schoolId: string, from: string, to: string) {
    const db = await createClient()
    return db
      .from('parent_meetings')
      .select('meet_date, period, students(full_name)')
      .eq('school_id', schoolId)
      .gte('meet_date', from)
      .lte('meet_date', to)
      .neq('status', 'iptal')
      .limit(1000)
  },

  // Ay aralığında teslim tarihi olan ödevler. teacherId verilirse yalnız o öğretmenin.
  async listHomeworks(schoolId: string, from: string, to: string, teacherId: string | null) {
    const db = await createClient()
    let q = db
      .from('homeworks')
      .select('title, due_date, classes(name)')
      .eq('school_id', schoolId)
      .eq('is_template', false)
      .is('deleted_at', null)
      .gte('due_date', from)
      .lte('due_date', to)
    if (teacherId) q = q.eq('teacher_id', teacherId)
    return q.limit(1000)
  },

  // Ay aralığındaki okul etkinlikleri.
  async listEvents(schoolId: string, from: string, to: string) {
    const db = await createClient()
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
