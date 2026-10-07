import { createClient } from '@/src/infrastructure/supabase/server'

export const MentorRepository = {
  // ── Mentörlük listesi ────────────────────────────────────────────────────

  async listMentorships(mentorId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('mentorships')
      .select('id, student_id, assigned_by, students!inner(id, full_name, class_id, deleted_at, classes(name))')
      .eq('mentor_id', mentorId)
      .eq('school_id', schoolId)
      .is('students.deleted_at', null)
      .order('created_at')
  },

  async insertMentorship(data: { mentor_id: string; student_id: string; school_id: string; assigned_by: string }) {
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

  async findMentorshipAtama(studentId: string, mentorId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('mentorships')
      .select('assigned_by')
      .eq('student_id', studentId)
      .eq('mentor_id', mentorId)
      .eq('school_id', schoolId)
      .maybeSingle()
  },

  // Okuldaki tüm atamalar: öğrenci → mentör adı (SECURITY DEFINER, yalnız ad döner)
  async mentorAdlari() {
    const supabase = await createClient()
    return supabase.rpc('ogrenci_mentor_adlari')
  },

  // ── Önceki mentörlük (salt okunur) ──────────────────────────────────────

  async myProfileStudentIds(mentorId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('mentor_profiles')
      .select('student_id, goals_short, goals_long, interests, family_info, study_environment, special_note, support_request')
      .eq('mentor_id', mentorId)
      .eq('school_id', schoolId)
  },

  async myReportStudentIds(mentorId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('mentor_reports').select('student_id').eq('mentor_id', mentorId).eq('school_id', schoolId)
  },

  async findStudentsInSchool(studentIds: string[], schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('students')
      .select('id, full_name, classes(name)')
      .in('id', studentIds)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
  },

  // Menü: silinmemiş öğrencisi olan mentörlük sayısı (listMentorships ile aynı süzme)
  async countActiveMentorships(mentorId: string) {
    const supabase = await createClient()
    return supabase
      .from('mentorships')
      .select('id, students!inner(deleted_at)', { count: 'exact', head: true })
      .eq('mentor_id', mentorId)
      .is('students.deleted_at', null)
  },

  // ── İdare: öğrenci bazlı atama ──────────────────────────────────────────

  // Mentör adayı: okulun öğretmeni ya da zümre başkanı (mentörlük ekranı yalnız bu rollere açık)
  async findSchoolTeacher(profileId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('profiles')
      .select('id')
      .eq('id', profileId)
      .eq('school_id', schoolId)
      .in('role', ['ogretmen', 'zumre_baskani'])
      .maybeSingle()
  },

  async countStudentsInSchool(studentIds: string[], schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .in('id', studentIds)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
  },

  async upsertMentorships(rows: { student_id: string; mentor_id: string; school_id: string; assigned_by: string }[]) {
    const supabase = await createClient()
    return supabase.from('mentorships').upsert(rows, { onConflict: 'student_id' }).select('id')
  },

  // Atanmamış öğrenci seçildiyse 0 satır silinmesi meşrudur — sayım kontrolü bilinçli olarak yok
  async deleteMentorshipsByStudents(studentIds: string[], schoolId: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('mentorships').delete().in('student_id', studentIds).eq('school_id', schoolId)
    return { error }
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
