import { MentorRepository } from '../repositories/MentorRepository'
import { requireAbility } from '@/src/shared/authorization/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { logger } from '@/src/infrastructure/observability/logger'
import { mentorProfileSchema, type MentorProfileInput } from '../validators'
import { todayLocalISO } from '@/src/shared/date'

// Bir sınıfa rehber öğretmen atayabilen roller (yalnızca idare)
const MENTOR_ASSIGN_ROLES = ['mudur', 'mudur_yardimcisi', 'admin']

export type MentorshipRow = {
  student_id:       string
  full_name:        string
  class_name:       string | null
  last_report_date: string | null
}

export type MentorProfileRow = {
  goals_short:        string | null
  goals_long:         string | null
  interests:          string | null
  family_info:        string | null
  study_environment:  string | null
  special_note:       string | null
  support_request:    string | null
  rules_explained_at: string | null
}

export const MentorService = {
  // ── Mentörlük listesi ────────────────────────────────────────────────────

  async getMyMentorships(): Promise<MentorshipRow[]> {
    const ability = await requireAbility()
    const [listRes, dateRes] = await Promise.all([
      MentorRepository.listMentorships(ability.userId, ability.schoolId),
      MentorRepository.lastReportDates(ability.userId, ability.schoolId),
    ])
    if (listRes.error) {
      logger.error({ event: 'mentorship_list_failed', userId: ability.userId, err: listRes.error.message }, 'Mentörlük listesi okunamadı')
      return []
    }
    if (dateRes.error) {
      logger.error({ event: 'mentorship_last_report_dates_failed', userId: ability.userId, err: dateRes.error.message }, 'Son görüşme tarihleri okunamadı')
    }
    // report_date'e göre azalan sıralı geldiği için ilk görülen en yenisidir
    const sonGorusme = new Map<string, string>()
    for (const r of dateRes.data ?? []) {
      if (!sonGorusme.has(r.student_id)) sonGorusme.set(r.student_id, r.report_date)
    }
    return (listRes.data ?? []).map(row => {
      const s = row.students
      return {
        student_id:       row.student_id,
        full_name:        s?.full_name ?? '—',
        class_name:       s?.classes?.name ?? null,
        last_report_date: sonGorusme.get(row.student_id) ?? null,
      }
    })
  },

  async addMentorship(studentId: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    // Cross-tenant koruması: öğrenci gerçekten bu okulda mı?
    const { data: student } = await MentorRepository.findStudentInSchool(studentId, ability.schoolId)
    if (!student) return { error: 'Öğrenci bulunamadı' }

    const { error } = await MentorRepository.insertMentorship({
      mentor_id: ability.userId, student_id: studentId, school_id: ability.schoolId,
    })
    if (error) {
      if ((error as { code?: string }).code === '23505') return { error: 'Bu öğrenci zaten listenizde' }
      return { error: error.message }
    }
    return {}
  },

  async removeMentorship(studentId: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { error } = await MentorRepository.deleteMentorship(studentId, ability.userId, ability.schoolId)
    if (error) return { error: error.message }
    return {}
  },

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

  // Öğrenciye mentor görüşme notu ekle.
  // Sadece öğrencinin kişisel mentörlük listesinde olan mentör ekleyebilir.
  // class_id istemciden alınmaz — trust boundary: öğrencinin gerçek sınıfı sunucuda okunur.
  async addMentorReport(data: {
    student_id:  string
    content:     string
    report_date: string
  }): Promise<{ error?: string; id?: string }> {
    const ability = await requireAbility()

    // Yetki: öğrenci mentörün kişisel listesinde olmalı
    const { data: mentorship } = await MentorRepository.findMentorship(
      data.student_id, ability.userId, ability.schoolId,
    )
    if (!mentorship) return { error: 'Bu öğrenci mentörlük listenizde değil' }

    // class_id istemciden değil, öğrencinin okuldaki gerçek kaydından alınır
    const { data: student } = await MentorRepository.findStudentInSchool(data.student_id, ability.schoolId)
    if (!student) return { error: 'Öğrenci bulunamadı' }

    const { data: inserted, error } = await MentorRepository.insertMentorReport({
      mentor_id:   ability.userId,
      student_id:  data.student_id,
      class_id:    student.class_id,
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

  // ── Tanıma kartı ─────────────────────────────────────────────────────────

  async getMentorProfile(studentId: string): Promise<MentorProfileRow | null> {
    const ability = await requireAbility()
    const { data } = await MentorRepository.getMentorProfile(studentId, ability.userId, ability.schoolId)
    return (data as MentorProfileRow | null) ?? null
  },

  async saveMentorProfile(studentId: string, input: MentorProfileInput): Promise<{ error?: string }> {
    const ability = await requireAbility()

    const parsed = mentorProfileSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Geçersiz veri' }

    // Yetki: öğrenci mentörün kişisel listesinde olmalı (mentorships satırı school_id'ye bağlı)
    const { data: mentorship } = await MentorRepository.findMentorship(studentId, ability.userId, ability.schoolId)
    if (!mentorship) return { error: 'Bu öğrenci mentörlük listenizde değil' }

    // Boş string -> null; "silindi" ile "hiç girilmedi" aynı kabul edilir
    const alanlar = Object.fromEntries(
      Object.entries(parsed.data).map(([k, v]) => [k, v?.trim() ? v.trim() : null]),
    )

    const { error } = await MentorRepository.upsertMentorProfile({
      mentor_id:  ability.userId,
      student_id: studentId,
      school_id:  ability.schoolId,
      updated_at: new Date().toISOString(),
      ...alanlar,
    })
    if (error) return { error: error.message }
    return {}
  },

  async markRulesExplained(studentId: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    // Yetki: öğrenci mentörün kişisel listesinde olmalı (mentorships satırı school_id'ye bağlı)
    const { data: mentorship } = await MentorRepository.findMentorship(studentId, ability.userId, ability.schoolId)
    if (!mentorship) return { error: 'Bu öğrenci mentörlük listenizde değil' }

    const { error } = await MentorRepository.upsertMentorProfile({
      mentor_id:          ability.userId,
      student_id:         studentId,
      school_id:          ability.schoolId,
      updated_at:         new Date().toISOString(),
      rules_explained_at: todayLocalISO(),
    })
    if (error) return { error: error.message }
    return {}
  },
}
