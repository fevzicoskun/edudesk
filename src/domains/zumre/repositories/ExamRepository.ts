import { createClient } from '@/src/shared/supabase/server'

export const ExamRepository = {
  async insertExam(data: {
    title: string
    subject: string
    exam_date: string
    created_by: string
    school_id: string
  }) {
    const supabase = await createClient()
    return supabase.from('common_exams').insert(data)
  },

  async insertExamReturning(data: {
    title: string
    subject: string
    exam_date: string
    created_by: string
    school_id: string
  }) {
    const supabase = await createClient()
    return supabase
      .from('common_exams')
      .insert(data)
      .select('id, title, subject, exam_date')
      .single()
  },

  async replaceEntries(
    examId: string,
    schoolId: string,
    entries: { name: string | null; student_id: string | null; grade: number }[]
  ) {
    const supabase = await createClient()
    const { error: delErr } = await supabase
      .from('exam_entries')
      .delete()
      .eq('exam_id', examId)
      .eq('school_id', schoolId)
    if (delErr) return { error: delErr }
    if (entries.length === 0) return { error: null }
    return supabase.from('exam_entries').insert(
      entries.map(e => ({ exam_id: examId, school_id: schoolId, ...e }))
    )
  },

  async softDeleteExam(id: string, schoolId: string, deletedBy: string) {
    const supabase = await createClient()
    return supabase.from('common_exams')
      .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
      .eq('id', id).eq('school_id', schoolId)
  },

  async restoreExam(id: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('common_exams')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', id).eq('school_id', schoolId)
  },
}
