import {
  insertClass, softDeleteClass, restoreClass,
  softDeleteHomeworksByClass, restoreHomeworksByClass,
  softDeleteStudentsByClass, restoreStudentsByClass,
  softDeleteStudent, restoreStudent,
  insertStudent, insertStudents,
  insertStudentNote, deleteStudentNote,
  findClassInSchool, findStudentInSchool,
} from '@/src/queries/classes'
import { requireAbility } from '@/src/shared/authorization/server'
import { guard } from '@/src/shared/authorization'
import { P } from '@/src/shared/permissions'
import { createClient } from '@/src/infrastructure/supabase/server'
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
  },

  async restoreClass(classId: string) {
    const ability   = await requireAbility()
    guard(ability, P.CLASSES.CREATE)

    const school_id = ability.schoolId
    const supabase  = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    await restoreClass(classId, school_id)
    await restoreStudentsByClass(classId, school_id)
    await restoreHomeworksByClass(classId, school_id)
  },

  async addStudent(classId: string, data: { full_name: string; student_number: string | null }) {
    const ability   = await requireAbility()
    guard(ability, P.STUDENTS.CREATE)

    const { data: cls } = await findClassInSchool(classId, ability.schoolId)
    if (!cls) throw new Error('Sınıf bulunamadı')

    await insertStudent({
      class_id: classId, full_name: data.full_name,
      student_number: data.student_number ?? null, school_id: ability.schoolId,
    })
  },

  async addStudentsBulk(classId: string, students: { full_name: string; student_number: string | null }[]) {
    if (students.length > 100) throw new Error('En fazla 100 öğrenci eklenebilir')

    const ability   = await requireAbility()
    guard(ability, P.STUDENTS.CREATE)

    const { data: cls } = await findClassInSchool(classId, ability.schoolId)
    if (!cls) throw new Error('Sınıf bulunamadı')

    const valid = students
      .map(s => ({ full_name: s.full_name.trim().slice(0, 120), student_number: s.student_number?.slice(0, 20) ?? null }))
      .filter(s => s.full_name.length >= 2)

    await insertStudents(valid.map(s => ({ class_id: classId, school_id: ability.schoolId, ...s })))
  },

  async deleteStudent(studentId: string) {
    const ability   = await requireAbility()
    guard(ability, P.STUDENTS.DELETE)

    const supabase  = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    await softDeleteStudent(studentId, ability.schoolId, user.id)
  },

  async restoreStudent(studentId: string) {
    const ability   = await requireAbility()
    guard(ability, P.STUDENTS.CREATE)

    const school_id = ability.schoolId
    const supabase  = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    await restoreStudent(studentId, school_id)
  },

  async addStudentNote(studentId: string, data: { body: string }) {
    const ability   = await requireAbility()
    guard(ability, P.NOTES.CREATE)

    const { data: student } = await findStudentInSchool(studentId, ability.schoolId)
    if (!student) throw new Error('Öğrenci bulunamadı')

    await insertStudentNote({ teacher_id: ability.userId, student_id: studentId, body: data.body, school_id: ability.schoolId })
  },

  async deleteStudentNote(noteId: string) {
    const ability   = await requireAbility()
    guard(ability, P.NOTES.DELETE)

    await deleteStudentNote(noteId, ability.userId, ability.schoolId)
  },

  async updateVeliContact(studentId: string, data: { email: string | null; telefon: string | null; ad: string | null }) {
    const ability  = await requireAbility()
    const supabase = await createClient()
    await supabase
      .from('students')
      .update({ veli_email: data.email, veli_telefon: data.telefon, veli_ad: data.ad })
      .eq('id', studentId)
      .eq('school_id', ability.schoolId)
  },
}
