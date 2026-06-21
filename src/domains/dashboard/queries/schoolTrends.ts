// src/domains/dashboard/queries/schoolTrends.ts
import { cache } from 'react'
import { createClient } from '@/src/infrastructure/supabase/server'
import { logger } from '@/src/infrastructure/observability/logger'

export const getAttendanceTrendRows = cache(async (schoolId: string, yearStart: string) => {
  const db = await createClient()
  const { data, error } = await db
    .from('attendance')
    .select('date, status, class_id, teacher_id')
    .eq('school_id', schoolId)
    .gte('date', yearStart)
    .limit(15000)
  if (error) logger.error({ event: 'db_query_failed', query: 'getAttendanceTrendRows', school_id: schoolId, message: error.message }, 'Trend yoklama sorgusu başarısız')
  return data ?? []
})

export const getHomeworkTrendRows = cache(async (schoolId: string, yearStart: string) => {
  const db = await createClient()
  const { data, error } = await db
    .from('homeworks')
    .select('assigned_date, teacher_id')
    .eq('school_id', schoolId)
    .gte('assigned_date', yearStart)
    .is('deleted_at', null)
    .limit(15000)
  if (error) logger.error({ event: 'db_query_failed', query: 'getHomeworkTrendRows', school_id: schoolId, message: error.message }, 'Trend ödev sorgusu başarısız')
  return data ?? []
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
