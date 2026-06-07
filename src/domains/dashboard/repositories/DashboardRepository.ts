import { createClient } from '@/src/infrastructure/supabase/server'
import type { Json } from '@/src/infrastructure/supabase/database.types'

export const DashboardRepository = {
  async getTeacherHomeworks(teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('homeworks')
      .select('id, title, subject, due_date, class_id, classes(name, grade)')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('due_date', { ascending: false })
  },

  async getSubmissions(hwIds: string[]) {
    if (hwIds.length === 0) return { data: [] }
    const supabase = await createClient()
    return supabase
      .from('homework_submissions')
      .select('homework_id, student_id, status')
      .in('homework_id', hwIds)
  },

  async getAttendanceRows(classIds: string[], teacherId: string, sinceDate: string) {
    if (classIds.length === 0) return { data: [] }
    const supabase = await createClient()
    return supabase
      .from('attendance')
      .select('student_id, status')
      .in('class_id', classIds)
      .eq('teacher_id', teacherId)
      .gte('date', sinceDate)
  },

  async getStudentsByClasses(classIds: string[]) {
    if (classIds.length === 0) return { data: [] }
    const supabase = await createClient()
    return supabase
      .from('students')
      .select('id, full_name, class_id, classes(name)')
      .in('class_id', classIds)
      .is('deleted_at', null)
  },

  async getWeeklySubmissionStats(hwIds: string[], weekStart: string) {
    if (hwIds.length === 0) return { data: [] }
    const supabase = await createClient()
    return supabase
      .from('homework_submissions')
      .select('homework_id, status')
      .in('homework_id', hwIds)
      .gte('updated_at', weekStart)
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

  async getTodayClassAttendance(classIds: string[], todayStr: string) {
    if (classIds.length === 0) return { data: [] }
    const supabase = await createClient()
    return supabase
      .from('attendance')
      .select('class_id')
      .in('class_id', classIds)
      .eq('date', todayStr)
  },

  async getAttendanceTrend(classIds: string[], since: string) {
    if (classIds.length === 0) return { data: [] }
    const supabase = await createClient()
    return supabase
      .from('attendance')
      .select('date, status')
      .in('class_id', classIds)
      .gte('date', since)
      .order('date')
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
    type HwIdRow = { id: string }
    const hwIds = ((homeworks ?? []) as HwIdRow[]).map(h => h.id)
    if (hwIds.length === 0) return { data: [] }
    return supabase
      .from('homework_submissions')
      .select('homework_id, student_id, status')
      .in('homework_id', hwIds)
  },
}
