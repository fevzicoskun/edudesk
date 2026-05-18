import { createClient } from '@/src/shared/supabase/server'
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

  async deleteSubmissionsByHomework(homeworkId: string) {
    const supabase = await createClient()
    return supabase.from('homework_submissions').delete().eq('homework_id', homeworkId)
  },

  async deleteHomework(homeworkId: string, teacherId: string) {
    const supabase = await createClient()
    return supabase.from('homeworks').delete().eq('id', homeworkId).eq('teacher_id', teacherId)
  },
}
