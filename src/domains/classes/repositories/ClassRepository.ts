import { createClient } from '@/src/infrastructure/supabase/server'

export const ClassRepository = {
  async insertClass(data: { name: string; grade: number; academic_year: string; school_id: string }) {
    const supabase = await createClient()
    return supabase.from('classes').insert(data)
  },

  /** Sınıf + öğrenci + ödev soft-delete'i TEK transaction'da (RPC). Herhangi bir
   *  adım hata verirse tamamı geri alınır — kısmi silme imkânsız. security invoker
   *  olduğundan RLS aynen uygulanır; deleted_by fonksiyon içinde auth.uid(). */
  async softDeleteClassCascade(classId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.rpc('soft_delete_class_cascade', { p_class_id: classId, p_school_id: schoolId })
  },

  /** softDeleteClassCascade'in tersi — yine tek transaction. */
  async restoreClassCascade(classId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.rpc('restore_class_cascade', { p_class_id: classId, p_school_id: schoolId })
  },

  async softDeleteStudent(studentId: string, schoolId: string, deletedBy: string) {
    const supabase = await createClient()
    return supabase.from('students')
      .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
      .eq('id', studentId).eq('school_id', schoolId)
  },

  async restoreStudent(studentId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('students')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', studentId).eq('school_id', schoolId)
  },

  async insertStudent(data: { class_id: string; full_name: string; student_number: string | null; school_id: string }) {
    const supabase = await createClient()
    return supabase.from('students').insert(data)
  },

  async insertStudents(rows: { class_id: string; full_name: string; student_number: string | null; school_id: string }[]) {
    const supabase = await createClient()
    return supabase.from('students').insert(rows)
  },

  async deleteStudentNote(noteId: string, teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('student_notes').delete()
      .eq('id', noteId).eq('teacher_id', teacherId).eq('school_id', schoolId)
  },

  async insertStudentNote(data: { teacher_id: string; student_id: string; body: string; school_id: string }) {
    const supabase = await createClient()
    return supabase.from('student_notes').insert(data)
  },

  async findClassInSchool(classId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('classes').select('id')
      .eq('id', classId).eq('school_id', schoolId)
      .is('deleted_at', null).single()
  },

  async findStudentInSchool(studentId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('students').select('id')
      .eq('id', studentId).eq('school_id', schoolId)
      .is('deleted_at', null).single()
  },

  async insertParentContactLog(data: {
    school_id: string
    student_id: string
    teacher_id: string
    note: string
    contact_method: string
    contacted_at: string
  }) {
    const supabase = await createClient()
    return supabase.from('parent_contact_logs').insert(data)
  },

  async getParentContactLogs(studentId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('parent_contact_logs')
      .select('id, note, contact_method, contacted_at, teacher_id')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .order('contacted_at', { ascending: false })
      .limit(50)
  },

  async deleteParentContactLog(logId: string, teacherId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('parent_contact_logs')
      .delete()
      .eq('id', logId)
      .eq('teacher_id', teacherId)
      .eq('school_id', schoolId)
  },
}
