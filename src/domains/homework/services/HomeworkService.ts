import { HomeworkRepository } from '../repositories/HomeworkRepository'
import { getCurrentProfile, requireSchoolId } from '@/src/shared/auth'
import { isTeachingRole } from '@/src/shared/types'
import { createClient } from '@/src/infrastructure/supabase/server'
import type { SubmissionStatus } from '../types'

export const HomeworkService = {
  async createHomework(data: {
    class_id: string
    title: string
    description: string | null
    subject: string
    due_date: string
  }): Promise<{ error?: string }> {
    const profile = await getCurrentProfile()
    if (!profile || !isTeachingRole(profile.role)) return { error: 'Bu işlem için yetkiniz yok.' }

    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Giriş gerekli' }

    const { error } = await HomeworkRepository.insertHomework({
      teacher_id: user.id,
      school_id,
      ...data,
    })

    if (error) return { error: error.message }
    return {}
  },

  async updateSubmissionStatus(
    homeworkId: string,
    studentId: string,
    status: SubmissionStatus
  ): Promise<{ error?: string; success?: boolean }> {
    const profile = await getCurrentProfile()
    if (!profile || !isTeachingRole(profile.role)) return { error: 'Bu işlem için yetkiniz yok.' }

    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Giriş gerekli' }

    const { data: hw } = await HomeworkRepository.findHomeworkTeacher(homeworkId, school_id)
    if (!hw) return { error: 'Ödev bulunamadı' }
    if (hw.teacher_id !== user.id && profile.role !== 'zumre_baskani') {
      return { error: 'Bu ödev için yetkiniz yok' }
    }

    const { error } = await HomeworkRepository.upsertSubmissionStatus({
      homework_id: homeworkId,
      student_id: studentId,
      status,
      school_id,
      updated_at: new Date().toISOString(),
    })

    if (error) return { error: error.message }
    return { success: true }
  },

  async updateAllSubmissionStatuses(
    homeworkId: string,
    studentIds: string[],
    status: SubmissionStatus
  ): Promise<{ error?: string; success?: boolean }> {
    if (studentIds.length > 200) throw new Error('Çok fazla öğrenci')

    const profile = await getCurrentProfile()
    if (!profile || !isTeachingRole(profile.role)) return { error: 'Bu işlem için yetkiniz yok.' }

    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Giriş gerekli' }

    const { data: hw } = await HomeworkRepository.findHomeworkTeacher(homeworkId, school_id)
    if (!hw) return { error: 'Ödev bulunamadı' }
    if (hw.teacher_id !== user.id && profile.role !== 'zumre_baskani') {
      return { error: 'Bu ödev için yetkiniz yok' }
    }

    const rows = studentIds.map(studentId => ({
      homework_id: homeworkId,
      student_id: studentId,
      school_id,
      status,
      updated_at: new Date().toISOString(),
    }))

    if (rows.length === 0) return { success: true }

    const { error } = await HomeworkRepository.upsertSubmissionsStatus(rows)
    if (error) return { error: error.message }
    return { success: true }
  },

  async updateSubmissionNote(
    homeworkId: string,
    studentId: string,
    note: string
  ): Promise<{ error?: string; success?: boolean }> {
    const sanitizedNote = String(note).slice(0, 1000).trim() || null

    const profile = await getCurrentProfile()
    if (!profile || !isTeachingRole(profile.role)) return { error: 'Bu işlem için yetkiniz yok.' }

    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Giriş gerekli' }

    const { data: hw } = await HomeworkRepository.findHomeworkTeacher(homeworkId, school_id)
    if (!hw || (hw.teacher_id !== user.id && profile.role !== 'zumre_baskani')) {
      return { error: 'Ödev bulunamadı veya yetkiniz yok.' }
    }

    const { error } = await HomeworkRepository.upsertSubmissionNote({
      homework_id: homeworkId,
      student_id: studentId,
      note: sanitizedNote,
      school_id,
      updated_at: new Date().toISOString(),
    })

    if (error) return { error: error.message }
    return { success: true }
  },

  async deleteHomework(id: string): Promise<void> {
    const profile = await getCurrentProfile()
    if (!profile || !isTeachingRole(profile.role)) return

    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await HomeworkRepository.softDeleteHomework(id, user.id, school_id)
  },

  async restoreHomework(id: string): Promise<void> {
    const profile = await getCurrentProfile()
    if (!profile || profile.role !== 'zumre_baskani') return

    const [supabase, school_id] = await Promise.all([createClient(), requireSchoolId()])
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await HomeworkRepository.restoreHomework(id, school_id)
  },
}
