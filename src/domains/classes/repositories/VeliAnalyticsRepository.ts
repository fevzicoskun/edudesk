import { createClient } from '@/src/infrastructure/supabase/server'
import { aggregateVeliEvents, type VeliAnalyticsResult } from '@/src/domains/classes/lib/veliPortal'

export const VeliAnalyticsRepository = {
  async getVeliAnalytics(studentId: string, schoolId: string): Promise<VeliAnalyticsResult | null> {
    const supabase = await createClient()
    const { data } = await supabase
      .from('veli_portal_events')
      .select('event_type, section, duration_sec, created_at')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(500)
    return aggregateVeliEvents(data ?? [])
  },

  async getVeliViewCounts(classId: string, schoolId: string): Promise<Record<string, number>> {
    const supabase = await createClient()

    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)

    if (!students?.length) return {}

    const studentIds = students.map(s => s.id)

    const { data: events } = await supabase
      .from('veli_portal_events')
      .select('student_id')
      .eq('event_type', 'page_view')
      .eq('school_id', schoolId)
      .in('student_id', studentIds)

    const counts: Record<string, number> = {}
    for (const e of events ?? []) {
      counts[e.student_id] = (counts[e.student_id] ?? 0) + 1
    }
    return counts
  },
}
