import { createClient } from '@/src/infrastructure/supabase/server'
import { fetchAllResult } from '@/src/shared/utils/fetchAll'
import { logger } from '@/src/infrastructure/observability/logger'
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

    const { data: students, error: stErr } = await supabase
      .from('students')
      .select('id')
      .eq('class_id', classId)
      .eq('school_id', schoolId)
      .is('deleted_at', null)
    if (stErr) logger.error({ classId, code: stErr.code }, 'Veli görüntülenme: öğrenciler okunamadı')

    if (!students?.length) return {}

    const studentIds = students.map(s => s.id)

    // Sayfalı: her portal ziyareti bir satır yazar; tek sorgu max_rows=1000'de keserdi ve
    // hangi öğrencinin sayacının düşeceği keyfi olurdu ("veli hiç bakmamış" yanılgısı)
    const { data: events, error: evErr } = await fetchAllResult((f, t) => supabase
      .from('veli_portal_events')
      .select('student_id')
      .eq('event_type', 'page_view')
      .eq('school_id', schoolId)
      .in('student_id', studentIds)
      .order('id')
      .range(f, t))
    // Hata = sayaç yok (boş); yanlış "0 görüntülenme" göstermekten iyi
    if (evErr) {
      logger.error({ classId, err: evErr.message }, 'Veli görüntülenme olayları okunamadı')
      return {}
    }

    const counts: Record<string, number> = {}
    for (const e of events ?? []) {
      counts[e.student_id] = (counts[e.student_id] ?? 0) + 1
    }
    return counts
  },
}
