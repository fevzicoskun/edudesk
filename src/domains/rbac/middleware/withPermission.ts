'use server'

import { getCurrentUser, requireSchoolId } from '@/src/shared/auth'
import { PermissionService } from '../services/PermissionService'
import type { Resource, Action, AccessScope } from '../types'
import type { PermissionKey } from '@/src/shared/authorization'

type ActionFn<TArgs extends unknown[], TReturn> = (...args: TArgs) => Promise<TReturn>

export type AuthContext = {
  userId:   string
  schoolId: string
  scope:    AccessScope
}

// ─── withPermission (overloaded) ──────────────────────────────────────────────

/**
 * Server Action sarmalayıcısı — izin yoksa AuthorizationError fırlatır.
 *
 * Yeni API (tercih edilen):
 * @example
 * export const createHomework = withPermission(
 *   P.HOMEWORK.CREATE,
 *   async (ctx, formData: FormData) => { ... }
 * )
 *
 * Eski API (backward compat):
 * @example
 * export const createHomework = withPermission(
 *   'homework', 'create',
 *   async (ctx, formData: FormData) => { ... }
 * )
 */
export function withPermission<TArgs extends unknown[], TReturn>(
  perm:    PermissionKey,
  handler: (ctx: AuthContext, ...args: TArgs) => Promise<TReturn>
): ActionFn<TArgs, TReturn>

export function withPermission<TArgs extends unknown[], TReturn>(
  resource: Resource,
  action:   Action,
  handler:  (ctx: AuthContext, ...args: TArgs) => Promise<TReturn>
): ActionFn<TArgs, TReturn>

export function withPermission<TArgs extends unknown[], TReturn>(
  permOrResource: PermissionKey | Resource,
  actionOrHandler: Action | ((ctx: AuthContext, ...args: TArgs) => Promise<TReturn>),
  maybeHandler?: (ctx: AuthContext, ...args: TArgs) => Promise<TReturn>
): ActionFn<TArgs, TReturn> {
  let resource: Resource
  let action:   Action
  let handler:  (ctx: AuthContext, ...args: TArgs) => Promise<TReturn>

  if (typeof permOrResource === 'object') {
    resource = permOrResource.resource
    action   = permOrResource.action
    handler  = actionOrHandler as typeof handler
  } else {
    resource = permOrResource
    action   = actionOrHandler as Action
    handler  = maybeHandler!
  }

  return async (...args: TArgs): Promise<TReturn> => {
    const user = await getCurrentUser()
    if (!user) throw new Error('Giriş gerekli')

    const schoolId = await requireSchoolId()

    const allowed = await PermissionService.check(user.id, schoolId, resource, action)
    if (!allowed) throw new Error(`Yetki yok: ${resource}:${action}`)

    const scope = await PermissionService.getScope(user.id, schoolId, resource, action)
    return handler({ userId: user.id, schoolId, scope }, ...args)
  }
}

// ─── withAnyPermission ────────────────────────────────────────────────────────

/**
 * Birden fazla izinden herhangi biri yeterliyse geçiren sarmalayıcı (OR mantığı).
 * `P.*` sabitleri doğrudan kullanılabilir.
 *
 * @example
 * export const updateHomework = withAnyPermission(
 *   [P.HOMEWORK.UPDATE, P.HOMEWORK.MANAGE],  // P.HOMEWORK.MANAGE exists? No — just example
 *   async (ctx, id: string, data) => { ... }
 * )
 */
export function withAnyPermission<TArgs extends unknown[], TReturn>(
  requirements: readonly PermissionKey[],
  handler:      (ctx: AuthContext, ...args: TArgs) => Promise<TReturn>
): ActionFn<TArgs, TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const user = await getCurrentUser()
    if (!user) throw new Error('Giriş gerekli')

    const schoolId = await requireSchoolId()

    const results = await PermissionService.checkMany(user.id, schoolId, requirements as { resource: Resource; action: Action }[])
    const allowed = Object.values(results).some(Boolean)
    if (!allowed) {
      const list = requirements.map(r => `${r.resource}:${r.action}`).join(' | ')
      throw new Error(`Yetki yok: ${list}`)
    }

    const matched = requirements.find(r => results[`${r.resource}:${r.action}`])!
    const scope   = await PermissionService.getScope(user.id, schoolId, matched.resource, matched.action)
    return handler({ userId: user.id, schoolId, scope }, ...args)
  }
}

// ─── checkPermission (Server Component yardımcısı) ────────────────────────────

/**
 * Sadece yetki kontrolü yapar, boolean döner.
 * Server Component'ta conditional rendering için kullanın.
 *
 * @example
 * const canDelete = await checkPermission(P.CLASSES.DELETE)
 */
export async function checkPermission(
  permOrResource: PermissionKey | Resource,
  maybeAction?:   Action,
): Promise<boolean> {
  const resource = typeof permOrResource === 'object' ? permOrResource.resource : permOrResource
  const action   = typeof permOrResource === 'object' ? permOrResource.action   : maybeAction!

  const user = await getCurrentUser()
  if (!user) return false
  try {
    const schoolId = await requireSchoolId()
    return PermissionService.check(user.id, schoolId, resource, action)
  } catch (err) {
    // requireSchoolId başarısız — multi-tenant context dışında çağrılmış olabilir
    void err
    return false
  }
}
