import { createClient } from '@/src/infrastructure/supabase/server'
import type { MeetingStatus } from '../parentMeetingMath'

// Not: createClient (kullanıcı oturumu) → RLS "parent_meetings_own" politikasını uygular.
export const MeetingRepository = {
  async listForTeacher(teacherId: string, schoolId: string) {
    const db = await createClient()
    return db
      .from('parent_meetings')
      .select('id, student_id, meet_date, period, status, note, students(full_name, class_id, classes(name))')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .order('meet_date', { ascending: true })
      .order('period', { ascending: true })
      .limit(1000)
  },

  async listStudentsByClassIds(classIds: string[], schoolId: string) {
    if (classIds.length === 0) return { data: [], error: null }
    const db = await createClient()
    return db
      .from('students')
      .select('id, full_name, class_id, classes(name)')
      .in('class_id', classIds)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('full_name')
      .limit(2000)
  },

  async insert(row: {
    teacher_id: string
    school_id: string
    student_id: string
    meet_date: string
    period: number
    note: string | null
  }) {
    const db = await createClient()
    return db.from('parent_meetings').insert(row).select('id').single()
  },

  async updateStatus(id: string, teacherId: string, status: MeetingStatus) {
    const db = await createClient()
    return db
      .from('parent_meetings')
      .update({ status })
      .eq('id', id)
      .eq('teacher_id', teacherId)
  },

  async deleteById(id: string, teacherId: string) {
    const db = await createClient()
    return db.from('parent_meetings').delete().eq('id', id).eq('teacher_id', teacherId)
  },
}
