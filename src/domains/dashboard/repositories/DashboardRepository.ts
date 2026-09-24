import { createClient } from '@/src/infrastructure/supabase/server'
import type { Json } from '@/src/infrastructure/supabase/database.types'
import { fetchAllResult } from '@/src/shared/utils/fetchAll'

export const DashboardRepository = {
  async getTeacherHomeworks(teacherId: string, schoolId: string, sinceDate?: string) {
    const supabase = await createClient()
    let q = supabase
      .from('homeworks')
      .select('id, title, subject, due_date, class_id, classes(name, grade)')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('due_date', { ascending: false })
    if (sinceDate) q = q.gte('due_date', sinceDate)
    return q
  },

  async getSubmissions(hwIds: string[], schoolId: string) {
    if (hwIds.length === 0) return { data: [] }
    const supabase = await createClient()
    return fetchAllResult((f, t) => supabase
      .from('homework_submissions')
      .select('homework_id, student_id, status')
      .not('marked_at', 'is', null) // yalnız öğretmenin işaretledikleri — otomatik açılan boş satırlar varsayılan 'yapilmadi'
      .in('homework_id', hwIds)
      .eq('school_id', schoolId)
      .order('id')
      .range(f, t))
  },

  async getAttendanceRows(classIds: string[], teacherId: string, sinceDate: string, schoolId: string) {
    if (classIds.length === 0) return { data: [] }
    const supabase = await createClient()
    return fetchAllResult((f, t) => supabase
      .from('attendance')
      .select('student_id, status')
      .in('class_id', classIds)
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .gte('date', sinceDate)
      .order('id')
      .range(f, t))
  },

  async getStudentsByClasses(classIds: string[], schoolId: string) {
    if (classIds.length === 0) return { data: [] }
    const supabase = await createClient()
    return supabase
      .from('students')
      .select('id, full_name, class_id, classes(name)')
      .in('class_id', classIds)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .limit(500)
  },

  async getWeeklySubmissionStats(hwIds: string[], weekStart: string) {
    if (hwIds.length === 0) return { data: [] }
    const supabase = await createClient()
    return fetchAllResult((f, t) => supabase
      .from('homework_submissions')
      .select('homework_id, status')
      .not('marked_at', 'is', null) // yalnız öğretmenin işaretledikleri — otomatik açılan boş satırlar varsayılan 'yapilmadi'
      .in('homework_id', hwIds)
      .gte('updated_at', weekStart)
      .order('id')
      .range(f, t))
  },

  async insertActivityLog(row: {
    teacher_id: string
    school_id: string
    action: string
    meta?: Record<string, unknown> | null
  }) {
    const supabase = await createClient()
    await supabase.from('teacher_activity_log').insert({ ...row, meta: row.meta as Json | undefined })
  },

  async getTodayClassAttendance(classIds: string[], todayStr: string, schoolId: string) {
    if (classIds.length === 0) return { data: [] }
    const supabase = await createClient()
    return supabase
      .from('attendance')
      .select('class_id')
      .in('class_id', classIds)
      .eq('school_id', schoolId)
      .eq('date', todayStr)
  },


  async getClassSubmissions(classId: string, teacherId: string, schoolId: string) {
    const supabase = await createClient()
    const { data: homeworks } = await supabase
      .from('homeworks')
      .select('id')
      .eq('class_id', classId)
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .limit(300)
    type HwIdRow = { id: string }
    const hwIds = ((homeworks ?? []) as HwIdRow[]).map(h => h.id)
    if (hwIds.length === 0) return { data: [] }
    return fetchAllResult((f, t) => supabase
      .from('homework_submissions')
      .select('homework_id, student_id, status')
      .not('marked_at', 'is', null) // yalnız öğretmenin işaretledikleri — otomatik açılan boş satırlar varsayılan 'yapilmadi'
      .in('homework_id', hwIds)
      .order('id')
      .range(f, t))
  },
}
