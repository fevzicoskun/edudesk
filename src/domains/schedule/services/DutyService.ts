import { requireAbility } from '@/src/shared/authorization/server'
import { logger } from '@/src/infrastructure/observability/logger'
import { DutyRepository } from '../repositories/DutyRepository'
import { validateDuty, type DutyInput } from '../dutyMath'

// Kayıtlı nöbet = girdi alanları + DB id'si (silme/anahtar için).
export interface Duty extends DutyInput {
  id: string
}

export interface SchoolDutyRow {
  teacher_id: string
  teacherName: string
  day_of_week: number
  time_range: string
  location: string
  notes: string | null
}

export const DutyService = {
  // Çıktı: öğretmenin tüm nöbet kayıtları (yoksa boş dizi).
  async getMyDuties(): Promise<Duty[]> {
    const ability = await requireAbility()
    const { data, error } = await DutyRepository.listByTeacher(ability.userId, ability.schoolId)
    if (error) {
      logger.error(
        { event: 'duty_read_failed', userId: ability.userId, err: error.message },
        'Nöbet bilgisi okuma hatası',
      )
      return []
    }
    return (data ?? []).map(d => ({
      id: d.id,
      day_of_week: d.day_of_week,
      time_range: d.time_range,
      location: d.location,
      notes: d.notes,
    }))
  },

  // Müdür/MY: okuldaki tüm nöbet kayıtları (öğretmen adıyla). RLS erişimi zorlar.
  async listSchoolDuties(): Promise<SchoolDutyRow[]> {
    const ability = await requireAbility()
    const { data, error } = await DutyRepository.listSchoolDuties(ability.schoolId)
    if (error) {
      logger.error(
        { event: 'duty_list_failed', userId: ability.userId, err: error.message },
        'Okul nöbet listesi okuma hatası',
      )
      return []
    }
    return data
  },

  // Girdi: doğrulanmış nöbet alanları. Çıktı: eklenen nöbet (id'li) veya { error }.
  async addMyDuty(input: DutyInput): Promise<{ error?: string; duty?: Duty }> {
    const ability = await requireAbility()

    const vErr = validateDuty(input)
    if (vErr) return { error: vErr }

    const { data, error } = await DutyRepository.insert({
      teacher_id: ability.userId,
      school_id: ability.schoolId,
      day_of_week: input.day_of_week,
      time_range: input.time_range.trim(),
      location: input.location.trim(),
      notes: input.notes?.trim() ? input.notes.trim() : null,
    })
    if (error || !data) {
      logger.error(
        { event: 'duty_add_failed', userId: ability.userId, err: error?.message },
        'Nöbet ekleme hatası',
      )
      return { error: 'Nöbet bilgisi kaydedilemedi' }
    }
    return {
      duty: {
        id: data.id,
        day_of_week: data.day_of_week,
        time_range: data.time_range,
        location: data.location,
        notes: data.notes,
      },
    }
  },

  // Tek nöbet sil (id ile). RLS başkasının satırını silmeyi engeller.
  async deleteMyDuty(id: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const { error } = await DutyRepository.deleteById(id, ability.userId)
    if (error) {
      logger.error(
        { event: 'duty_delete_failed', userId: ability.userId, err: error.message },
        'Nöbet silme hatası',
      )
      return { error: 'Nöbet silinemedi' }
    }
    return {}
  },
}
