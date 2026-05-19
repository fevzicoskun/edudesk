import { MentorRepository } from '../repositories/MentorRepository'
import { getAbility, requireAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'

export const MentorService = {
  // ─── mentor_students ──────────────────────────────────────────────────────

  async addMentorStudent(data: {
    full_name:   string
    parent_name: string | null
    phone:       string | null
  }): Promise<void> {
    const ability = await getAbility()
    if (!ability) throw new Error('Oturum gerekli.')

    const { error } = await MentorRepository.insertMentorStudent({
      teacher_id:  ability.userId,
      school_id:   ability.schoolId,
      full_name:   data.full_name,
      parent_name: data.parent_name,
      phone:       data.phone,
    })
    if (error) throw new Error(error.message)
  },

  async deleteMentorStudent(id: string): Promise<void> {
    const ability = await getAbility()
    if (!ability) throw new Error('Oturum gerekli.')

    await MentorRepository.deleteMentorStudent(id, ability.userId, ability.schoolId)
  },

  // ─── mentor_student_notes ─────────────────────────────────────────────────

  async addMentorStudentNote(data: {
    mentor_student_id: string
    content:           string
  }): Promise<void> {
    const ability = await getAbility()
    if (!ability) throw new Error('Oturum gerekli.')

    const { data: student } = await MentorRepository.findMentorStudentById(
      data.mentor_student_id, ability.userId, ability.schoolId
    )
    if (!student) throw new Error('Öğrenci bulunamadı.')

    const { error } = await MentorRepository.insertMentorStudentNote({
      mentor_student_id: data.mentor_student_id,
      teacher_id:        ability.userId,
      school_id:         ability.schoolId,
      content:           data.content,
    })
    if (error) throw new Error(error.message)
  },

  async deleteMentorStudentNote(id: string): Promise<void> {
    const ability = await getAbility()
    if (!ability) throw new Error('Oturum gerekli.')

    await MentorRepository.deleteMentorStudentNote(id, ability.userId, ability.schoolId)
  },

  // ─── mentor_reports (sınıf bazlı) ────────────────────────────────────────

  async assignMentor(classId: string, teacherId: string | null): Promise<void> {
    const ability = await requireAbility()
    if (ability.cannot(P.CLASSES.UPDATE)) {
      throw new Error('Bu işlem için Müdür Yardımcısı yetkisi gereklidir.')
    }

    const { error } = await MentorRepository.assignMentor(classId, teacherId, ability.schoolId)
    if (error) throw new Error(`Mentor atanamadı: ${error.message}`)
  },

  async addMentorReport(
    studentId:  string,
    classId:    string,
    data: { content: string; report_date: string }
  ): Promise<void> {
    const ability = await getAbility()
    if (!ability) throw new Error('Oturum gerekli.')

    const { data: cls } = await MentorRepository.findClassMentor(classId, ability.schoolId)
    if (!cls || cls.mentor_teacher_id !== ability.userId) {
      throw new Error('Bu sınıfın mentörü değilsiniz.')
    }

    const { error } = await MentorRepository.insertMentorReport({
      mentor_id:   ability.userId,
      student_id:  studentId,
      class_id:    classId,
      school_id:   ability.schoolId,
      content:     data.content,
      report_date: data.report_date,
    })
    if (error) throw new Error(`Rapor kaydedilemedi: ${error.message}`)
  },

  async deleteMentorReport(reportId: string): Promise<void> {
    const ability = await getAbility()
    if (!ability) throw new Error('Oturum gerekli.')

    const { data: report } = await MentorRepository.findMentorReportById(reportId, ability.schoolId)
    if (!report) throw new Error('Rapor bulunamadı.')
    if (report.mentor_id !== ability.userId) {
      throw new Error('Bu raporu silme yetkiniz yok.')
    }

    const { error } = await MentorRepository.deleteMentorReport(reportId, ability.userId, ability.schoolId)
    if (error) throw new Error(`Rapor silinemedi: ${error.message}`)
  },
}
