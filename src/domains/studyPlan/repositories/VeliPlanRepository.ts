import { createServiceClient } from '@/src/infrastructure/supabase/service'
import { planVeliJtiPrefix } from '../veliPlanMath'

export interface VeliTokenInsert {
  student_id: string
  school_id: string
  issued_by: string
  jti: string
  expires_at: string
}

// SERVICE-ROLE (RLS bypass). Yalnız iki çağıran: token'ı doğrulanmış veli portalı (studentId/schoolId
// token payload'ından) ve Inngest cron'u. Oturumlu kullanıcı akışlarında KULLANMA → StudyPlanRepository.
export const VeliPlanRepository = {
  async listPortalItems(studentId: string, schoolId: string | undefined, weekStarts: string[]) {
    let q = createServiceClient().from('study_plan_items')
      .select('id, subject, week_start, plan_date, source, description, status, note')
      .eq('student_id', studentId)
      .in('week_start', weekStarts)
    if (schoolId) q = q.eq('school_id', schoolId)
    return q.order('plan_date', { ascending: true, nullsFirst: true }).order('created_at').limit(500)
  },

  /** Haftanın tüm okullardaki maddeleri (sayfalı; created_at sırası = öğrencinin ilk maddesi önce). */
  async listWeekItemsPage(weekStart: string, from: number, to: number) {
    return createServiceClient().from('study_plan_items')
      .select('student_id, school_id, teacher_id, students(full_name, veli_email, veli_ad, veli_email_opt_out, deleted_at)')
      .eq('week_start', weekStart)
      .order('created_at').order('id')
      .range(from, to)
  },

  /** Bu hafta için plan linki zaten verilmiş öğrenciler (dedup işareti: deterministik jti). */
  async listNotifiedPage(weekStart: string, from: number, to: number) {
    return createServiceClient().from('veli_tokens')
      .select('student_id')
      .like('jti', `${planVeliJtiPrefix(weekStart)}%`)
      .order('id')
      .range(from, to)
  },

  async insertVeliTokens(rows: VeliTokenInsert[]) {
    return createServiceClient().from('veli_tokens').insert(rows)
  },
}
