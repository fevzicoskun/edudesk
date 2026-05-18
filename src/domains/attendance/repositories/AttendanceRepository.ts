import { createClient } from '@/src/shared/supabase/server'
import type { AttendanceStatus } from '../types'

export const AttendanceRepository = {
  async upsertAttendance(rows: {
    teacher_id: string
    class_id: string
    student_id: string
    date: string
    status: AttendanceStatus
    school_id: string
  }[]) {
    const supabase = await createClient()
    return supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'class_id,student_id,date' })
  },

  async findByClassAndDate(classId: string, date: string) {
    const supabase = await createClient()
    return supabase
      .from('attendance')
      .select('student_id, status')
      .eq('class_id', classId)
      .eq('date', date)
  },

  async findHistoryByClass(classId: string, since: string) {
    const supabase = await createClient()
    return supabase
      .from('attendance')
      .select('student_id, date, status')
      .eq('class_id', classId)
      .gte('date', since)
      .order('date', { ascending: false })
  },
}
