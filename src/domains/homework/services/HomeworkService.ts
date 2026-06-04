import { HomeworkRepository } from '../repositories/HomeworkRepository'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import type { SubmissionStatus, HomeworkTemplate } from '@/src/shared/types'
import { computeStudentHomeworkStats, type HomeworkRecord } from '@/src/domains/homework/lib/stats'

export const HomeworkService = {
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

    if (error) return { error: error.message }
    return { id: created?.id }
  },

  async updateSubmissionStatus(
    homeworkId: string,
    studentId:  string,
    status:     SubmissionStatus
  ): Promise<{ error?: string; success?: boolean }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.HOMEWORK.UPDATE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const { data: hw } = await HomeworkRepository.findHomeworkTeacher(homeworkId, ability.schoolId)
    if (!hw) return { error: 'Ödev bulunamadı' }
    if (ability.cannot(P.HOMEWORK.UPDATE, hw.teacher_id)) {
      return { error: 'Bu ödev için yetkiniz yok' }
    }

    const { error } = await HomeworkRepository.upsertSubmissionStatus({
      homework_id: homeworkId,
      student_id:  studentId,
      status,
      school_id:   ability.schoolId,
      updated_at:  new Date().toISOString(),
    })

    if (error) return { error: error.message }
    return { success: true }
  },

  async updateAllSubmissionStatuses(
    homeworkId: string,
    studentIds: string[],
    status:     SubmissionStatus
  ): Promise<{ error?: string; success?: boolean }> {
    if (studentIds.length > 200) throw new Error('Çok fazla öğrenci')

    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.HOMEWORK.UPDATE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const { data: hw } = await HomeworkRepository.findHomeworkTeacher(homeworkId, ability.schoolId)
    if (!hw) return { error: 'Ödev bulunamadı' }
    if (ability.cannot(P.HOMEWORK.UPDATE, hw.teacher_id)) {
      return { error: 'Bu ödev için yetkiniz yok' }
    }

    const rows = studentIds.map(studentId => ({
      homework_id: homeworkId,
      student_id:  studentId,
      school_id:   ability.schoolId,
      status,
      updated_at:  new Date().toISOString(),
    }))

    if (rows.length === 0) return { success: true }

    const { error } = await HomeworkRepository.upsertSubmissionsStatus(rows)
    if (error) return { error: error.message }
    return { success: true }
  },

  async updateSubmissionNote(
    homeworkId: string,
    studentId:  string,
    note:       string
  ): Promise<{ error?: string; success?: boolean }> {
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
    data: { title: string; subject: string; description: string | null; due_date: string | null; source_id: string | null }
  ): Promise<{ error?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.HOMEWORK.UPDATE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const isManager = ability.scope(P.HOMEWORK.UPDATE) === 'school'
    const { error } = isManager
      ? await HomeworkRepository.updateHomeworkAsManager(id, ability.schoolId, data)
      : await HomeworkRepository.updateHomework(id, ability.userId, ability.schoolId, data)

    if (error) return { error: error.message }
    return {}
  },

  async deleteHomework(id: string): Promise<{ error?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.HOMEWORK.DELETE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const isManager =
      ability.scope(P.HOMEWORK.DELETE) === 'school' ||
      ability.scope(P.HOMEWORK.UPDATE) === 'school'

    const { error } = isManager
      ? await HomeworkRepository.softDeleteHomeworkAsManager(id, ability.userId, ability.schoolId)
      : await HomeworkRepository.softDeleteHomework(id, ability.userId, ability.schoolId)

    if (error) return { error: error.message }
    return {}
  },

  async restoreHomework(id: string): Promise<{ error?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    // Restore requires school-wide scope — own-scope teachers cannot restore
    const scope = ability.scope(P.HOMEWORK.UPDATE)
    if (!scope || scope === 'own') return { error: 'Bu işlem için yetkiniz yok.' }

    const { error } = await HomeworkRepository.restoreHomework(id, ability.schoolId)
    if (error) return { error: error.message }
    return {}
  },

  async getTemplatesByClass(classId: string): Promise<HomeworkTemplate[]> {
    const ability = await getAbility()
    if (!ability || ability.cannot(P.HOMEWORK.READ)) return []
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

    const profileData = await HomeworkRepository.findStudentHomeworkProfile(
      studentId, classId, ability.schoolId,
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
        status: ((sub?.status ?? 'yapilmadi') as HomeworkRecord['status']),
        note: sub?.note ?? null,
      }
    })

    return { student: profileData.student, homeworks: records, stats: computeStudentHomeworkStats(records) }
  },
}
