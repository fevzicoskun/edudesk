'use server'

import { getCurrentUser, requireSchoolId } from '@/src/shared/auth'
import { PermissionService } from '../services/PermissionService'
import type { Resource, Action, AccessScope } from '../types'

type ActionFn<TArgs extends unknown[], TReturn> = (...args: TArgs) => Promise<TReturn>

type AuthContext = {
  userId: string
  schoolId: string
  scope: AccessScope
}

/**
 * Server Action sarmalayıcısı — izin yoksa hata fırlatır.
 *
 * @example
 * export const createHomework = withPermission(
 *   'homework', 'create',
 *   async (ctx, formData: FormData) => { ... }
 * )
 */
export function withPermission<TArgs extends unknown[], TReturn>(
  resource: Resource,
  action: Action,
  handler: (ctx: AuthContext, ...args: TArgs) => Promise<TReturn>
): ActionFn<TArgs, TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const user = await getCurrentUser()
    if (!user) throw new Error('Giriş gerekli')

    const schoolId = await requireSchoolId()

    const allowed = await PermissionService.check(user.id, schoolId, resource, action)
    if (!allowed) {
      throw new Error(`Yetki yok: ${resource}:${action}`)
    }

    const scope = await PermissionService.getScope(user.id, schoolId, resource, action)

    return handler({ userId: user.id, schoolId, scope }, ...args)
  }
}

/**
 * Birden fazla izinden herhangi biri yeterliyse geçiren sarmalayıcı (OR mantığı).
 *
 * @example
 * export const updateHomework = withAnyPermission(
 *   [{ resource: 'homework', action: 'update' }, { resource: 'homework', action: 'manage' }],
 *   async (ctx, id: string, data) => { ... }
 * )
 */
export function withAnyPermission<TArgs extends unknown[], TReturn>(
  requirements: { resource: Resource; action: Action }[],
  handler: (ctx: AuthContext, ...args: TArgs) => Promise<TReturn>
): ActionFn<TArgs, TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const user = await getCurrentUser()
    if (!user) throw new Error('Giriş gerekli')

    const schoolId = await requireSchoolId()

    const results = await PermissionService.checkMany(user.id, schoolId, requirements)
    const allowed = Object.values(results).some(Boolean)
    if (!allowed) {
      const list = requirements.map(r => `${r.resource}:${r.action}`).join(' | ')
      throw new Error(`Yetki yok: ${list}`)
    }

    // Eşleşen ilk iznin scope'unu kullan
    const matched = requirements.find(r => results[`${r.resource}:${r.action}`])!
    const scope = await PermissionService.getScope(user.id, schoolId, matched.resource, matched.action)

    return handler({ userId: user.id, schoolId, scope }, ...args)
  }
}

/**
 * Sadece yetki kontrolü yapar, izin varsa `true` döner (action wrapper değil).
 * Client component'lardan import edilmeden önce Server Component'ta kullanın.
 */
export async function checkPermission(
  resource: Resource,
  action: Action
): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  try {
    const schoolId = await requireSchoolId()
    return PermissionService.check(user.id, schoolId, resource, action)
  } catch {
    return false
  }
}
