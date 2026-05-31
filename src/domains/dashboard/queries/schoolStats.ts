import { cache } from 'react'
import { createClient } from '@/src/infrastructure/supabase/server'

// Her iki widget de bu iki sorguyu çekiyor — cache() ile request içi dedup sağlanır

export const getAbsentYearRows = cache(async (schoolId: string, yearStart: string) => {
  const db = await createClient()
  const { data } = await db
    .from('attendance')
    .select('student_id, status')
    .eq('school_id', schoolId)
    .in('status', ['absent', 'late'])
    .gte('date', yearStart)
  return data ?? []
})

export const getSessionRows = cache(async (schoolId: string) => {
  const db = await createClient()
  const { data } = await db
    .from('user_sessions')
    .select('user_id, last_seen_at')
    .eq('school_id', schoolId)
  return data ?? []
})
