import { MentorRepository } from '../repositories/MentorRepository'
import { requireAbility } from '@/src/shared/authorization/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { createClient } from '@/src/infrastructure/supabase/server'

// Bir sınıfa rehber öğretmen atayabilen roller (yalnızca idare)
const MENTOR_ASSIGN_ROLES = ['mudur', 'mudur_yardimcisi', 'admin']

export const MentorService = {
  // Sınıfa rehber öğretmen ata/kaldır — yalnızca müdür + müdür yardımcısı (+admin).
  async assignClassMentor(classId: string, teacherId: string | null): Promise<{ error?: string }> {
    const profile = await getCurrentProfile()
    if (!profile?.school_id) return { error: 'Giriş gerekli' }
    if (!MENTOR_ASSIGN_ROLES.includes(profile.role)) {
      return { error: 'Bu işlem için yetkiniz yok' }
    }

    // Atanacak kişi varsa, aynı okulda olduğunu doğrula (cross-tenant koruması)
    if (teacherId) {
      const { data: staff } = await MentorRepository.findSchoolStaff(teacherId, profile.school_id)
      if (!staff) return { error: 'Seçilen öğretmen bu okulda bulunamadı' }
    }

    const { error } = await MentorRepository.setClassMentor(classId, teacherId, profile.school_id)
    if (error) return { error: error.message }
    return {}
  },

  // Sınıf öğrencisi için mentor raporu ekle.
  // Sadece sınıfın mentor_teacher_id'si ekleyebilir.
  async addMentorReport(data: {
    student_id:  string
    class_id:    string
    content:     string
    report_date: string
  }): Promise<{ error?: string; id?: string }> {
    const ability = await requireAbility()

    // Sınıfın mentörü olduğunu doğrula
    const supabase = await createClient()
    const { data: cls } = await supabase
      .from('classes')
      .select('mentor_teacher_id')
      .eq('id', data.class_id)
      .eq('school_id', ability.schoolId)
      .single()

    if (!cls || cls.mentor_teacher_id !== ability.userId) {
      return { error: 'Bu sınıfın mentörü değilsiniz' }
    }

    const { data: inserted, error } = await MentorRepository.insertMentorReport({
      mentor_id:   ability.userId,
      student_id:  data.student_id,
      class_id:    data.class_id,
      school_id:   ability.schoolId,
      content:     data.content,
      report_date: data.report_date,
    })
    if (error) return { error: error.message }
    return { id: inserted?.id }
  },

  async getMentorReportsByStudent(studentId: string) {
    const ability = await requireAbility()
    const { data, error } = await MentorRepository.getMentorReportsByStudent(studentId, ability.schoolId)
    if (error) return []
    return data ?? []
  },

  async getMentorReportsByClass(classId: string) {
    const ability = await requireAbility()
    const { data, error } = await MentorRepository.getMentorReportsByClass(classId, ability.schoolId)
    if (error) return []
    return data ?? []
  },

  async deleteMentorReport(reportId: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { error } = await MentorRepository.deleteMentorReport(reportId, ability.userId, ability.schoolId)
    if (error) return { error: error.message }
    return {}
  },

  // ── Kişisel mentor öğrenci defteri ──────────────────────────────────────

  async getMentorStudents() {
    const ability = await requireAbility()
    const { data } = await MentorRepository.getMentorStudents(ability.userId, ability.schoolId)
    return data ?? []
  },

  async addMentorStudent(data: {
    full_name:   string
    parent_name?: string
    phone?:      string
  }): Promise<{ error?: string; id?: string }> {
    const ability = await requireAbility()
    const { data: inserted, error } = await MentorRepository.insertMentorStudent({
      teacher_id:  ability.userId,
      school_id:   ability.schoolId,
      full_name:   data.full_name,
      parent_name: data.parent_name,
      phone:       data.phone,
    })
    if (error) return { error: error.message }
    return { id: inserted?.id }
  },

  async deleteMentorStudent(studentId: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { error } = await MentorRepository.deleteMentorStudent(studentId, ability.userId, ability.schoolId)
    if (error) return { error: error.message }
    return {}
  },
}
