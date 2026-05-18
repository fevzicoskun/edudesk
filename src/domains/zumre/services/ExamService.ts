import { ExamRepository } from '../repositories/ExamRepository'
import { getCurrentProfile, requireSchoolId } from '@/src/shared/auth'
import { createClient } from '@/src/shared/supabase/server'
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
    | { id: string; title: string; subject: string; exam_date: string; grades: number[] | null; grade_map: { name: string; grade: string }[] | null }
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

    return result as { id: string; title: string; subject: string; exam_date: string; grades: number[] | null; grade_map: { name: string; grade: string }[] | null }
  },

  async updateExamGrades(id: string, gradesStr: string): Promise<{ error?: string }> {
    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Giriş gerekli' }

    const grades = gradesStr
      .split(/[,\s]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n >= 0 && n <= 100)

    const { error } = await ExamRepository.updateExamGrades(id, school_id, grades)
    return { error: error?.message }
  },

  async saveExamEntries(id: string, entries: { name: string; grade: string }[]): Promise<{ error?: string }> {
    if (entries.length > 200) throw new Error('Çok fazla giriş')
    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Giriş gerekli' }

    const grades = entries
      .map(e => parseInt(e.grade))
      .filter(n => !isNaN(n) && n >= 0 && n <= 100)

    const safeEntries = entries.map(e => ({
      name: String(e.name).slice(0, 120),
      grade: String(e.grade).slice(0, 4),
    }))

    const { error } = await ExamRepository.updateExamEntries(id, school_id, grades, safeEntries)
    return { error: error?.message }
  },

  async deleteExam(id: string) {
    await requireBaskan()
    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Giriş gerekli')

    await ExamRepository.deleteExam(id, school_id)

    await logAudit({
      user_id: user.id,
      action: 'exam.delete',
      table_name: 'common_exams',
      record_id: id,
      school_id,
    })
  },
}
