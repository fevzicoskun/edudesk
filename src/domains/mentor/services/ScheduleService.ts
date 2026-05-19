import { ScheduleRepository } from '../repositories/ScheduleRepository'
import { requireAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'

export const ScheduleService = {
  async createScheduleWithFile(input: {
    schedule_type: 'resmi' | 'okul'
    type_label:    string
    teacher_id?:   string | null
    class_id?:     string | null
    file_url:      string
    file_name:     string
  }): Promise<void> {
    const ability = await requireAbility()
    if (ability.cannot(P.SCHOOL.UPDATE)) throw new Error('Unauthorized')

    const { error } = await ScheduleRepository.insertSchedule({
      school_id:     ability.schoolId,
      schedule_type: input.schedule_type,
      type_label:    input.type_label,
      teacher_id:    input.teacher_id ?? null,
      class_id:      input.class_id ?? null,
      file_url:      input.file_url,
      file_name:     input.file_name,
      created_by:    ability.userId,
    })
    if (error) throw error
  },

  async updateScheduleFile(id: string, file_url: string, file_name: string): Promise<void> {
    const ability = await requireAbility()
    if (ability.cannot(P.SCHOOL.UPDATE)) throw new Error('Unauthorized')

    const { error } = await ScheduleRepository.updateScheduleFile(id, file_url, file_name)
    if (error) throw error
  },

  async renameOkulTypeLabel(newLabel: string): Promise<void> {
    const ability = await requireAbility()
    if (ability.cannot(P.SCHOOL.UPDATE)) throw new Error('Unauthorized')

    const { error } = await ScheduleRepository.updateOkulTypeLabel(ability.schoolId, newLabel)
    if (error) throw error
  },

  async deleteSchedule(id: string): Promise<void> {
    const ability = await requireAbility()
    if (ability.cannot(P.SCHOOL.UPDATE)) throw new Error('Unauthorized')

    const { error } = await ScheduleRepository.deleteSchedule(id)
    if (error) throw error
  },
}
