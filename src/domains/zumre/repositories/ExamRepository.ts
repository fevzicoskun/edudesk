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
      .select('id, title, subject, exam_date, grades, grade_map')
      .single()
  },

  async updateExamGrades(id: string, schoolId: string, grades: number[]) {
    const supabase = await createClient()
    return supabase.from('common_exams').update({ grades }).eq('id', id).eq('school_id', schoolId)
  },

  async updateExamEntries(id: string, schoolId: string, grades: number[], gradeMap: { name: string; grade: string }[]) {
    const supabase = await createClient()
    return supabase
      .from('common_exams')
      .update({ grades, grade_map: gradeMap })
      .eq('id', id)
      .eq('school_id', schoolId)
  },

  async deleteExam(id: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('common_exams').delete().eq('id', id).eq('school_id', schoolId)
  },
}
