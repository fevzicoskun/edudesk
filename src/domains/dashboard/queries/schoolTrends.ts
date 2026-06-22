// src/domains/dashboard/queries/schoolTrends.ts
import { cache } from 'react'
import { createClient } from '@/src/infrastructure/supabase/server'
import { logger } from '@/src/infrastructure/observability/logger'
import { donemBasi } from '@/src/shared/utils'
import { getSchoolTeachers } from '@/src/domains/dashboard/queries/schoolStats'
import {
  computeAbsenceTrend, computeActivityTrend, computeCoverageTrend, computeClassAbsence,
  type AbsenceTrendPoint, type ActivityTrendPoint, type CoverageTrendPoint, type ClassAbsence,
} from '@/src/domains/dashboard/lib/trendMath'

const getAttendanceTrend = cache(async (schoolId: string, yearStart: string) => {
  const db = await createClient()
  const { data, error } = await db.rpc('get_school_attendance_trend', { p_school_id: schoolId, p_year_start: yearStart })
  if (error) logger.error({ event: 'db_query_failed', query: 'get_school_attendance_trend', school_id: schoolId, message: error.message }, 'Trend yoklama agregatı başarısız')
  return (data ?? []).map(r => ({ week_start: r.week_start, total: Number(r.total), absent: Number(r.absent), recorded: Number(r.recorded) }))
})

const getClassAbsence = cache(async (schoolId: string, yearStart: string) => {
  const db = await createClient()
  const { data, error } = await db.rpc('get_school_class_absence', { p_school_id: schoolId, p_year_start: yearStart })
  if (error) logger.error({ event: 'db_query_failed', query: 'get_school_class_absence', school_id: schoolId, message: error.message }, 'Trend sınıf devamsızlık agregatı başarısız')
  return (data ?? []).map(r => ({ class_id: r.class_id, total: Number(r.total), absent: Number(r.absent) }))
})

const getActivityWeekly = cache(async (schoolId: string, yearStart: string) => {
  const db = await createClient()
  const { data, error } = await db.rpc('get_school_activity_weekly', { p_school_id: schoolId, p_year_start: yearStart })
  if (error) logger.error({ event: 'db_query_failed', query: 'get_school_activity_weekly', school_id: schoolId, message: error.message }, 'Trend aktivite agregatı başarısız')
  return (data ?? []).map(r => ({ week_start: r.week_start, active: Number(r.active) }))
})

export const getTrendClasses = cache(async (schoolId: string) => {
  const db = await createClient()
  const { data, error } = await db
    .from('classes')
    .select('id, name, grade')
    .eq('school_id', schoolId)
    .is('deleted_at', null)
    .order('grade').order('name')
  if (error) logger.error({ event: 'db_query_failed', query: 'getTrendClasses', school_id: schoolId, message: error.message }, 'Trend sınıf sorgusu başarısız')
  return data ?? []
})

export type SchoolTrends = {
  absence: AbsenceTrendPoint[]
  activity: ActivityTrendPoint[]
  coverage: CoverageTrendPoint[]
  classAbs: ClassAbsence[]
  donemStart: string
  now: Date
}

// Üç tüketici (MudurTrendWidget, ErkenUyarilarWidget, karne) aynı agregatları kullanır.
// Tek loader: RPC'leri paralel çek, JS-tarafı takvim/oran mantığını uygula.
export const getSchoolTrends = cache(async (schoolId: string): Promise<SchoolTrends> => {
  const donemStart = donemBasi()
  const now = new Date()
  const [attTrend, classAbsRows, activityRows, classes, teachers] = await Promise.all([
    getAttendanceTrend(schoolId, donemStart),
    getClassAbsence(schoolId, donemStart),
    getActivityWeekly(schoolId, donemStart),
    getTrendClasses(schoolId),
    getSchoolTeachers(schoolId),
  ])
  return {
    absence: computeAbsenceTrend(attTrend, donemStart, now),
    activity: computeActivityTrend(activityRows, teachers.length, donemStart, now),
    coverage: computeCoverageTrend(attTrend, classes.length, donemStart, now),
    classAbs: computeClassAbsence(classAbsRows, classes),
    donemStart,
    now,
  }
})
