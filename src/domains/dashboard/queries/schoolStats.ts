import { cache } from 'react'
import { createClient } from '@/src/infrastructure/supabase/server'

// Her iki widget de bu iki sorguyu çekiyor — cache() ile request içi dedup sağlanır

export const getAbsentYearRows = cache(async (schoolId: string, yearStart: string) => {
  const db = await createClient()
  const { data, error } = await db
    .from('attendance')
    .select('student_id, status')
    .eq('school_id', schoolId)
    .in('status', ['absent', 'late'])
    .gte('date', yearStart)
    .limit(15000)
  if (error) console.error('[getAbsentYearRows]', error.message)
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
  if (error) console.error('[getSessionRows]', error.message)
  return data ?? []
})
