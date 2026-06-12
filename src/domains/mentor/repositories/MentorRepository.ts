import { createClient } from '@/src/infrastructure/supabase/server'

export const MentorRepository = {
  // ── Mentor Reports (sınıf öğrencileri için) ─────────────────────────────

  async insertMentorReport(data: {
    mentor_id:   string
    student_id:  string
    class_id:    string
    school_id:   string
    content:     string
    report_date: string
  }) {
    const supabase = await createClient()
    return supabase.from('mentor_reports').insert(data).select('id').single()
  },

  async getMentorReportsByStudent(studentId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('mentor_reports')
      .select('id, content, report_date, mentor_id, created_at')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .order('report_date', { ascending: false })
      .limit(50)
  },

  async getMentorReportsByClass(classId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('mentor_reports')
      .select('id, content, report_date, mentor_id, student_id, created_at')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .order('report_date', { ascending: false })
      .limit(200)
  },

  async deleteMentorReport(reportId: string, mentorId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('mentor_reports')
      .delete()
      .eq('id', reportId)
      .eq('mentor_id', mentorId)
      .eq('school_id', schoolId)
  },

  // ── Mentor Students (kişisel defter) ────────────────────────────────────

  async getMentorStudents(teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('mentor_students')
      .select('id, full_name, parent_name, phone, created_at')
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
      .order('full_name')
  },

  async insertMentorStudent(data: {
    teacher_id:  string
    school_id:   string
    full_name:   string
    parent_name?: string
    phone?:      string
  }) {
    const supabase = await createClient()
    return supabase.from('mentor_students').insert(data).select('id').single()
  },

  async deleteMentorStudent(studentId: string, teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('mentor_students')
      .delete()
      .eq('id', studentId)
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
  },
}
