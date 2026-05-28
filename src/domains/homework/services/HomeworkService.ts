import { HomeworkRepository } from '../repositories/HomeworkRepository'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import type { SubmissionStatus } from '../types'

const LOCK_DAYS = 3

function isHomeworkLocked(dueDate: string): boolean {
  const lock = new Date(dueDate)
  lock.setDate(lock.getDate() + LOCK_DAYS)
  lock.setHours(23, 59, 59, 999)
  return new Date() > lock
}

export const HomeworkService = {
  async createHomework(data: {
    class_id:    string
    title:       string
    description: string | null
    subject:     string
    due_date:    string
  }): Promise<{ error?: string }> {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.HOMEWORK.CREATE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const { error } = await HomeworkRepository.insertHomework({
      teacher_id: ability.userId,
      school_id:  ability.schoolId,
      ...data,
    })

    if (error) return { error: error.message }
    return {}
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
    if (isHomeworkLocked(hw.due_date)) {
      return { error: 'Bu ödevin kontrol süresi doldu. Son tarihten 3 gün sonra girişler kilitlenir.' }
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
    if (isHomeworkLocked(hw.due_date)) {
      return { error: 'Bu ödevin kontrol süresi doldu. Son tarihten 3 gün sonra girişler kilitlenir.' }
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
    if (isHomeworkLocked(hw.due_date)) {
      return { error: 'Bu ödevin kontrol süresi doldu. Son tarihten 3 gün sonra girişler kilitlenir.' }
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

  async restoreHomework(id: string): Promise<void> {
    const ability = await getAbility()
    if (!ability) return
    // Restore requires school-wide scope — own-scope teachers cannot restore
    const scope = ability.scope(P.HOMEWORK.UPDATE)
    if (!scope || scope === 'own') return

    await HomeworkRepository.restoreHomework(id, ability.schoolId)
  },
}
