import { HomeworkSourceRepository } from '../repositories/HomeworkSourceRepository'
import { getAbility } from '@/src/shared/authorization/server'
import { P } from '@/src/shared/permissions'
import { turkeyDate } from '@/src/lib/email-utils'

const MS_PER_DAY = 86_400_000
const USAGE_LOOKBACK_DAYS = 120

export const HomeworkSourceService = {
  async getSources() {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli', data: null }

    const { data, error } = await HomeworkSourceRepository.findByTeacher(ability.userId, ability.schoolId)
    if (error) return { error: error.message, data: null }
    return { data, error: null }
  },

  async createSource(name: string, subject: string | null) {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli', data: null }
    if (ability.cannot(P.HOMEWORK.CREATE)) return { error: 'Bu işlem için yetkiniz yok.', data: null }

    const { data, error } = await HomeworkSourceRepository.insert({
      teacher_id: ability.userId,
      school_id:  ability.schoolId,
      name,
      subject,
    })
    if (error) return { error: error.message, data: null }
    return { data, error: null }
  },

  async deleteSource(id: string) {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli' }
    if (ability.cannot(P.HOMEWORK.DELETE)) return { error: 'Bu işlem için yetkiniz yok.' }

    const { error } = await HomeworkSourceRepository.deactivate(id, ability.userId, ability.schoolId)
    if (error) return { error: error.message }
    return {}
  },

  async getSourceUsage() {
    const ability = await getAbility()
    if (!ability) return { error: 'Giriş gerekli', data: null }

    const lookbackDate = new Date()
    lookbackDate.setDate(lookbackDate.getDate() - USAGE_LOOKBACK_DAYS)
    const since = turkeyDate(lookbackDate)

    const [sourcesRes, homeworksRes] = await Promise.all([
      HomeworkSourceRepository.findByTeacher(ability.userId, ability.schoolId),
      HomeworkSourceRepository.findHomeworkDates(ability.userId, ability.schoolId, since),
    ])

    if (sourcesRes.error)  return { error: sourcesRes.error.message,  data: null }
    if (homeworksRes.error) return { error: homeworksRes.error.message, data: null }

    const sources   = sourcesRes.data  ?? []
    const homeworks = homeworksRes.data ?? []

    const today          = new Date()
    const todayTR        = turkeyDate(today)
    const thisMonthStart = todayTR.slice(0, 8) + '01'

    const usageMap = new Map<string, { lastDate: string; thisMonth: number }>()
    for (const h of homeworks) {
      if (!h.source_id) continue
      const prev       = usageMap.get(h.source_id)
      const isThisMonth = h.assigned_date >= thisMonthStart
      if (!prev) {
        usageMap.set(h.source_id, { lastDate: h.assigned_date, thisMonth: isThisMonth ? 1 : 0 })
      } else {
        if (h.assigned_date > prev.lastDate) prev.lastDate = h.assigned_date
        if (isThisMonth) prev.thisMonth++
      }
    }

    const data = sources.map(s => {
      const usage     = usageMap.get(s.id)
      const daysSince = usage
        ? Math.floor((today.getTime() - Date.parse(usage.lastDate)) / MS_PER_DAY)
        : null
      return {
        id:        s.id,
        name:      s.name,
        subject:   s.subject,
        lastDate:  usage?.lastDate ?? null,
        daysSince,
        thisMonth: usage?.thisMonth ?? 0,
      }
    })

    return { data, error: null }
  },
}
