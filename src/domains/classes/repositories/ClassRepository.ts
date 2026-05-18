import { createClient } from '@/src/shared/supabase/server'

export const ClassRepository = {
  async insertClass(data: {
    name: string
    grade: number
    academic_year: string
    school_id: string
  }) {
    const supabase = await createClient()
    return supabase.from('classes').insert(data)
  },

  async softDeleteClass(classId: string, schoolId: string, deletedBy: string) {
    const supabase = await createClient()
    return supabase.from('classes')
      .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
      .eq('id', classId).eq('school_id', schoolId)
  },

  async restoreClass(classId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('classes')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', classId).eq('school_id', schoolId)
  },

  async findHomeworksByClass(classId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('homeworks').select('id').eq('class_id', classId).eq('school_id', schoolId).is('deleted_at', null)
  },

  async softDeleteHomeworksByClass(classId: string, schoolId: string, deletedBy: string) {
    const supabase = await createClient()
    return supabase.from('homeworks')
      .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
      .eq('class_id', classId).eq('school_id', schoolId).is('deleted_at', null)
  },

  async restoreHomeworksByClass(classId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('homeworks')
      .update({ deleted_at: null, deleted_by: null })
      .eq('class_id', classId).eq('school_id', schoolId)
  },

  async softDeleteStudentsByClass(classId: string, schoolId: string, deletedBy: string) {
    const supabase = await createClient()
    return supabase.from('students')
      .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
      .eq('class_id', classId).eq('school_id', schoolId).is('deleted_at', null)
  },

  async restoreStudentsByClass(classId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('students')
      .update({ deleted_at: null, deleted_by: null })
      .eq('class_id', classId).eq('school_id', schoolId)
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

  async insertStudent(data: {
    class_id: string
    full_name: string
    student_number: string | null
    school_id: string
  }) {
    const supabase = await createClient()
    return supabase.from('students').insert(data)
  },

  async insertStudents(rows: { class_id: string; full_name: string; student_number: string | null; school_id: string }[]) {
    const supabase = await createClient()
    return supabase.from('students').insert(rows)
  },

  async deleteStudentNote(noteId: string) {
    const supabase = await createClient()
    return supabase.from('student_notes').delete().eq('id', noteId)
  },

  async insertStudentNote(data: {
    teacher_id: string
    student_id: string
    body: string
    school_id: string
  }) {
    const supabase = await createClient()
    return supabase.from('student_notes').insert(data)
  },
}
