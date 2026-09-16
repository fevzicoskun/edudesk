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

  // ── Sınıfa rehber öğretmen atama ────────────────────────────────────────

  // Sınıfın mentor_teacher_id'sini set/temizle (teacherId null → kaldır)
  async setClassMentor(classId: string, teacherId: string | null, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('classes')
      .update({ mentor_teacher_id: teacherId })
      .eq('id', classId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
  },

  // Atanacak kişinin aynı okulda bir profil olduğunu doğrula (cross-tenant koruması)
  async findSchoolStaff(profileId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('profiles')
      .select('id')
      .eq('id', profileId)
      .eq('school_id', schoolId)
      .single()
  },
}
