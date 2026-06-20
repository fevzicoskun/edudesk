import { ClassRepository } from '../repositories/ClassRepository'
import { requireAbility } from '@/src/shared/authorization/server'
import { guard } from '@/src/shared/authorization'
import { P } from '@/src/shared/permissions'
import { createClient } from '@/src/infrastructure/supabase/server'
import { getEgitimYili } from '@/src/shared/utils'
import { MAX_BULK_STUDENTS } from '@/src/shared/constants/limits'
import { logger } from '@/src/infrastructure/observability/logger'

export const ClassService = {
  async createClass(data: { name: string; grade: number }) {
    const ability = await requireAbility()
    guard(ability, P.CLASSES.CREATE)

    const { error } = await ClassRepository.insertClass({
      name: data.name, grade: data.grade,
      academic_year: getEgitimYili(), school_id: ability.schoolId,
    })
    if (error) throw new Error(error.message)
  },

  async deleteClass(classId: string) {
    const ability = await requireAbility()
    guard(ability, P.CLASSES.DELETE)

    try {
      await ClassRepository.softDeleteHomeworksByClass(classId, ability.schoolId, ability.userId)
      await ClassRepository.softDeleteStudentsByClass(classId, ability.schoolId, ability.userId)
      await ClassRepository.softDeleteClass(classId, ability.schoolId, ability.userId)
    } catch (err) {
      logger.error({ classId, schoolId: ability.schoolId, err }, 'deleteClass cascade hata — kısmi silme durumu olabilir')
      throw err
    }
  },

  async restoreClass(classId: string) {
    const ability = await requireAbility()
    guard(ability, P.CLASSES.CREATE)

    await ClassRepository.restoreClass(classId, ability.schoolId)
    await ClassRepository.restoreStudentsByClass(classId, ability.schoolId)
    await ClassRepository.restoreHomeworksByClass(classId, ability.schoolId)
  },

  async addStudent(classId: string, data: { full_name: string; student_number: string | null }) {
    const ability = await requireAbility()
    guard(ability, P.STUDENTS.CREATE)

    const { data: cls } = await ClassRepository.findClassInSchool(classId, ability.schoolId)
    if (!cls) throw new Error('Sınıf bulunamadı')

    await ClassRepository.insertStudent({
      class_id: classId, full_name: data.full_name,
      student_number: data.student_number ?? null, school_id: ability.schoolId,
    })
  },

  async addStudentsBulk(classId: string, students: { full_name: string; student_number: string | null }[]) {
    if (students.length > MAX_BULK_STUDENTS) throw new Error(`En fazla ${MAX_BULK_STUDENTS} öğrenci eklenebilir`)

    const ability = await requireAbility()
    guard(ability, P.STUDENTS.CREATE)

    const { data: cls } = await ClassRepository.findClassInSchool(classId, ability.schoolId)
    if (!cls) throw new Error('Sınıf bulunamadı')

    const valid = students
      .map(s => ({ full_name: s.full_name.trim().slice(0, 120), student_number: s.student_number?.slice(0, 20) ?? null }))
      .filter(s => s.full_name.length >= 2)

    await ClassRepository.insertStudents(valid.map(s => ({ class_id: classId, school_id: ability.schoolId, ...s })))
  },

  async deleteStudent(studentId: string) {
    const ability = await requireAbility()
    guard(ability, P.STUDENTS.DELETE)

    await ClassRepository.softDeleteStudent(studentId, ability.schoolId, ability.userId)
  },

  async restoreStudent(studentId: string) {
    const ability = await requireAbility()
    guard(ability, P.STUDENTS.CREATE)

    await ClassRepository.restoreStudent(studentId, ability.schoolId)
  },

  async addStudentNote(studentId: string, data: { body: string }) {
    const ability = await requireAbility()
    guard(ability, P.NOTES.CREATE)

    const { data: student } = await ClassRepository.findStudentInSchool(studentId, ability.schoolId)
    if (!student) throw new Error('Öğrenci bulunamadı')

    await ClassRepository.insertStudentNote({ teacher_id: ability.userId, student_id: studentId, body: data.body, school_id: ability.schoolId })
  },

  async deleteStudentNote(noteId: string) {
    const ability = await requireAbility()
    guard(ability, P.NOTES.DELETE)

    await ClassRepository.deleteStudentNote(noteId, ability.userId, ability.schoolId)
  },

  async updateVeliContact(studentId: string, data: { email: string | null; telefon: string | null; ad: string | null }): Promise<{ error?: string }> {
    const ability  = await requireAbility()
    guard(ability, P.STUDENTS.UPDATE)
    const supabase = await createClient()

    // Güvenlik: veli e-postası okuldaki bir öğretmenin e-postasıyla çakışamaz (kimlik karışması).
    // Öğretmen e-postaları auth.users'ta → RLS'li client erişemez; email_is_teacher RPC
    // (SECURITY DEFINER) yalnız boolean döner ve current_school_id() ile kendi okuluyla sınırlı.
    if (data.email) {
      const { data: isTeacher, error: clashErr } = await supabase.rpc('email_is_teacher', { p_email: data.email })
      if (clashErr) return { error: 'E-posta doğrulanamadı, tekrar deneyin.' }
      if (isTeacher) return { error: 'Bu e-posta bir öğretmene ait. Veli için farklı bir e-posta girin.' }
    }

    const { error } = await supabase
      .from('students')
      .update({ veli_email: data.email, veli_telefon: data.telefon, veli_ad: data.ad })
      .eq('id', studentId)
      .eq('school_id', ability.schoolId)
    if (error) return { error: error.message }
    return {}
  },

  async addParentContactLog(studentId: string, data: {
    note: string
    contact_method: string
    contacted_at: string
  }) {
    const ability = await requireAbility()
    const { error } = await ClassRepository.insertParentContactLog({
      school_id:      ability.schoolId,
      student_id:     studentId,
      teacher_id:     ability.userId,
      note:           data.note,
      contact_method: data.contact_method,
      contacted_at:   data.contacted_at,
    })
    if (error) throw new Error(error.message)
  },

  async deleteParentContactLog(logId: string) {
    const ability = await requireAbility()
    const { error } = await ClassRepository.deleteParentContactLog(logId, ability.userId, ability.schoolId)
    if (error) throw new Error(error.message)
  },
}
