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

  async deleteClass(classId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('classes').delete().eq('id', classId).eq('school_id', schoolId)
  },

  async findHomeworksByClass(classId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('homeworks').select('id').eq('class_id', classId).eq('school_id', schoolId)
  },

  async deleteHomeworkSubmissions(homeworkIds: string[]) {
    const supabase = await createClient()
    return supabase.from('homework_submissions').delete().in('homework_id', homeworkIds)
  },

  async deleteHomeworks(homeworkIds: string[], schoolId: string) {
    const supabase = await createClient()
    return supabase.from('homeworks').delete().in('id', homeworkIds).eq('school_id', schoolId)
  },

  async deleteAttendanceByClass(classId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('attendance').delete().eq('class_id', classId).eq('school_id', schoolId)
  },

  async deleteTeacherClasses(classId: string) {
    const supabase = await createClient()
    return supabase.from('teacher_classes').delete().eq('class_id', classId)
  },

  async deleteCurriculumProgressByClass(classId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('curriculum_progress').delete().eq('class_id', classId).eq('school_id', schoolId)
  },

  async deleteStudentsByClass(classId: string, schoolId: string) {
    const supabase = await createClient()
    return supabase.from('students').delete().eq('class_id', classId).eq('school_id', schoolId)
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

  async deleteStudentSubmissions(studentId: string) {
    const supabase = await createClient()
    return supabase.from('homework_submissions').delete().eq('student_id', studentId)
  },

  async deleteStudentNotesByStudent(studentId: string) {
    const supabase = await createClient()
    return supabase.from('student_notes').delete().eq('student_id', studentId)
  },

  async deleteStudent(studentId: string) {
    const supabase = await createClient()
    return supabase.from('students').delete().eq('id', studentId)
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
