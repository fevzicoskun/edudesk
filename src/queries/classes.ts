import { createClient } from '@/src/infrastructure/supabase/server'

export async function insertClass(data: {
  name: string
  grade: number
  academic_year: string
  school_id: string
}) {
  const supabase = await createClient()
  return supabase.from('classes').insert(data)
}

export async function softDeleteClass(classId: string, schoolId: string, deletedBy: string) {
  const supabase = await createClient()
  return supabase.from('classes')
    .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
    .eq('id', classId).eq('school_id', schoolId)
}

export async function restoreClass(classId: string, schoolId: string) {
  const supabase = await createClient()
  return supabase.from('classes')
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', classId).eq('school_id', schoolId)
}

export async function findHomeworksByClass(classId: string, schoolId: string) {
  const supabase = await createClient()
  return supabase.from('homeworks').select('id').eq('class_id', classId).eq('school_id', schoolId).is('deleted_at', null)
}

export async function softDeleteHomeworksByClass(classId: string, schoolId: string, deletedBy: string) {
  const supabase = await createClient()
  return supabase.from('homeworks')
    .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
    .eq('class_id', classId).eq('school_id', schoolId).is('deleted_at', null)
}

export async function restoreHomeworksByClass(classId: string, schoolId: string) {
  const supabase = await createClient()
  return supabase.from('homeworks')
    .update({ deleted_at: null, deleted_by: null })
    .eq('class_id', classId).eq('school_id', schoolId)
}

export async function softDeleteStudentsByClass(classId: string, schoolId: string, deletedBy: string) {
  const supabase = await createClient()
  return supabase.from('students')
    .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
    .eq('class_id', classId).eq('school_id', schoolId).is('deleted_at', null)
}

export async function restoreStudentsByClass(classId: string, schoolId: string) {
  const supabase = await createClient()
  return supabase.from('students')
    .update({ deleted_at: null, deleted_by: null })
    .eq('class_id', classId).eq('school_id', schoolId)
}

export async function softDeleteStudent(studentId: string, schoolId: string, deletedBy: string) {
  const supabase = await createClient()
  return supabase.from('students')
    .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
    .eq('id', studentId).eq('school_id', schoolId)
}

export async function restoreStudent(studentId: string, schoolId: string) {
  const supabase = await createClient()
  return supabase.from('students')
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', studentId).eq('school_id', schoolId)
}

export async function insertStudent(data: {
  class_id: string
  full_name: string
  student_number: string | null
  school_id: string
}) {
  const supabase = await createClient()
  return supabase.from('students').insert(data)
}

export async function insertStudents(rows: { class_id: string; full_name: string; student_number: string | null; school_id: string }[]) {
  const supabase = await createClient()
  return supabase.from('students').insert(rows)
}

export async function deleteStudentNote(noteId: string, teacherId: string, schoolId: string) {
  const supabase = await createClient()
  return supabase.from('student_notes').delete()
    .eq('id', noteId)
    .eq('teacher_id', teacherId)
    .eq('school_id', schoolId)
}

export async function insertStudentNote(data: {
  teacher_id: string
  student_id: string
  body: string
  school_id: string
}) {
  const supabase = await createClient()
  return supabase.from('student_notes').insert(data)
}
