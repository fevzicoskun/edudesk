// src/domains/dashboard/queries/schoolTrends.ts
import { cache } from 'react'
import { createClient } from '@/src/infrastructure/supabase/server'
import { logger } from '@/src/infrastructure/observability/logger'

// ponytail: cap, sınırsız satırı server component'e çekmeyi önler. Cap'e ulaşmak =
// trend verisi eksik kırpıldı → sessiz/yanlış analitik yerine görünür log sinyali ver.
// Bu eşik aşılır olunca doğru çözüm: sayıları DB-tarafı aggregate RPC'ye taşı.
const TREND_ROW_CAP = 15000

export const getAttendanceTrendRows = cache(async (schoolId: string, yearStart: string) => {
  const db = await createClient()
  const { data, error } = await db
    .from('attendance')
    .select('date, status, class_id, teacher_id')
    .eq('school_id', schoolId)
    .gte('date', yearStart)
    .order('date')
    .limit(TREND_ROW_CAP)
  if (error) logger.error({ event: 'db_query_failed', query: 'getAttendanceTrendRows', school_id: schoolId, message: error.message }, 'Trend yoklama sorgusu başarısız')
  if (data?.length === TREND_ROW_CAP) logger.error({ event: 'trend_row_cap_hit', query: 'getAttendanceTrendRows', school_id: schoolId, cap: TREND_ROW_CAP }, 'Trend yoklama satır cap’ine ulaşıldı — analitik eksik olabilir, DB aggregate RPC gerekli')
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
    .order('assigned_date')
    .limit(TREND_ROW_CAP)
  if (error) logger.error({ event: 'db_query_failed', query: 'getHomeworkTrendRows', school_id: schoolId, message: error.message }, 'Trend ödev sorgusu başarısız')
  if (data?.length === TREND_ROW_CAP) logger.error({ event: 'trend_row_cap_hit', query: 'getHomeworkTrendRows', school_id: schoolId, cap: TREND_ROW_CAP }, 'Trend ödev satır cap’ine ulaşıldı — analitik eksik olabilir, DB aggregate RPC gerekli')
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
