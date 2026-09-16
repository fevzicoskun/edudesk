import { createClient } from '@/src/infrastructure/supabase/server'

export const MentorRepository = {
  // ── Mentörlük listesi ────────────────────────────────────────────────────

  async listMentorships(mentorId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('mentorships')
      .select('id, student_id, students!inner(id, full_name, class_id, deleted_at, classes(name))')
      .eq('mentor_id', mentorId)
      .eq('school_id', schoolId)
      .is('students.deleted_at', null)
      .order('created_at')
  },

  async insertMentorship(data: { mentor_id: string; student_id: string; school_id: string }) {
    const supabase = await createClient()
    return supabase.from('mentorships').insert(data).select('id').single()
  },

  async deleteMentorship(studentId: string, mentorId: string, schoolId: string) {
    const supabase = await createClient()
    const { data: rows, error } = await supabase
      .from('mentorships')
      .delete()
      .eq('student_id', studentId)
      .eq('mentor_id', mentorId)
      .eq('school_id', schoolId)
      .select('id')
    if (error) return { error }
    if (!rows || rows.length === 0) return { error: { message: 'Kayıt bulunamadı veya yetkiniz yok.' } }
    return { error: null }
  },

  async findStudentInSchool(studentId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('students')
      .select('id, full_name, class_id')
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .maybeSingle()
  },

  // Her öğrencinin en son görüşme tarihi (mentöre ait notlar üzerinden)
  async lastReportDates(mentorId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('mentor_reports')
      .select('student_id, report_date')
      .eq('mentor_id', mentorId)
      .eq('school_id', schoolId)
      .order('report_date', { ascending: false })
  },

  async findMentorship(studentId: string, mentorId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('mentorships')
      .select('id')
      .eq('student_id', studentId)
      .eq('mentor_id', mentorId)
      .eq('school_id', schoolId)
      .maybeSingle()
  },

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
    const { data: rows, error } = await supabase
      .from('mentor_reports')
      .delete()
      .eq('id', reportId)
      .eq('mentor_id', mentorId)
      .eq('school_id', schoolId)
      .select('id')
    if (error) return { error }
    if (!rows || rows.length === 0) return { error: { message: 'Kayıt bulunamadı veya yetkiniz yok.' } }
    return { error: null }
  },

  // ── Sınıfa rehber öğretmen atama ────────────────────────────────────────

  // Sınıfın mentor_teacher_id'sini set/temizle (teacherId null → kaldır)
  async setClassMentor(classId: string, teacherId: string | null, schoolId: string) {
    const supabase = await createClient()
    const { data: rows, error } = await supabase
      .from('classes')
      .update({ mentor_teacher_id: teacherId })
      .eq('id', classId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .select('id')
    if (error) return { error }
    if (!rows || rows.length === 0) return { error: { message: 'Kayıt bulunamadı veya yetkiniz yok.' } }
    return { error: null }
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

  // ── Tanıma kartı ─────────────────────────────────────────────────────────

  async getMentorProfile(studentId: string, mentorId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('mentor_profiles')
      .select('goals_short, goals_long, interests, family_info, study_environment, special_note, support_request, rules_explained_at')
      .eq('student_id', studentId)
      .eq('mentor_id', mentorId)
      .eq('school_id', schoolId)
      .maybeSingle()
  },

  async upsertMentorProfile(row: {
    mentor_id:  string
    student_id: string
    school_id:  string
    updated_at: string
    [alan: string]: string | null
  }) {
    const supabase = await createClient()
    return supabase
      .from('mentor_profiles')
      .upsert(row as never, { onConflict: 'mentor_id,student_id' })
  },
}
