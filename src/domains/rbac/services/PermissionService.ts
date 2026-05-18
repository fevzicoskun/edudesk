import { cache } from 'react'
import { RbacRepository } from '../repositories/RbacRepository'
import type { Resource, Action, GrantedPermission, AccessScope } from '../types'

/**
 * React cache() sayesinde aynı request içinde tekrar çağrılırsa DB'ye gitmez.
 * Her yeni istek için sıfırdan yüklenir — Redis/KV cache değil, request-scoped cache.
 */
const loadPermissions = cache(
  async (userId: string, schoolId: string): Promise<GrantedPermission[]> => {
    return RbacRepository.getUserPermissions(userId, schoolId)
  }
)

export const PermissionService = {
  /** Tüm izinleri yükle (request cache'li) */
  load: loadPermissions,

  /** Kullanıcının belirli bir işlem yapıp yapamayacağını kontrol eder */
  async check(
    userId: string,
    schoolId: string,
    resource: Resource,
    action: Action
  ): Promise<boolean> {
    const perms = await loadPermissions(userId, schoolId)
    return perms.some(p => p.resource === resource && p.action === action)
  },

  /**
   * Kullanıcının bir kaynak üzerindeki erişim kapsamını döndürür.
   * 'school' > 'own' — iki scope varsa geniş olanı döner.
   */
  async getScope(
    userId: string,
    schoolId: string,
    resource: Resource,
    action: Action
  ): Promise<AccessScope> {
    const perms = await loadPermissions(userId, schoolId)
    const matches = perms.filter(p => p.resource === resource && p.action === action)
    if (!matches.length) return null
    if (matches.some(p => p.scope === 'school')) return 'school'
    return 'own'
  },

  /**
   * Birden fazla izni tek seferde kontrol eder.
   * Dönen nesne: { 'homework:create': true, 'users:delete': false, ... }
   */
  async checkMany(
    userId: string,
    schoolId: string,
    checks: { resource: Resource; action: Action }[]
  ): Promise<Record<string, boolean>> {
    const perms = await loadPermissions(userId, schoolId)
    const result: Record<string, boolean> = {}
    for (const { resource, action } of checks) {
      result[`${resource}:${action}`] = perms.some(
        p => p.resource === resource && p.action === action
      )
    }
    return result
  },

  /** Kullanıcı yönetici mi? (users:manage veya school:manage yetkisi olan) */
  async isAdmin(userId: string, schoolId: string): Promise<boolean> {
    const perms = await loadPermissions(userId, schoolId)
    return perms.some(
      p =>
        (p.resource === 'users'  && p.action === 'manage') ||
        (p.resource === 'school' && p.action === 'manage')
    )
  },

  /** Kullanıcı kullanıcı davet edebilir mi? */
  async canManageUsers(userId: string, schoolId: string): Promise<boolean> {
    return PermissionService.check(userId, schoolId, 'users', 'create')
  },
}
