import { MentorRepository } from '../repositories/MentorRepository'
import { requireAbility } from '@/src/shared/authorization/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { todayLocalISO } from '@/src/shared/date'

// Öğrencilere mentör atayabilen roller (yalnızca idare)
// RLS is_mudur_or_my() ile aynı küme — fazlası servisten geçip RLS'de ham hatayla düşerdi
const MENTOR_ASSIGN_ROLES = ['mudur', 'mudur_yardimcisi']

export type MentorshipRow = {
  student_id:       string
  full_name:        string
  class_name:       string | null
  /** atamayı idare yaptı → mentör listeden kendisi çıkaramaz */
  idare_atadi:      boolean
}

export const MentorService = {
  // ── Mentörlük listesi ────────────────────────────────────────────────────

  async getMyMentorships(): Promise<MentorshipRow[]> {
    const ability = await requireAbility()
    const listRes = await MentorRepository.listMentorships(ability.userId, ability.schoolId)
    // Sessiz [] = "öğrencin yok" yalanı; hata sayfanın error boundary'sine gider
    if (listRes.error) throw new Error(listRes.error.message)
    return (listRes.data ?? []).map(row => {
      const s = row.students
      return {
        student_id:       row.student_id,
        full_name:        s?.full_name ?? '—',
        class_name:       s?.classes?.name ?? null,
        idare_atadi:      row.assigned_by !== ability.userId,
      }
    })
  },

  async getMentorAdlari(): Promise<Map<string, { mentor_id: string; ad: string }>> {
    await requireAbility()
    const { data, error } = await MentorRepository.mentorAdlari()
    if (error) throw new Error(error.message)
    return new Map((data ?? []).map(r => [r.student_id, { mentor_id: r.mentor_id, ad: r.mentor_adi }]))
  },

  async addMentorship(studentId: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    // Cross-tenant koruması: öğrenci gerçekten bu okulda mı?
    const { data: student } = await MentorRepository.findStudentInSchool(studentId, ability.schoolId)
    if (!student) return { error: 'Öğrenci bulunamadı' }

    const { error } = await MentorRepository.insertMentorship({
      mentor_id: ability.userId, student_id: studentId, school_id: ability.schoolId, assigned_by: ability.userId,
    })
    if (error) {
      // Tek mentör kuralı (unique student_id): kimin öğrencisi olduğunu söyle
      if ((error as { code?: string }).code === '23505') {
        const { data } = await MentorRepository.mentorAdlari()
        const mevcut = (data ?? []).find(r => r.student_id === studentId)
        if (mevcut?.mentor_id === ability.userId) return { error: 'Bu öğrenci zaten listenizde' }
        return { error: `Bu öğrencinin mentörü ${mevcut?.mentor_adi ?? 'başka bir öğretmen'}` }
      }
      return { error: error.message }
    }
    return {}
  },

  async removeMentorship(studentId: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { data: satir, error: okuma } = await MentorRepository.findMentorshipAtama(studentId, ability.userId, ability.schoolId)
    if (okuma) return { error: okuma.message }
    if (!satir) return { error: 'Kayıt bulunamadı veya yetkiniz yok.' }
    if (satir.assigned_by !== ability.userId) return { error: 'Bu atamayı idare yaptı; kaldırmak için idareye başvurun.' }
    const { error } = await MentorRepository.deleteMentorship(studentId, ability.userId, ability.schoolId)
    if (error) return { error: error.message }
    return {}
  },

  // İdare: seçilen öğrencilere mentör ata (mentorId null → mentörlüğü kaldır).
  // Fail-closed: tek yabancı öğrenci = hiç yazma.
  async assignMentors(studentIds: string[], mentorId: string | null): Promise<{ error?: string }> {
    const profile = await getCurrentProfile()
    if (!profile?.school_id) return { error: 'Giriş gerekli' }
    if (!MENTOR_ASSIGN_ROLES.includes(profile.role)) return { error: 'Bu işlem için yetkiniz yok' }
    const schoolId = profile.school_id
    const ids = [...new Set(studentIds)]
    if (ids.length === 0) return { error: 'Öğrenci seçilmedi' }

    if (mentorId) {
      const { data: t } = await MentorRepository.findSchoolTeacher(mentorId, schoolId)
      if (!t) return { error: 'Seçilen öğretmen bu okulda bulunamadı' }
    }
    const { count, error: sayim } = await MentorRepository.countStudentsInSchool(ids, schoolId)
    if (sayim) return { error: sayim.message }
    if (count !== ids.length) return { error: 'Öğrenci bulunamadı' }

    if (!mentorId) {
      const { error } = await MentorRepository.deleteMentorshipsByStudents(ids, schoolId)
      return error ? { error: error.message } : {}
    }
    const { data, error } = await MentorRepository.upsertMentorships(
      ids.map(student_id => ({ student_id, mentor_id: mentorId, school_id: schoolId, assigned_by: profile.id })),
    )
    if (error) return { error: error.message }
    if ((data ?? []).length !== ids.length) return { error: 'Atama kaydedilemedi' }
    return {}
  },
}
