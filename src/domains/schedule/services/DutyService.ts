import { requireAbility } from '@/src/shared/authorization/server'
import { logger } from '@/src/infrastructure/observability/logger'
import { DutyRepository } from '../repositories/DutyRepository'
import { validateDuty, type DutyInput } from '../dutyMath'

export type Duty = DutyInput

export interface SchoolDutyRow {
  teacher_id: string
  teacherName: string
  day_of_week: number
  time_range: string
  location: string
  notes: string | null
}

export const DutyService = {
  // Çıktı: öğretmenin nöbet kaydı (yoksa null).
  async getMyDuty(): Promise<Duty | null> {
    const ability = await requireAbility()
    const { data, error } = await DutyRepository.getByTeacher(ability.userId, ability.schoolId)
    if (error) {
      // Okuma hatasını yutma — "kayıt yok" ile "okunamadı" karışmasın.
      logger.error(
        { event: 'duty_read_failed', userId: ability.userId, err: error.message },
        'Nöbet bilgisi okuma hatası',
      )
      return null
    }
    if (!data) return null
    return {
      day_of_week: data.day_of_week,
      time_range: data.time_range,
      location: data.location,
      notes: data.notes,
    }
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

  // Girdi: doğrulanmış nöbet alanları. Çıktı: { error? }.
  async saveMyDuty(input: DutyInput): Promise<{ error?: string }> {
    const ability = await requireAbility()

    const vErr = validateDuty(input)
    if (vErr) return { error: vErr }

    const { error } = await DutyRepository.upsert({
      teacher_id: ability.userId,
      school_id: ability.schoolId,
      day_of_week: input.day_of_week,
      time_range: input.time_range.trim(),
      location: input.location.trim(),
      notes: input.notes?.trim() ? input.notes.trim() : null,
    })
    if (error) {
      logger.error(
        { event: 'duty_save_failed', userId: ability.userId, err: error.message },
        'Nöbet bilgisi kaydetme hatası',
      )
      return { error: 'Nöbet bilgisi kaydedilemedi' }
    }
    return {}
  },
}
