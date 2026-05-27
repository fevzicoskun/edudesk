import 'server-only'
import { TenantRepository } from '../repositories/TenantRepository'
import { logger, securityLog } from '@/src/infrastructure/observability/logger'
import type { SchoolPlan, SchoolStatus, TenantMetrics } from '../types'

export const TenantService = {
  async listAll(): Promise<TenantMetrics[]> {
    return TenantRepository.listTenants()
  },

  async getOne(schoolId: string): Promise<TenantMetrics | null> {
    return TenantRepository.getTenant(schoolId)
  },

  async suspend(schoolId: string, adminUserId: string, reason: string): Promise<void> {
    await TenantRepository.setStatus(schoolId, 'suspended', adminUserId)
    logger.info({ school_id: schoolId, admin_user_id: adminUserId, reason }, 'school suspended')
    securityLog('tenant.suspended', { school_id: schoolId, admin_user_id: adminUserId, reason })
  },

  async activate(schoolId: string, adminUserId: string): Promise<void> {
    await TenantRepository.setStatus(schoolId, 'active', null)
    logger.info({ school_id: schoolId, admin_user_id: adminUserId }, 'school activated')
    securityLog('tenant.activated', { school_id: schoolId, admin_user_id: adminUserId })
  },

  async changePlan(schoolId: string, plan: SchoolPlan, adminUserId: string): Promise<void> {
    await TenantRepository.setPlan(schoolId, plan)
    logger.info({ school_id: schoolId, plan, admin_user_id: adminUserId }, 'school plan changed')
    securityLog('tenant.plan_changed', { school_id: schoolId, plan, admin_user_id: adminUserId })
  },

  // current_school_id() returns NULL for suspended schools (migration 20260519230000),
  // so all downstream RLS policies automatically block suspended tenants.
  async isActive(schoolId: string): Promise<boolean> {
    const tenant = await TenantRepository.getTenant(schoolId)
    return tenant?.status === 'active'
  },
}
