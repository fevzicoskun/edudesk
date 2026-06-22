import { cache } from 'react'
import { createClient } from '@/src/infrastructure/supabase/server'
import { logger } from '@/src/infrastructure/observability/logger'

// Her iki widget de bu iki sorguyu çekiyor — cache() ile request içi dedup sağlanır

// Öğrenci başına ağırlıklı devamsızlık skoru (absent=1, late=0.5), DB-tarafı agregat.
// Eski ham-satır + limit(15000) yaklaşımı eşiği aşan okulda risk sayısını/listesini
// sessizce kırpıyordu; RPC öğrenci başına tek satır döner, cap yok.
export const getAbsenceScores = cache(async (schoolId: string, yearStart: string) => {
  const db = await createClient()
  const { data, error } = await db.rpc('get_school_absence_scores', { p_school_id: schoolId, p_year_start: yearStart })
  if (error) logger.error({ event: 'db_query_failed', query: 'get_school_absence_scores', school_id: schoolId, message: error.message }, 'Devamsızlık skor sorgusu başarısız')
  return data ?? []
})

// MYStatsWidget (sadece id+sayım) ve MYSolSutunWidget (id, full_name, subject, role + sıralı)
// aynı profiles filtresini çekiyordu — üst-küme kolonlarıyla cache()'leyip request içi dedup sağlanır
export const getSchoolTeachers = cache(async (schoolId: string) => {
  const db = await createClient()
  const { data, error } = await db
    .from('profiles')
    .select('id, full_name, subject, role')
    .eq('school_id', schoolId)
    .in('role', ['ogretmen', 'zumre_baskani'])
    .order('full_name')
  if (error) logger.error({ event: 'db_query_failed', query: 'getSchoolTeachers', school_id: schoolId, message: error.message }, 'Öğretmen sorgusu başarısız')
  return data ?? []
})

export const getSessionRows = cache(async (schoolId: string) => {
  const db = await createClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await db
    .from('user_sessions')
    .select('user_id, last_seen_at')
    .eq('school_id', schoolId)
    .gte('last_seen_at', since)
    .order('last_seen_at', { ascending: false })
    .limit(500)
  if (error) logger.error({ event: 'db_query_failed', query: 'getSessionRows', school_id: schoolId, message: error.message }, 'Oturum sorgusu başarısız')
  return data ?? []
})
