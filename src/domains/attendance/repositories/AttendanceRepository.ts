import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/src/infrastructure/supabase/database.types'

type Client = SupabaseClient<Database>

export const AttendanceRepository = {
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

  async isTeacherOfClass(db: Client, teacherId: string, classId: string) {
    const { data } = await db
      .from('teacher_classes')
      .select('class_id')
      .eq('teacher_id', teacherId)
      .eq('class_id', classId)
      .maybeSingle()
    return !!data
  },
}
