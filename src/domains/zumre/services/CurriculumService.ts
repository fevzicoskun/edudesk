import { CurriculumRepository } from '../repositories/CurriculumRepository'
import { requireSchoolId } from '@/src/shared/auth'
import { createClient } from '@/src/infrastructure/supabase/server'
import { TYMM_DATA, topicToString } from '@/src/domains/zumre/data/tymm'
import type { CurriculumStatus } from '../types'

type ImportState = { imported?: number; skipped?: number; error?: string } | null

export const CurriculumService = {
  async createProgress(data: {
    class_id: string
    topic: string
    week_number: number | null
    status: CurriculumStatus
  }) {
    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Giriş gerekli')

    const { class_id, topic, week_number, status } = data

    await CurriculumRepository.insertProgress({
      teacher_id: user.id,
      class_id,
      topic,
      week_number: week_number ?? null,
      status,
      completed: status !== 'eksik_kaldi',
      completion_date: status === 'tamamlandi' ? new Date().toISOString().split('T')[0] : null,
      school_id,
    })
  },

  async setStatus(id: string, status: CurriculumStatus) {
    const [supabase, schoolId] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await CurriculumRepository.updateProgressStatus(id, user.id, schoolId, {
      status,
      completed: status !== 'eksik_kaldi',
      completion_date: status === 'tamamlandi' ? new Date().toISOString().split('T')[0] : null,
    })
  },

  async removeProgress(id: string) {
    const [supabase, schoolId] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await CurriculumRepository.deleteProgress(id, user.id, schoolId)
  },

  async clearClassCurriculum(classId: string) {
    const [supabase, schoolId] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await CurriculumRepository.clearClassCurriculum(classId, user.id, schoolId)
  },

  async importFromTYMM(subject: string, classId: string): Promise<ImportState> {
    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Giriş gerekli' }

    const { data: cls } = await CurriculumRepository.findClassGrade(classId, school_id)
    if (!cls) return { error: 'Sınıf bulunamadı' }

    const tymmTopics = TYMM_DATA[subject]?.[cls.grade]
    if (!tymmTopics || tymmTopics.length === 0)
      return { error: 'Bu ders/sınıf için TYMM verisi bulunamadı' }

    const { data: existing } = await CurriculumRepository.findExistingTopics(user.id, classId)
    const existingSet = new Set((existing ?? []).map(r => r.topic))

    const newTopics = tymmTopics.filter(t => !existingSet.has(topicToString(t)))
    const skipped = tymmTopics.length - newTopics.length

    if (newTopics.length === 0) return { imported: 0, skipped, error: undefined }

    const rows = newTopics.map((t, i) => ({
      teacher_id: user.id,
      class_id: classId,
      topic: topicToString(t),
      week_number: i + 1,
      status: 'tamamlandi' as CurriculumStatus,
      completed: true,
      completion_date: null,
      school_id,
    }))

    const { error } = await CurriculumRepository.insertProgressBulk(rows)
    if (error) return { error: error.message }

    return { imported: rows.length, skipped }
  },
}
