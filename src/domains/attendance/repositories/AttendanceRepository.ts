import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/src/infrastructure/supabase/database.types'
import type { AbsenceCount } from '../types'
import { logger } from '@/src/infrastructure/observability/logger'

type Client = SupabaseClient<Database>

export const AttendanceRepository = {
  /**
   * Yıl boyu devamsızlık sayımını sunucu-taraflı (RPC ile) çeker — satırların
   * tamamını çekip JS'te toplamak yerine. countAbsences ile birebir aynı semantik
   * (hafta sonu hariç, absent=1/late=0.5/excused=1). RLS okul kapsamını korur.
   * Hata durumunda eski davranışı korur: boş map döner (sayfa boş rapor gösterir).
   */
  async getAbsenceCounts(db: Client, schoolId: string, since: string): Promise<Record<string, AbsenceCount>> {
    const { data, error } = await db.rpc('count_absences_by_student', { p_school_id: schoolId, p_since: since })
    if (error) {
      logger.error({ event: 'db_query_failed', query: 'count_absences_by_student', school_id: schoolId, message: error.message }, 'Devamsızlık sayım RPC başarısız')
      return {}
    }
    const out: Record<string, AbsenceCount> = {}
    for (const r of data ?? []) {
      out[r.student_id] = { unexcused: Number(r.unexcused), excused: Number(r.excused) }
    }
    return out
  },
  async findClass(db: Client, classId: string, schoolId: string) {
    const { data } = await db
      .from('classes')
      .select('id, mentor_teacher_id')
      .eq('id', classId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .single()
    return data
  },

  async findByClassDate(db: Client, classId: string, schoolId: string, date: string) {
    const { data, error } = await db
      .from('attendance')
      .select('student_id, status')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .eq('date', date)
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async upsertEntries(db: Client, rows: Database['public']['Tables']['attendance']['Insert'][]) {
    const { error } = await db
      .from('attendance')
      .upsert(rows, { onConflict: 'class_id,student_id,date' })
    if (error) throw new Error(error.message)
  },

  async findClassRange(db: Client, classId: string, schoolId: string, from: string, to: string) {
    const { data, error } = await db
      .from('attendance')
      .select('student_id, status, date')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .gte('date', from)
      .lte('date', to)
      .limit(5000)
    if (error) throw new Error(error.message)
    return data ?? []
  },

  async findStudentHistory(db: Client, studentId: string, schoolId: string, from: string) {
    const { data, error } = await db
      .from('attendance')
      .select('date, status')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .gte('date', from)
      .neq('status', 'present')
      .order('date', { ascending: false })
      .limit(500)
    if (error) throw new Error(error.message)
    return data ?? []
  },
}
