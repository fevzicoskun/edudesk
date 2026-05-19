import 'server-only'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import type { SchoolStatus, SchoolPlan, SchoolQuota, TenantMetrics } from '../types'

let _client: ReturnType<typeof createServiceClient> | null = null
function getClient() {
  if (!_client) _client = createServiceClient()
  return _client
}

export const TenantRepository = {
  async listTenants(): Promise<TenantMetrics[]> {
    const supabase = getClient()
    const { data, error } = await supabase
      .from('tenant_metrics')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as TenantMetrics[]
  },

  async getTenant(schoolId: string): Promise<TenantMetrics | null> {
    const supabase = getClient()
    const { data, error } = await supabase
      .from('tenant_metrics')
      .select('*')
      .eq('school_id', schoolId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data as TenantMetrics | null
  },

  async setStatus(
    schoolId:    string,
    status:      SchoolStatus,
    suspendedBy: string | null,
  ): Promise<void> {
    const supabase = getClient()
    const patch: Record<string, unknown> = { status }
    if (status === 'suspended') {
      patch.suspended_at = new Date().toISOString()
      patch.suspended_by = suspendedBy
    } else {
      patch.suspended_at = null
      patch.suspended_by = null
    }
    const { error } = await supabase.from('schools').update(patch).eq('id', schoolId)
    if (error) throw new Error(error.message)
  },

  async setPlan(schoolId: string, plan: SchoolPlan): Promise<void> {
    const supabase = getClient()
    const { error } = await supabase.from('schools').update({ plan }).eq('id', schoolId)
    if (error) throw new Error(error.message)
  },

  async getQuota(schoolId: string): Promise<SchoolQuota | null> {
    const supabase = getClient()
    const { data, error } = await supabase
      .from('school_quotas')
      .select('*')
      .eq('school_id', schoolId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data as SchoolQuota | null
  },

  async updateQuota(
    schoolId: string,
    patch:    Partial<Pick<SchoolQuota, 'max_teachers' | 'max_students' | 'max_storage_mb'>>,
  ): Promise<void> {
    const supabase = getClient()
    const { error } = await supabase
      .from('school_quotas')
      .upsert({ school_id: schoolId, ...patch })
      .eq('school_id', schoolId)
    if (error) throw new Error(error.message)
  },

  async incrementStorage(schoolId: string, deltaMb: number): Promise<void> {
    const supabase = getClient()
    const { error } = await supabase.rpc('increment_school_storage', {
      p_school_id: schoolId,
      p_delta_mb:  deltaMb,
    })
    if (error) throw new Error(error.message)
  },

  async isPlatformAdmin(userId: string): Promise<boolean> {
    const supabase = getClient()
    const { data } = await supabase
      .from('platform_admins')
      .select('id')
      .eq('id', userId)
      .maybeSingle()
    return data !== null
  },
}
