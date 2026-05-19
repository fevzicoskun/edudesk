import 'server-only'
import { TenantRepository } from '../repositories/TenantRepository'
import { createServiceClient } from '@/src/infrastructure/supabase/service'
import type { QuotaCheckResult } from '../types'

export const QuotaService = {
  async checkTeacherQuota(schoolId: string): Promise<QuotaCheckResult> {
    const [quota, countRes] = await Promise.all([
      TenantRepository.getQuota(schoolId),
      createServiceClient()
        .from('profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .not('role', 'in', '(veli,ogrenci)'),
    ])

    const max     = quota?.max_teachers ?? 20
    const current = countRes.count ?? 0
    return {
      allowed: current < max,
      current,
      max,
      ...(current >= max ? { reason: 'teacher_limit' as const } : {}),
    }
  },

  async checkStudentQuota(schoolId: string): Promise<QuotaCheckResult> {
    const [quota, countRes] = await Promise.all([
      TenantRepository.getQuota(schoolId),
      createServiceClient()
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId),
    ])

    const max     = quota?.max_students ?? 500
    const current = countRes.count ?? 0
    return {
      allowed: current < max,
      current,
      max,
      ...(current >= max ? { reason: 'student_limit' as const } : {}),
    }
  },

  async checkStorageQuota(schoolId: string, uploadMb: number): Promise<QuotaCheckResult> {
    const quota   = await TenantRepository.getQuota(schoolId)
    const max     = quota?.max_storage_mb ?? 1024
    const current = quota?.used_storage_mb ?? 0
    return {
      allowed: current + uploadMb <= max,
      current,
      max,
      ...(current + uploadMb > max ? { reason: 'storage_limit' as const } : {}),
    }
  },

  async updateStorageUsage(schoolId: string, deltaMb: number): Promise<void> {
    await TenantRepository.incrementStorage(schoolId, deltaMb)
  },

  async setQuotaLimits(
    schoolId: string,
    limits: { max_teachers?: number; max_students?: number; max_storage_mb?: number },
  ): Promise<void> {
    await TenantRepository.updateQuota(schoolId, limits)
  },
}
