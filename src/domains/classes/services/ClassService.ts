import { ClassRepository } from '../repositories/ClassRepository'
import { getCurrentProfile, requireSchoolId } from '@/src/shared/auth'
import { createClient } from '@/src/shared/supabase/server'
import { logAudit } from '@/src/shared/audit'
import { getEgitimYili } from '@/src/shared/utils'

async function requireBaskan() {
  const profile = await getCurrentProfile()
  if (profile?.role !== 'zumre_baskani' && profile?.role !== 'mudur_yardimcisi') {
    throw new Error('Bu işlem için Zümre Başkanı veya Müdür Yardımcısı yetkisi gereklidir.')
  }
}

export const ClassService = {
  async createClass(data: { name: string; grade: number }) {
    await requireBaskan()
    const school_id = await requireSchoolId()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await ClassRepository.insertClass({
      name: data.name,
      grade: data.grade,
      academic_year: getEgitimYili(),
      school_id,
    })
    if (error) throw new Error(error.message)

    await logAudit({
      user_id: user.id,
      action: 'class.create',
      table_name: 'classes',
      new_data: { name: data.name, grade: data.grade },
      school_id,
    })
  },

  async deleteClass(classId: string) {
    await requireBaskan()
    const school_id = await requireSchoolId()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: homeworks } = await ClassRepository.findHomeworksByClass(classId, school_id)
    if (homeworks?.length) {
      const homeworkIds = homeworks.map(h => h.id)
      await ClassRepository.deleteHomeworkSubmissions(homeworkIds)
      await ClassRepository.deleteHomeworks(homeworkIds, school_id)
    }

    await ClassRepository.deleteAttendanceByClass(classId, school_id)
    await ClassRepository.deleteTeacherClasses(classId)
    await ClassRepository.deleteCurriculumProgressByClass(classId, school_id)
    await ClassRepository.deleteStudentsByClass(classId, school_id)
    await ClassRepository.deleteClass(classId, school_id)

    await logAudit({ user_id: user.id, action: 'class.delete', table_name: 'classes', record_id: classId })
  },

  async addStudent(classId: string, data: { full_name: string; student_number: string | null }) {
    const school_id = await requireSchoolId()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    await ClassRepository.insertStudent({
      class_id: classId,
      full_name: data.full_name,
      student_number: data.student_number ?? null,
      school_id,
    })
  },

  async addStudentsBulk(classId: string, students: { full_name: string; student_number: string | null }[]) {
    if (students.length > 100) throw new Error('En fazla 100 öğrenci eklenebilir')
    const school_id = await requireSchoolId()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const valid = students
      .map(s => ({
        full_name: s.full_name.trim().slice(0, 120),
        student_number: s.student_number?.slice(0, 20) ?? null,
      }))
      .filter(s => s.full_name.length >= 2)

    await ClassRepository.insertStudents(
      valid.map(s => ({ class_id: classId, school_id, ...s }))
    )
  },

  async deleteStudent(studentId: string) {
    await ClassRepository.deleteStudentSubmissions(studentId)
    await ClassRepository.deleteStudentNotesByStudent(studentId)
    await ClassRepository.deleteStudent(studentId)
  },

  async addStudentNote(studentId: string, data: { body: string }, teacherId: string, schoolId: string) {
    await ClassRepository.insertStudentNote({
      teacher_id: teacherId,
      student_id: studentId,
      body: data.body,
      school_id: schoolId,
    })
  },

  async deleteStudentNote(noteId: string) {
    await ClassRepository.deleteStudentNote(noteId)
  },
}
