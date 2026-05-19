import { createClient } from '@/src/infrastructure/supabase/server'

export const MentorRepository = {
  // ─── mentor_students ──────────────────────────────────────────────────────

  async insertMentorStudent(data: {
    teacher_id:  string
    school_id:   string
    full_name:   string
    parent_name: string | null
    phone:       string | null
  }) {
    const supabase = await createClient()
    return supabase.from('mentor_students').insert(data)
  },

  async deleteMentorStudent(id: string, teacher_id: string, school_id: string) {
    const supabase = await createClient()
    return supabase
      .from('mentor_students')
      .delete()
      .eq('id', id)
      .eq('teacher_id', teacher_id)
      .eq('school_id', school_id)
  },

  async findMentorStudentById(id: string, teacher_id: string, school_id: string) {
    const supabase = await createClient()
    return supabase
      .from('mentor_students')
      .select('id')
      .eq('id', id)
      .eq('teacher_id', teacher_id)
      .eq('school_id', school_id)
      .single()
  },

  // ─── mentor_student_notes ─────────────────────────────────────────────────

  async insertMentorStudentNote(data: {
    mentor_student_id: string
    teacher_id:        string
    school_id:         string
    content:           string
  }) {
    const supabase = await createClient()
    return supabase.from('mentor_student_notes').insert(data)
  },

  async deleteMentorStudentNote(id: string, teacher_id: string, school_id: string) {
    const supabase = await createClient()
    return supabase
      .from('mentor_student_notes')
      .delete()
      .eq('id', id)
      .eq('teacher_id', teacher_id)
      .eq('school_id', school_id)
  },

  // ─── mentor_reports ───────────────────────────────────────────────────────

  async insertMentorReport(data: {
    mentor_id:   string
    student_id:  string
    class_id:    string
    school_id:   string
    content:     string
    report_date: string
  }) {
    const supabase = await createClient()
    return supabase.from('mentor_reports').insert(data)
  },

  async findMentorReportById(reportId: string, school_id: string) {
    const supabase = await createClient()
    return supabase
      .from('mentor_reports')
      .select('mentor_id')
      .eq('id', reportId)
      .eq('school_id', school_id)
      .single()
  },

  async deleteMentorReport(reportId: string, mentor_id: string, school_id: string) {
    const supabase = await createClient()
    return supabase
      .from('mentor_reports')
      .delete()
      .eq('id', reportId)
      .eq('mentor_id', mentor_id)
      .eq('school_id', school_id)
  },

  // ─── classes.mentor_teacher_id ────────────────────────────────────────────

  async findClassMentor(classId: string, school_id: string) {
    const supabase = await createClient()
    return supabase
      .from('classes')
      .select('mentor_teacher_id')
      .eq('id', classId)
      .eq('school_id', school_id)
      .single()
  },

  async assignMentor(classId: string, teacherId: string | null, school_id: string) {
    const supabase = await createClient()
    return supabase
      .from('classes')
      .update({ mentor_teacher_id: teacherId })
      .eq('id', classId)
      .eq('school_id', school_id)
  },
}
