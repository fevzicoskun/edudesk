import { createClient } from '@/src/infrastructure/supabase/server'
import { fetchAllResult } from '@/src/shared/utils/fetchAll'

export const ActivityReportRepository = {
  async getTeachers(schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('school_id', schoolId)
      .order('full_name')
  },

  async getLogs(schoolId: string, since: string) {
    const supabase = await createClient()
    // .limit(2000) max_rows=1000'i aşamaz (sessiz kesilir) → sayfalı
    return fetchAllResult((f, t) => supabase
      .from('teacher_activity_log')
      .select('id, teacher_id, action, meta, created_at')
      .eq('school_id', schoolId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .order('id')
      .range(f, t))
  },
}
