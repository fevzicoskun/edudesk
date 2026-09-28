import { cache } from 'react'
import { createClient } from '@/src/infrastructure/supabase/server'
import { logger } from '@/src/infrastructure/observability/logger'
import { todayLocalISO } from '@/src/shared/date'
import { gunOnce } from '@/src/domains/dashboard/lib/aktiflik'

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

/** Öğretmen başına son kullanım günü ve son 30 günde kullanılan gün sayısı (usage_daily).
 *  okul_son_kullanim RLS'e tabi: yalnız müdür/MY kendi okulunu görür — başka rolde boş Map.
 *  (Önceki kaynak user_sessions 2026-06-02'den beri beslenmiyordu → herkes "Pasif" görünüyordu.) */
export const getOkulKullanim = cache(async (): Promise<Map<string, { sonGun: string; gunSayisi: number }>> => {
  const db = await createClient()
  const { data, error } = await db.rpc('okul_son_kullanim', { p_since: gunOnce(todayLocalISO(), 29) })
  if (error) logger.error({ event: 'db_query_failed', query: 'getOkulKullanim', message: error.message }, 'Kullanım sorgusu başarısız')
  return new Map((data ?? []).map(r => [r.user_id, { sonGun: r.son_gun, gunSayisi: r.gun_sayisi }]))
})
