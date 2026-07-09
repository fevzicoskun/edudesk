import { requireAbility } from '@/src/shared/authorization/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import { logger } from '@/src/infrastructure/observability/logger'
import { SCHOOL_YEAR_HOLIDAYS } from '@/src/shared/constants/holidays'
import { DutyRepository } from '@/src/domains/schedule/repositories/DutyRepository'
import { CalendarRepository } from '../repositories/CalendarRepository'
import { expandDuties, groupByDay, toDateStr, type CalendarEvent, type DutyInput } from '../calendarMath'

export const CalendarService = {
  async getMonth(year: number, month: number): Promise<{ days: Record<string, CalendarEvent[]>; canManage: boolean }> {
    const ability = await requireAbility()
    const profile = await getCurrentProfile()
    const canManage = isMudurOrAbove(profile?.role)

    const from = toDateStr(year, month, 1)
    const to = toDateStr(year, month, new Date(year, month, 0).getDate())

    const [meetingsRes, dutiesRes, homeworksRes, eventsRes] = await Promise.all([
      CalendarRepository.listMeetings(ability.schoolId, from, to),
      canManage
        ? DutyRepository.listSchoolDuties(ability.schoolId)
        : DutyRepository.listByTeacher(ability.userId, ability.schoolId),
      CalendarRepository.listHomeworks(ability.schoolId, from, to, canManage ? null : ability.userId),
      CalendarRepository.listEvents(ability.schoolId, from, to),
    ])

    for (const [name, res] of [['randevu', meetingsRes], ['nobet', dutiesRes], ['odev', homeworksRes], ['etkinlik', eventsRes]] as const) {
      if (res.error) {
        logger.error({ event: 'takvim_source_failed', source: name, userId: ability.userId, err: res.error.message }, 'Takvim kaynağı okunamadı')
      }
    }

    const holidays = SCHOOL_YEAR_HOLIDAYS.filter(h => h.date >= from && h.date <= to)
    const holidayDates = new Set(holidays.map(h => h.date))

    const duties: DutyInput[] = dutiesRes.data ?? []
    const invalid = duties.filter(d => !Number.isInteger(d.day_of_week) || d.day_of_week < 1 || d.day_of_week > 5)
    if (invalid.length) {
      logger.error({ event: 'takvim_invalid_duty_dow', count: invalid.length, userId: ability.userId }, 'Aralık dışı day_of_week nöbet satırı atlandı')
    }

    const events: CalendarEvent[] = [
      ...holidays.map(h => ({ date: h.date, type: 'tatil' as const, title: h.label })),
      ...(eventsRes.data ?? []).map(e => ({
        date: e.event_date, type: 'etkinlik' as const, title: e.title, detail: e.note ?? undefined, id: e.id,
      })),
      ...expandDuties(duties, year, month, holidayDates),
      ...(meetingsRes.data ?? []).map(m => ({
        date: m.meet_date, type: 'randevu' as const,
        title: `Veli görüşmesi — ${m.students?.full_name ?? '—'}`, detail: `${m.period}. ders`,
      })),
      ...(homeworksRes.data ?? []).flatMap(h =>
        h.due_date
          ? [{ date: h.due_date, type: 'odev' as const, title: `Ödev teslimi — ${h.title}`, detail: h.classes?.name ?? undefined }]
          : []
      ),
    ]

    return { days: groupByDay(events), canManage }
  },

  async createEvent(input: { title: string; eventDate: string; note: string | null }): Promise<{ error?: string; id?: string }> {
    const ability = await requireAbility()
    const profile = await getCurrentProfile()
    if (!isMudurOrAbove(profile?.role)) return { error: 'Bu işlem için yetkiniz yok' }

    const { data, error } = await CalendarRepository.insertEvent({
      school_id: ability.schoolId,
      title: input.title,
      event_date: input.eventDate,
      note: input.note,
      created_by: ability.userId,
    })
    if (error || !data) {
      logger.error({ event: 'takvim_event_create_failed', userId: ability.userId, err: error?.message }, 'Etkinlik ekleme hatası')
      return { error: 'Etkinlik kaydedilemedi' }
    }
    return { id: (data as { id: string }).id }
  },

  async removeEvent(id: string): Promise<{ error?: string }> {
    const ability = await requireAbility()
    const profile = await getCurrentProfile()
    if (!isMudurOrAbove(profile?.role)) return { error: 'Bu işlem için yetkiniz yok' }

    const { error } = await CalendarRepository.softDeleteEvent(id, ability.schoolId, ability.userId)
    if (error) {
      logger.error({ event: 'takvim_event_delete_failed', userId: ability.userId, err: error.message }, 'Etkinlik silme hatası')
      return { error: 'Etkinlik silinemedi' }
    }
    return {}
  },
}
