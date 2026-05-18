import { createClient } from '@/src/infrastructure/supabase/server'
import type { SubmissionStatus } from '../types'

export const HomeworkRepository = {
  async insertHomework(data: {
    teacher_id: string
    school_id: string
    class_id: string
    title: string
    description: string | null
    subject: string
    due_date: string
  }) {
    const supabase = await createClient()
    return supabase.from('homeworks').insert(data)
  },

  async findHomeworkTeacher(homeworkId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('homeworks')
      .select('teacher_id')
      .eq('id', homeworkId)
      .eq('school_id', schoolId)
      .single()
  },

  async upsertSubmissionStatus(data: {
    homework_id: string
    student_id: string
    status: SubmissionStatus
    school_id: string
    updated_at: string
  }) {
    const supabase = await createClient()
    return supabase
      .from('homework_submissions')
      .upsert(data, { onConflict: 'homework_id,student_id' })
  },

  async upsertSubmissionsStatus(rows: {
    homework_id: string
    student_id: string
    school_id: string
    status: SubmissionStatus
    updated_at: string
  }[]) {
    const supabase = await createClient()
    return supabase
      .from('homework_submissions')
      .upsert(rows, { onConflict: 'homework_id,student_id' })
  },

  async upsertSubmissionNote(data: {
    homework_id: string
    student_id: string
    note: string | null
    school_id: string
    updated_at: string
  }) {
    const supabase = await createClient()
    return supabase
      .from('homework_submissions')
      .upsert(data, { onConflict: 'homework_id,student_id' })
  },

  async softDeleteHomework(homeworkId: string, teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('homeworks')
      .update({ deleted_at: new Date().toISOString(), deleted_by: teacherId })
      .eq('id', homeworkId).eq('teacher_id', teacherId).eq('school_id', schoolId)
  },

  async restoreHomework(homeworkId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('homeworks')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', homeworkId).eq('school_id', schoolId)
  },
}
