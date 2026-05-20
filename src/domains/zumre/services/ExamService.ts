import { ExamRepository } from '../repositories/ExamRepository'
import { requireAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'

export const ExamService = {
  async createExam(data: { title: string; subject: string; exam_date: string }) {
    const ability = await requireAbility()
    if (ability.cannot(P.EXAM.MANAGE)) throw new Error('Bu işlem için Zümre Başkanı yetkisi gereklidir.')

    await ExamRepository.insertExam({ ...data, created_by: ability.userId, school_id: ability.schoolId })
  },

  async createExamReturning(data: { title: string; subject: string; exam_date: string }): Promise<
    | { id: string; title: string; subject: string; exam_date: string; entries: [] }
    | { error: string }
  > {
    const ability = await requireAbility()
    if (ability.cannot(P.EXAM.MANAGE)) throw new Error('Bu işlem için Zümre Başkanı yetkisi gereklidir.')

    const { data: result, error } = await ExamRepository.insertExamReturning({
      ...data,
      created_by: ability.userId,
      school_id: ability.schoolId,
    })

    if (error || !result) return { error: error?.message ?? 'Eklenemedi' }

    return { ...result, entries: [] }
  },

  async saveExamEntries(
    id: string,
    entries: { name: string; grade: string }[]
  ): Promise<{ error?: string }> {
    if (entries.length > 200) throw new Error('Çok fazla giriş')
    const ability = await requireAbility()

    const normalized = entries
      .map(e => ({
        name: e.name.trim() || null,
        student_id: null as string | null,
        grade: parseInt(e.grade, 10),
      }))
      .filter(e => !isNaN(e.grade) && e.grade >= 0 && e.grade <= 100)

    const { error } = await ExamRepository.replaceEntries(id, ability.schoolId, normalized)
    return { error: error?.message }
  },

  async deleteExam(id: string) {
    const ability = await requireAbility()
    if (ability.cannot(P.EXAM.MANAGE)) throw new Error('Bu işlem için Zümre Başkanı yetkisi gereklidir.')

    await ExamRepository.softDeleteExam(id, ability.schoolId, ability.userId)
  },

  async restoreExam(id: string) {
    const ability = await requireAbility()
    if (ability.cannot(P.EXAM.MANAGE)) throw new Error('Bu işlem için Zümre Başkanı yetkisi gereklidir.')

    await ExamRepository.restoreExam(id, ability.schoolId)
  },
}
