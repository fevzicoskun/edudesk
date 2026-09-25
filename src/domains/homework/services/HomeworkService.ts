import { HomeworkRepository, type SubmissionLogEntry } from '../repositories/HomeworkRepository'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import type { SubmissionStatus, HomeworkTemplate, StatusResult } from '@/src/shared/types'
import { computeStudentHomeworkStats, sinifOdevKayitlari, type HomeworkRecord } from '@/src/domains/homework/lib/stats'
import { logger } from '@/src/infrastructure/observability/logger'
import { odevKapsami, type OdevKapsami } from '@/src/domains/homework/lib/kapsam'
import { getCurrentProfile } from '@/src/shared/auth'

export const HomeworkService = {
  /** Oturumdaki kullanıcının görebileceği ödev sahipleri. Profil yoksa null. */
  async getOdevKapsami(): Promise<OdevKapsami | null> {
    const profile = await getCurrentProfile()
    if (!profile?.school_id) return null
    if (profile.role !== 'zumre_baskani') return odevKapsami(profile, [])
    const { data, error } = await HomeworkRepository.findSchoolTeacherSubjects(profile.school_id)
    // Hata → yalnız kendi ödevleri (fail-closed; tüm okula açılmaz)
    if (error) logger.error({ schoolId: profile.school_id, code: error.code }, 'zümre öğretmenleri okunamadı')
    return odevKapsami(profile, data ?? [])
  },

  async createHomework(data: {
    class_id:    string
    title:       string
    description: string | null
    subject:     string
    due_date:    string | null
    source_id?:  string | null
    is_template?: boolean
  }): Promise<{ error?: string; id?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.HOMEWORK.CREATE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const { data: created, error } = await HomeworkRepository.insertHomework({
      teacher_id: ability.userId,
      school_id:  ability.schoolId,
      ...data,
      source_id: data.source_id ?? null,
    })

    if (error) {
      logger.error({ schoolId: ability.schoolId, code: error.code }, 'createHomework DB hatası')
      return { error: error.message }
    }
    return { id: created?.id }
  },

  async updateSubmissionStatus(
    homeworkId: string,
    studentId:  string,
    status:     SubmissionStatus
  ): Promise<StatusResult> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.HOMEWORK.UPDATE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const { data: hw } = await HomeworkRepository.findHomeworkTeacher(homeworkId, ability.schoolId)
    if (!hw) return { error: 'Ödev bulunamadı' }
    if (ability.cannot(P.HOMEWORK.UPDATE, hw.teacher_id)) {
      return { error: 'Bu ödev için yetkiniz yok' }
    }

    const { data: existing } = await HomeworkRepository.findCurrentSubmissionStatus(
      homeworkId, studentId, ability.schoolId
    )

    const now = new Date().toISOString()
    const { error } = await HomeworkRepository.upsertSubmissionStatus({
      homework_id: homeworkId,
      student_id:  studentId,
      status,
      school_id:   ability.schoolId,
      updated_at:  now,
      marked_at:   now,
    })

    if (error) return { error: error.message }

    await HomeworkRepository.insertSubmissionLog({
      homework_id: homeworkId,
      student_id:  studentId,
      school_id:   ability.schoolId,
      changed_by:  ability.userId,
      old_status:  existing?.status ?? null,
      new_status:  status,
      changed_at:  new Date().toISOString(),
    })

    return { success: true }
  },

  async updateAllSubmissionStatuses(
    homeworkId: string,
    studentIds: string[],
    status:     SubmissionStatus,
    /** Geri alma: durumla birlikte "işaretlendi" damgası da silinir */
    isaretiKaldir = false
  ): Promise<StatusResult> {
    if (studentIds.length > 200) return { error: 'Çok fazla öğrenci (maks. 200)' }

    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.HOMEWORK.UPDATE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const { data: hw } = await HomeworkRepository.findHomeworkTeacher(homeworkId, ability.schoolId)
    if (!hw) return { error: 'Ödev bulunamadı' }
    if (ability.cannot(P.HOMEWORK.UPDATE, hw.teacher_id)) {
      return { error: 'Bu ödev için yetkiniz yok' }
    }

    const islemZamani = new Date().toISOString()
    const rows = studentIds.map(studentId => ({
      homework_id: homeworkId,
      student_id:  studentId,
      school_id:   ability.schoolId,
      status,
      updated_at:  islemZamani,
      marked_at:   isaretiKaldir ? null : islemZamani,
    }))

    if (rows.length === 0) return { success: true }

    const { data: existing } = await HomeworkRepository.findCurrentSubmissionStatuses(
      homeworkId, studentIds, ability.schoolId
    )
    const oldStatusMap = new Map((existing ?? []).map(r => [r.student_id, r.status]))

    const { error } = await HomeworkRepository.upsertSubmissionsStatus(rows)
    if (error) {
      logger.error({ homeworkId, schoolId: ability.schoolId, code: error.code }, 'updateAllSubmissionStatuses toplu güncelleme başarısız')
      return { error: error.message }
    }

    const now = new Date().toISOString()
    const logs = studentIds.map(studentId => ({
      homework_id: homeworkId,
      student_id:  studentId,
      school_id:   ability.schoolId,
      changed_by:  ability.userId,
      old_status:  oldStatusMap.get(studentId) ?? null,
      new_status:  status,
      changed_at:  now,
    }))
    await HomeworkRepository.insertSubmissionLogs(logs)

    return { success: true }
  },

  async updateSubmissionNote(
    homeworkId: string,
    studentId:  string,
    note:       string
  ): Promise<StatusResult> {
    const sanitizedNote = String(note).slice(0, 1000).trim() || null

    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.HOMEWORK.UPDATE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const { data: hw } = await HomeworkRepository.findHomeworkTeacher(homeworkId, ability.schoolId)
    if (!hw || ability.cannot(P.HOMEWORK.UPDATE, hw.teacher_id)) {
      return { error: 'Ödev bulunamadı veya yetkiniz yok.' }
    }

    const { error } = await HomeworkRepository.upsertSubmissionNote({
      homework_id: homeworkId,
      student_id:  studentId,
      note:        sanitizedNote,
      school_id:   ability.schoolId,
      updated_at:  new Date().toISOString(),
    })

    if (error) return { error: error.message }
    return { success: true }
  },

  async updateHomework(
    id: string,
    data: { title: string; subject: string; description: string | null; due_date: string | null; source_id: string | null; class_id: string }
  ): Promise<{ error?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.HOMEWORK.UPDATE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const classExists = await HomeworkRepository.classExistsInSchool(data.class_id, ability.schoolId)
    if (!classExists) return { error: 'Geçersiz sınıf' }

    // Ödeve yazma yalnızca sahibine ait — yönetici de başkasının ödevini değiştiremez
    const { error } = await HomeworkRepository.updateHomework(id, ability.userId, ability.schoolId, data)

    if (error) return { error: error.message }
    return {}
  },

  async deleteHomework(id: string): Promise<{ error?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.HOMEWORK.DELETE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const { error } = await HomeworkRepository.softDeleteHomework(id)
    if (error) return { error: error.message }
    return {}
  },

  /** Seçilenlerden yalnızca kullanıcının kendi ödevleri silinir; atlananlar `skipped` ile raporlanır. */
  async bulkDelete(ids: string[]): Promise<{ deleted: number; skipped: number; deletedIds?: string[]; error?: string }> {
    const ability = await getAbility()
    if (!ability) return { deleted: 0, skipped: ids.length, error: 'Giriş gerekli' }
    if (ability.cannot(P.HOMEWORK.DELETE)) {
      return { deleted: 0, skipped: ids.length, error: 'Bu işlem için yetkiniz yok.' }
    }

    const { data: rows, error } = await HomeworkRepository.bulkSoftDeleteHomeworks(ids)
    if (error) {
      logger.error({ schoolId: ability.schoolId, code: error.code }, 'bulkDelete DB hatası')
      return { deleted: 0, skipped: ids.length, error: error.message }
    }
    // Gerçekten güncellenen satırlar sayılır — 0 satır güncellemek DB hatası değildir,
    // ids.length'e düşmek sessiz kayba yol açardı.
    const deletedIds = (rows ?? []).map(r => r.id)
    return { deleted: deletedIds.length, skipped: ids.length - deletedIds.length, deletedIds }
  },

  /** Silinen ödevleri geri alır (silme sonrası "Geri al"). Yalnız kendi ödevin; dönen sayı gerçekten geri gelenler. */
  async restoreHomeworks(ids: string[]): Promise<{ restored: number; error?: string }> {
    const ability = await getAbility()
    if (!ability) return { restored: 0, error: 'Giriş gerekli' }
    if (ability.cannot(P.HOMEWORK.UPDATE)) return { restored: 0, error: 'Bu işlem için yetkiniz yok.' }

    const { restored, error } = await HomeworkRepository.restoreHomeworks(ids)
    if (error) {
      logger.error({ schoolId: ability.schoolId, code: error.code }, 'restoreHomeworks DB hatası')
      return { restored: 0, error: error.message }
    }
    if (restored.length < ids.length) return { restored: restored.length, error: 'Bazı ödevler geri alınamadı.' }
    return { restored: restored.length }
  },

  async getSubmissionLogs(
    homeworkId: string,
    studentId:  string,
  ): Promise<SubmissionLogEntry[]> {
    const ability = await getAbility()
    if (!ability) return []
    if (ability.cannot(P.HOMEWORK.READ)) {
      logger.warn({ homeworkId, userId: ability.userId }, 'getSubmissionLogs: yetersiz yetki')
      return []
    }
    const { data, error } = await HomeworkRepository.findSubmissionLogs(homeworkId, studentId, ability.schoolId)
    if (error) logger.error({ homeworkId, studentId, code: (error as { code?: string }).code }, 'getSubmissionLogs DB hatası')
    return data ?? []
  },

  async getTemplatesByClass(classId: string): Promise<HomeworkTemplate[]> {
    const ability = await getAbility()
    if (!ability) return []
    if (ability.cannot(P.HOMEWORK.READ)) {
      logger.warn({ classId, userId: ability.userId }, 'getTemplatesByClass: yetersiz yetki')
      return []
    }
    const { data } = await HomeworkRepository.findTemplatesByClass(classId, ability.userId, ability.schoolId)
    return data ?? []
  },

  async getStudentHomeworkProfile(
    studentId: string,
    classId: string,
  ): Promise<
    | { error: string }
    | {
        student: { full_name: string; student_number: string | null; veli_ad: string | null; veli_telefon: string | null }
        homeworks: HomeworkRecord[]
        stats: ReturnType<typeof computeStudentHomeworkStats>
      }
  > {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.HOMEWORK.READ)) return { error: 'Bu işlem için yetkiniz yok.' }

    const kapsam = await HomeworkService.getOdevKapsami()
    if (!kapsam) return { error: 'Giriş gerekli' }
    const profileData = await HomeworkRepository.findStudentHomeworkProfile(
      studentId, classId, ability.schoolId, kapsam.tumu ? undefined : kapsam.ogretmenIds,
    )

    if ('error' in profileData && profileData.error) return { error: profileData.error }
    if (!profileData.student) return { error: 'Öğrenci bulunamadı' }

    const subMap = new Map(profileData.submissions.map(s => [s.homework_id, s]))
    const records: HomeworkRecord[] = profileData.homeworks.map(hw => {
      const sub = subMap.get(hw.id)
      return {
        id: hw.id,
        title: hw.title,
        subject: hw.subject,
        due_date: hw.due_date,
        status: (sub?.status ?? null) as HomeworkRecord['status'], // satır yok = işaretlenmedi
        note: sub?.note ?? null,
      }
    })

    return { student: profileData.student, homeworks: records, stats: computeStudentHomeworkStats(records) }
  },

  /** Sınıfın tüm öğrencileri için ödev özeti (toplu yazdırma). Numara sırasına göre, numarasızlar sonda. */
  async getClassHomeworkProfiles(classId: string): Promise<
    | { error: string }
    | { ogrenciler: { id: string; full_name: string; student_number: string | null; homeworks: HomeworkRecord[]; stats: ReturnType<typeof computeStudentHomeworkStats> }[] }
  > {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.HOMEWORK.READ)) return { error: 'Bu işlem için yetkiniz yok.' }
    const kapsam = await HomeworkService.getOdevKapsami()
    if (!kapsam) return { error: 'Giriş gerekli' }

    const { students, homeworks, submissions } = await HomeworkRepository.findClassHomeworkProfiles(
      classId, ability.schoolId, kapsam.tumu ? undefined : kapsam.ogretmenIds,
    )
    const kayitlar = sinifOdevKayitlari(students.map(s => s.id), homeworks, submissions)
    const ogrenciler = [...students]
      .sort((a, b) =>
        (a.student_number ?? '￿').localeCompare(b.student_number ?? '￿', 'tr', { numeric: true }) ||
        a.full_name.localeCompare(b.full_name, 'tr'))
      .map(s => {
        const hws = kayitlar.get(s.id) ?? []
        return { ...s, homeworks: hws, stats: computeStudentHomeworkStats(hws) }
      })
    return { ogrenciler }
  },
}
