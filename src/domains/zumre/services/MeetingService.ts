import { MeetingRepository } from '../repositories/MeetingRepository'
import { requireAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import { logAudit } from '@/src/shared/audit'

export const MeetingService = {
  async createMeeting(data: {
    title: string
    meeting_date: string
    notes: string | null
    branch: string | null
  }) {
    const ability = await requireAbility()
    if (ability.cannot(P.ZUMRE.MANAGE)) throw new Error('Bu işlem için Zümre Başkanı yetkisi gereklidir.')

    await MeetingRepository.insertMeeting({
      ...data,
      branch: data.branch ?? null,
      created_by: ability.userId,
      school_id: ability.schoolId,
    })

    await logAudit({
      user_id: ability.userId,
      action: 'meeting.create',
      table_name: 'zumre_meetings',
      new_data: { title: data.title },
      school_id: ability.schoolId,
    })
  },

  async updateMeeting(id: string, data: {
    title: string
    meeting_date: string
    notes: string | null
  }) {
    const ability = await requireAbility()
    if (ability.cannot(P.ZUMRE.MANAGE)) throw new Error('Bu işlem için Zümre Başkanı yetkisi gereklidir.')

    await MeetingRepository.updateMeeting(id, ability.schoolId, data)
  },

  async deleteMeeting(id: string) {
    const ability = await requireAbility()
    if (ability.cannot(P.ZUMRE.MANAGE)) throw new Error('Bu işlem için Zümre Başkanı yetkisi gereklidir.')

    await MeetingRepository.softDeleteMeeting(id, ability.schoolId, ability.userId)

    await logAudit({
      user_id: ability.userId,
      action: 'meeting.delete',
      table_name: 'zumre_meetings',
      record_id: id,
      school_id: ability.schoolId,
    })
  },

  async restoreMeeting(id: string) {
    const ability = await requireAbility()
    if (ability.cannot(P.ZUMRE.MANAGE)) throw new Error('Bu işlem için Zümre Başkanı yetkisi gereklidir.')

    await MeetingRepository.restoreMeeting(id, ability.schoolId)

    await logAudit({
      user_id: ability.userId,
      action: 'meeting.restore',
      table_name: 'zumre_meetings',
      record_id: id,
      school_id: ability.schoolId,
    })
  },
}
