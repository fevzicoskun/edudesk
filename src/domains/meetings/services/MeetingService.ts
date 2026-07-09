import { requireAbility } from '@/src/shared/authorization/server'
import { logger } from '@/src/infrastructure/observability/logger'
import { MeetingRepository } from '../repositories/MeetingRepository'
import type { MeetingStatus } from '../parentMeetingMath'

export interface Meeting {
  id: string
  student_id: string
  student_name: string
  class_name: string | null
  meet_date: string
  period: number
  status: MeetingStatus
  note: string | null
}

export interface StudentOption {
  id: string
  full_name: string
  class_id: string
  class_name: string | null
}


export const MeetingService = {
  async getMyMeetings(): Promise<Meeting[]> {
    const ability = await requireAbility()
    const { data, error } = await MeetingRepository.listForTeacher(ability.userId, ability.schoolId)
    if (error) {
      logger.error({ event: 'meeting_list_failed', userId: ability.userId, err: error.message }, 'Randevu listesi okuma hatası')
      return []
    }
    return (data ?? []).map(r => ({
      id: r.id,
      student_id: r.student_id,
      student_name: r.students?.full_name ?? '—',
      class_name: r.students?.classes?.name ?? null,
      meet_date: r.meet_date,
      period: r.period,
      status: r.status as MeetingStatus,
      note: r.note,
    }))
  },

  async getStudentOptions(classIds: string[]): Promise<StudentOption[]> {
    const ability = await requireAbility()
    const { data, error } = await MeetingRepository.listStudentsByClassIds(classIds, ability.schoolId)
    if (error) {
      logger.error({ event: 'meeting_students_failed', userId: ability.userId, err: error.message }, 'Öğrenci seçenekleri okuma hatası')
      return []
    }
    return (data ?? []).map(s => ({
      id: s.id,
      full_name: s.full_name,
      class_id: s.class_id,
      class_name: s.classes?.name ?? null,
    }))
  },

  async create(input: { studentId: string; meetDate: string; period: number; note: string | null }): Promise<{ error?: string; id?: string }> {
    const ability = await requireAbility()
    const { data, error } = await MeetingRepository.insert({
      teacher_id: ability.userId,
      school_id: ability.schoolId,
      student_id: input.studentId,
      meet_date: input.meetDate,
      period: input.period,
      note: input.note,
    })
    if (error || !data) {
      // 23505 = unique_violation → slot zaten dolu.
      if (error?.code === '23505') return { error: 'Bu tarih ve saatte zaten bir randevun var' }
      logger.error({ event: 'meeting_create_failed', userId: ability.userId, err: error?.message }, 'Randevu ekleme hatası')
      return { error: 'Randevu kaydedilemedi' }
    }
    return { id: (data as { id: string }).id }
  },

  async updateStatus(id: string, status: MeetingStatus): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { error } = await MeetingRepository.updateStatus(id, ability.userId, ability.schoolId, status)
    if (error) {
      logger.error({ event: 'meeting_status_failed', userId: ability.userId, err: error.message }, 'Randevu durum güncelleme hatası')
      return { error: 'Randevu güncellenemedi' }
    }
    return {}
  },

  async remove(id: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { error } = await MeetingRepository.deleteById(id, ability.userId, ability.schoolId)
    if (error) {
      logger.error({ event: 'meeting_delete_failed', userId: ability.userId, err: error.message }, 'Randevu silme hatası')
      return { error: 'Randevu silinemedi' }
    }
    return {}
  },
}
