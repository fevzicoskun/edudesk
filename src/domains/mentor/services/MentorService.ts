import { MentorRepository } from '../repositories/MentorRepository'
import { requireAbility } from '@/src/shared/authorization/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { logger } from '@/src/infrastructure/observability/logger'
import { mentorProfileSchema, type MentorProfileInput } from '../validators'
import { todayLocalISO } from '@/src/shared/date'

// Öğrencilere mentör atayabilen roller (yalnızca idare)
// RLS is_mudur_or_my() ile aynı küme — fazlası servisten geçip RLS'de ham hatayla düşerdi
const MENTOR_ASSIGN_ROLES = ['mudur', 'mudur_yardimcisi']

export type MentorshipRow = {
  student_id:       string
  full_name:        string
  class_name:       string | null
  last_report_date: string | null
  /** atamayı idare yaptı → mentör listeden kendisi çıkaramaz */
  idare_atadi:      boolean
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
    // Sessiz [] = "öğrencin yok" yalanı; hata sayfanın error boundary'sine gider
    if (listRes.error) throw new Error(listRes.error.message)
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
        idare_atadi:      row.assigned_by !== ability.userId,
      }
    })
  },

  /** Önceki mentörlük: notunu/kartını yazdığım ama artık listemde olmayan öğrenciler (salt okunur, 2026-10-07). */
  async getEskiOgrencilerim(): Promise<{ student_id: string; full_name: string; class_name: string | null }[]> {
    const ability = await requireAbility()
    const [simdiki, profiller, notlar] = await Promise.all([
      MentorService.getMyMentorships(),
      MentorRepository.myProfileStudentIds(ability.userId, ability.schoolId),
      MentorRepository.myReportStudentIds(ability.userId, ability.schoolId),
    ])
    const hata = profiller.error ?? notlar.error
    if (hata) throw new Error(hata.message)
    const simdi = new Set(simdiki.map(r => r.student_id))
    // İçi boş tanıma kartı okunacak bir şey değil — yalnız dolu kart ya da not "önceki öğrenci" yapar
    const doluKart = (profiller.data ?? []).filter(p =>
      Object.entries(p).some(([k, v]) => k !== 'student_id' && typeof v === 'string' && v.trim() !== ''))
    const ids = [...new Set([...doluKart, ...(notlar.data ?? [])].map(r => r.student_id))]
      .filter(id => !simdi.has(id))
    if (ids.length === 0) return []
    const { data, error } = await MentorRepository.findStudentsInSchool(ids, ability.schoolId)
    if (error) throw new Error(error.message)
    return (data ?? [])
      .map(s => ({ student_id: s.id, full_name: s.full_name, class_name: (s.classes as { name: string } | null)?.name ?? null }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr'))
  },

  /** Okuldaki tüm atamalar: öğrenci id → mentör (ekleme kutusu, sınıf ve öğrenci sayfası). */
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
    // hata "not yok" gibi görünmesin → error.tsx
    if (error) throw new Error(`Mentör notları okunamadı: ${error.message}`)
    return data ?? []
  },

  async getMentorReportsByClass(classId: string) {
    const ability = await requireAbility()
    const { data, error } = await MentorRepository.getMentorReportsByClass(classId, ability.schoolId)
    // hata "not yok" gibi görünmesin → error.tsx
    if (error) throw new Error(`Mentör notları okunamadı: ${error.message}`)
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
    const { data, error } = await MentorRepository.getMentorProfile(studentId, ability.userId, ability.schoolId)
    // Okuma hatası boş kart gibi görünürse mentör tek alan yazıp kaydeder ve diğer 6 alanı siler (upsert)
    if (error) throw new Error(`Tanıma kartı okunamadı: ${error.message}`)
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
