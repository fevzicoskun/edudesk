import { requireAbility } from '@/src/shared/authorization/server'
import { getCurrentProfile } from '@/src/shared/auth'
import { isMudurOrAbove } from '@/src/shared/types'
import { logger } from '@/src/infrastructure/observability/logger'
import { SCHOOL_YEAR_HOLIDAYS } from '@/src/shared/constants/holidays'
import { createClient } from '@/src/infrastructure/supabase/server'
import { DutyRepository } from '@/src/domains/schedule/repositories/DutyRepository'
import { CalendarRepository, type CalendarDb } from '../repositories/CalendarRepository'
import { expandDutiesRange, groupByDay, toDateStr, type CalendarEvent, type DutyInput } from '../calendarMath'
import type { FeedScope } from '../feedAccess'

export const CalendarService = {
  async getMonth(year: number, month: number): Promise<{ days: Record<string, CalendarEvent[]>; canManage: boolean }> {
    const ability = await requireAbility()
    const profile = await getCurrentProfile()
    const canManage = isMudurOrAbove(profile?.role)

    const from = toDateStr(year, month, 1)
    const to = toDateStr(year, month, new Date(year, month, 0).getDate())

    const db = await createClient()
    const events = await CalendarService.collectEvents(
      db, { userId: ability.userId, schoolId: ability.schoolId, canManage }, from, to,
    )
    return { days: groupByDay(events), canManage }
  },

  /**
   * Takvimin TEK birleştirme noktası: /takvim (çerezli RLS client) ve ICS beslemesi (service-role) bunu kullanır.
   * Kapsam `scope`tan gelir ve her sorguya açıkça uygulanır (service-role RLS'i atlar):
   *   yönetici (müdür/MY) → okul geneli; diğer roller → yalnız kendi nöbet/randevu/ödevi. Tatil + etkinlik herkese.
   * [from, to] dahil, 'YYYY-MM-DD'.
   */
  async collectEvents(db: CalendarDb, scope: FeedScope, from: string, to: string): Promise<CalendarEvent[]> {
    const { userId, schoolId, canManage } = scope
    const ownerId = canManage ? null : userId

    const [meetingsRes, dutiesRes, homeworksRes, eventsRes] = await Promise.all([
      CalendarRepository.listMeetings(db, schoolId, from, to, ownerId),
      canManage
        ? DutyRepository.listSchoolDuties(schoolId, db)
        : DutyRepository.listByTeacher(userId, schoolId, db),
      CalendarRepository.listHomeworks(db, schoolId, from, to, ownerId),
      CalendarRepository.listEvents(db, schoolId, from, to),
    ])

    for (const [name, res] of [['randevu', meetingsRes], ['nobet', dutiesRes], ['odev', homeworksRes], ['etkinlik', eventsRes]] as const) {
      if (res.error) {
        logger.error({ event: 'takvim_source_failed', source: name, userId, err: res.error.message }, 'Takvim kaynağı okunamadı')
      }
    }

    const holidays = SCHOOL_YEAR_HOLIDAYS.filter(h => h.date >= from && h.date <= to)
    const holidayDates = new Set(holidays.map(h => h.date))

    const duties: DutyInput[] = dutiesRes.data ?? []
    const invalid = duties.filter(d => !Number.isInteger(d.day_of_week) || d.day_of_week < 1 || d.day_of_week > 5)
    if (invalid.length) {
      logger.error({ event: 'takvim_invalid_duty_dow', count: invalid.length, userId }, 'Aralık dışı day_of_week nöbet satırı atlandı')
    }

    return [
      ...holidays.map(h => ({ date: h.date, type: 'tatil' as const, title: h.label })),
      ...(eventsRes.data ?? []).map(e => ({
        date: e.event_date, type: 'etkinlik' as const, title: e.title, detail: e.note ?? undefined, id: e.id,
      })),
      ...expandDutiesRange(duties, from, to, holidayDates),
      ...(meetingsRes.data ?? []).map(m => ({
        date: m.meet_date, type: 'randevu' as const, id: m.id,
        title: `Veli görüşmesi — ${m.students?.full_name ?? '—'}`, detail: `${m.period}. ders`,
      })),
      ...(homeworksRes.data ?? []).flatMap(h =>
        h.due_date
          ? [{ date: h.due_date, type: 'odev' as const, id: h.id, title: `Ödev teslimi — ${h.title}`, detail: h.classes?.name ?? undefined }]
          : []
      ),
    ]
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
