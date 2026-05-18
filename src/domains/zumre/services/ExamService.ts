import { ExamRepository } from '../repositories/ExamRepository'
import { getCurrentProfile, requireSchoolId } from '@/src/shared/auth'
import { createClient } from '@/src/infrastructure/supabase/server'
import { logAudit } from '@/src/shared/audit'

async function requireBaskan() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'zumre_baskani') {
    throw new Error('Bu işlem için Zümre Başkanı yetkisi gereklidir.')
  }
  return profile
}

export const ExamService = {
  async createExam(data: { title: string; subject: string; exam_date: string }) {
    await requireBaskan()
    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Giriş gerekli')

    await ExamRepository.insertExam({ ...data, created_by: user.id, school_id })

    await logAudit({
      user_id: user.id,
      action: 'exam.create',
      table_name: 'common_exams',
      new_data: { title: data.title },
      school_id,
    })
  },

  async createExamReturning(data: { title: string; subject: string; exam_date: string }): Promise<
    | { id: string; title: string; subject: string; exam_date: string; entries: [] }
    | { error: string }
  > {
    await requireBaskan()
    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Giriş gerekli' }

    const { data: result, error } = await ExamRepository.insertExamReturning({
      ...data,
      created_by: user.id,
      school_id,
    })

    if (error || !result) return { error: error?.message ?? 'Eklenemedi' }

    await logAudit({
      user_id: user.id,
      action: 'exam.create',
      table_name: 'common_exams',
      new_data: { title: data.title },
      school_id,
    })

    return { ...result, entries: [] }
  },

  async saveExamEntries(
    id: string,
    entries: { name: string; grade: string }[]
  ): Promise<{ error?: string }> {
    if (entries.length > 200) throw new Error('Çok fazla giriş')
    const school_id = await requireSchoolId()

    const normalized = entries
      .map(e => ({
        name: e.name.trim() || null,
        student_id: null as string | null,
        grade: parseInt(e.grade, 10),
      }))
      .filter(e => !isNaN(e.grade) && e.grade >= 0 && e.grade <= 100)

    const { error } = await ExamRepository.replaceEntries(id, school_id, normalized)
    return { error: error?.message }
  },

  async deleteExam(id: string) {
    await requireBaskan()
    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Giriş gerekli')

    await ExamRepository.softDeleteExam(id, school_id, user.id)

    await logAudit({
      user_id: user.id,
      action: 'exam.delete',
      table_name: 'common_exams',
      record_id: id,
      school_id,
    })
  },

  async restoreExam(id: string) {
    await requireBaskan()
    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Giriş gerekli')

    await ExamRepository.restoreExam(id, school_id)

    await logAudit({
      user_id: user.id,
      action: 'exam.restore',
      table_name: 'common_exams',
      record_id: id,
      school_id,
    })
  },
}
