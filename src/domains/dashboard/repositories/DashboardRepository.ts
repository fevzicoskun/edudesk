import { createClient } from '@/src/infrastructure/supabase/server'

export const DashboardRepository = {
  async getTeacherHomeworks(teacherId: string) {
    const supabase = await createClient()
    return supabase
      .from('homeworks')
      .select('id, title, subject, due_date, class_id, classes(name, grade)')
      .eq('teacher_id', teacherId)
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

  async getWeeklyRiskCount(teacherId: string, weekStart: string) {
    const supabase = await createClient()
    const { count } = await supabase
      .from('student_risk_history')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .neq('risk_level', 'low')
      .gte('snapshot_at', weekStart)
    return count ?? 0
  },

  async insertRiskSnapshots(rows: {
    student_id: string
    school_id: string
    teacher_id: string
    risk_level: string
    risk_score: number
    hw_misses: number
    absences: number
  }[]) {
    if (rows.length === 0) return
    const supabase = await createClient()
    await supabase.from('student_risk_history').insert(rows)
  },

  async insertActivityLog(row: {
    teacher_id: string
    school_id: string
    action: string
    meta?: object
  }) {
    const supabase = await createClient()
    await supabase.from('teacher_activity_log').insert(row)
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

  async getClassSubmissions(classId: string, teacherId: string) {
    const supabase = await createClient()
    const { data: homeworks } = await supabase
      .from('homeworks')
      .select('id')
      .eq('class_id', classId)
      .eq('teacher_id', teacherId)
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
