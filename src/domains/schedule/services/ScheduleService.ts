import { requireAbility } from '@/src/shared/authorization/server'
import { ScheduleRepository } from '../repositories/ScheduleRepository'
import { DEFAULT_PERIODS, validatePeriods, validateSlots, type Period, type Slot } from '../scheduleMath'

export const ScheduleService = {
  async getMySchedule(): Promise<{ periods: Period[]; slots: Slot[]; classes: { id: string; name: string }[] }> {
    const ability = await requireAbility()
    const [rowRes, classRes] = await Promise.all([
      ScheduleRepository.getByTeacher(ability.userId, ability.schoolId),
      ScheduleRepository.listSchoolClasses(ability.schoolId),
    ])
    const row = rowRes.data
    const periods = (row?.periods as Period[] | null)?.length ? (row!.periods as unknown as Period[]) : DEFAULT_PERIODS
    const slots = (row?.slots as Slot[] | null) ?? []
    return {
      periods,
      slots: slots as unknown as Slot[],
      classes: (classRes.data ?? []) as { id: string; name: string }[],
    }
  },

  async saveMySchedule(periods: Period[], slots: Slot[]): Promise<{ error?: string }> {
    const ability = await requireAbility()

    const pErr = validatePeriods(periods)
    if (pErr) return { error: pErr }

    // class_id'leri UI'a güvenmeden okul sınıflarına karşı doğrula (cross-tenant koruması).
    const { data: classes } = await ScheduleRepository.listSchoolClasses(ability.schoolId)
    const validIds = (classes ?? []).map(c => c.id)
    const sErr = validateSlots(slots, periods, validIds)
    if (sErr) return { error: sErr }

    const { error } = await ScheduleRepository.upsert({
      teacher_id: ability.userId,
      school_id:  ability.schoolId,
      periods,
      slots,
    })
    if (error) return { error: error.message }
    return {}
  },
}
