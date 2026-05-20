import {
  insertClass, softDeleteClass, restoreClass,
  softDeleteHomeworksByClass, restoreHomeworksByClass,
  softDeleteStudentsByClass, restoreStudentsByClass,
  softDeleteStudent, restoreStudent,
  insertStudent, insertStudents,
  insertStudentNote, deleteStudentNote,
} from '@/src/queries/classes'
import { getCurrentUser, requireSchoolId } from '@/src/shared/auth'
import { requireAbility } from '@/src/shared/authorization/server'
import { guard } from '@/src/shared/authorization'
import { P } from '@/src/shared/permissions'
import { createClient } from '@/src/infrastructure/supabase/server'
import { logAudit } from '@/src/shared/audit'
import { getEgitimYili } from '@/src/shared/utils'

export const ClassService = {
  async createClass(data: { name: string; grade: number }) {
    const ability = await requireAbility()
    guard(ability, P.CLASSES.CREATE)

    const school_id = ability.schoolId
    const supabase  = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await insertClass({
      name: data.name, grade: data.grade,
      academic_year: getEgitimYili(), school_id,
    })
    if (error) throw new Error(error.message)

    await logAudit({
      user_id: user.id, action: 'class.create', table_name: 'classes',
      new_data: { name: data.name, grade: data.grade }, school_id,
    })
  },

  async deleteClass(classId: string) {
    const ability   = await requireAbility()
    guard(ability, P.CLASSES.DELETE)

    const school_id = ability.schoolId
    const supabase  = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    await softDeleteHomeworksByClass(classId, school_id, user.id)
    await softDeleteStudentsByClass(classId, school_id, user.id)
    await softDeleteClass(classId, school_id, user.id)

    await logAudit({ user_id: user.id, action: 'class.delete', table_name: 'classes', record_id: classId, school_id })
  },

  async restoreClass(classId: string) {
    const ability   = await requireAbility()
    guard(ability, P.CLASSES.CREATE)   // restore = sınıf oluşturma yetkisi

    const school_id = ability.schoolId
    const supabase  = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    await restoreClass(classId, school_id)
    await restoreStudentsByClass(classId, school_id)
    await restoreHomeworksByClass(classId, school_id)

    await logAudit({ user_id: user.id, action: 'class.restore', table_name: 'classes', record_id: classId, school_id })
  },

  async addStudent(classId: string, data: { full_name: string; student_number: string | null }) {
    const school_id = await requireSchoolId()
    const supabase  = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    await insertStudent({
      class_id: classId, full_name: data.full_name,
      student_number: data.student_number ?? null, school_id,
    })
  },

  async addStudentsBulk(classId: string, students: { full_name: string; student_number: string | null }[]) {
    if (students.length > 100) throw new Error('En fazla 100 öğrenci eklenebilir')

    const school_id = await requireSchoolId()
    const supabase  = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const valid = students
      .map(s => ({ full_name: s.full_name.trim().slice(0, 120), student_number: s.student_number?.slice(0, 20) ?? null }))
      .filter(s => s.full_name.length >= 2)

    await insertStudents(valid.map(s => ({ class_id: classId, school_id, ...s })))
  },

  async deleteStudent(studentId: string) {
    const school_id = await requireSchoolId()
    const supabase  = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    await softDeleteStudent(studentId, school_id, user.id)
    await logAudit({ user_id: user.id, action: 'student.delete', table_name: 'students', record_id: studentId, school_id })
  },

  async restoreStudent(studentId: string) {
    const ability   = await requireAbility()
    guard(ability, P.STUDENTS.CREATE)  // restore = oluşturma yetkisi

    const school_id = ability.schoolId
    const supabase  = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    await restoreStudent(studentId, school_id)
    await logAudit({ user_id: user.id, action: 'student.restore', table_name: 'students', record_id: studentId, school_id })
  },

  async addStudentNote(studentId: string, data: { body: string }) {
    const school_id = await requireSchoolId()
    const supabase  = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Giriş gerekli')

    await insertStudentNote({ teacher_id: user.id, student_id: studentId, body: data.body, school_id })
  },

  async deleteStudentNote(noteId: string) {
    const [schoolId, user] = await Promise.all([requireSchoolId(), getCurrentUser()])
    if (!user) throw new Error('Giriş gerekli')
    await deleteStudentNote(noteId, user.id, schoolId)
  },
}
