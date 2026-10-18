import { createClient } from '@/src/infrastructure/supabase/server'
import { fetchAllResult } from '@/src/shared/utils/fetchAll'

export const ActivityReportRepository = {
  async getTeachers(schoolId: string) {
    const supabase = await createClient()
    return supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('school_id', schoolId)
      .order('full_name')
  },

  /** Son kayıtlar (öğretmen, işlem, Türkiye günü) grubuna indirgenmiş; okul RPC içinde current_school_id() */
  async getGunluk(since: string) {
    const supabase = await createClient()
    // grup sayısı da 1000'i aşabilir (öğretmen × işlem × gün) → sayfalı; sıra eski ham sorguyla aynı
    return fetchAllResult((f, t) => supabase
      .rpc('ogretmen_aktivite_gunluk', { p_since: since })
      .order('son_at', { ascending: false })
      .order('son_id')
      .range(f, t))
  },
}
