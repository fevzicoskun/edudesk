/**
 * Authorization Engine — merkezi yetki kontrol altyapısı.
 *
 * Tasarım ilkeleri:
 *  - Pure & sync: createAbility senkron, hiç DB çağrısı yok
 *  - Testable: permission array doğrudan verilebilir, mock gerekmez
 *  - Type-safe: magic string yok, literal types throughout
 *  - Audit-friendly: her red kararı yapılandırılmış DenialReason üretir
 *  - Scope-aware: own / school / any hiyerarşisi
 *
 * Kullanım (Server Component / Action):
 *   const ability = await requireAbility()       // server.ts'den
 *   ability.can(P.HOMEWORK.CREATE)               // boolean
 *   ability.can(P.HOMEWORK.UPDATE, hw.teacher_id) // own-scope kontrolü
 *   guard(ability, P.CLASSES.DELETE)             // throw on deny
 *
 * Kullanım (test):
 *   const ability = createAbility({ userId, schoolId, permissions: OGRETMEN_PERMISSIONS })
 *   expect(ability.can(P.HOMEWORK.CREATE)).toBe(true)
 */

import type { GrantedPermission, Resource, Action, Scope } from '@/src/domains/rbac/types'

// ─── Context ──────────────────────────────────────────────────────────────────

export interface AuthorizationContext {
  readonly userId:      string
  readonly schoolId:    string
  readonly permissions: readonly GrantedPermission[]
}

// ─── Permission key ───────────────────────────────────────────────────────────

/** Bir izni temsil eden tip-güvenli nesne — P.HOMEWORK.CREATE gibi sabitler */
export type PermissionKey = { readonly resource: Resource; readonly action: Action }

// ─── Denial reason (audit-friendly) ──────────────────────────────────────────

export type DenialCode =
  | 'UNAUTHENTICATED'        // kullanıcı giriş yapmamış
  | 'UNAUTHORIZED'           // izin hiç tanımlı değil
  | 'INSUFFICIENT_SCOPE'     // izin var ama 'own' scope, başkasının kaydına erişilmeye çalışılıyor
  | 'SUBSCRIPTION_EXPIRED'   // okul aboneliği sona ermiş / askıya alınmış

export interface DenialReason {
  readonly code:           DenialCode
  readonly permission:     string        // 'homework:create' | '*'
  readonly required_scope?: Scope
  readonly actual_scope?:  Scope | null
  readonly userId?:        string
  readonly schoolId?:      string
}

export interface AuthorizationResult {
  readonly allowed: boolean
  readonly denial?: DenialReason
}

// ─── Ability interface ────────────────────────────────────────────────────────

export interface Ability {
  readonly userId:   string
  readonly schoolId: string
  /**
   * İzin var mı?
   * ownerId verilirse ve scope 'own' ise, ctx.userId === ownerId kontrolü yapılır.
   */
  can(perm: PermissionKey, ownerId?: string | null): boolean
  /** can() tersine — izin YOK mu? */
  cannot(perm: PermissionKey, ownerId?: string | null): boolean
  /** Geçerli izin kapsamını döndürür: 'school' | 'own' | null */
  scope(perm: PermissionKey): Scope | null
  /** Tüm kararı döndürür — audit/logging için */
  check(perm: PermissionKey, ownerId?: string | null): AuthorizationResult
  /** İzin yoksa AuthorizationError fırlatır */
  assert(perm: PermissionKey, ownerId?: string | null): asserts this is Ability
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class AuthorizationError extends Error {
  readonly denial: DenialReason

  constructor(denial: DenialReason) {
    super(buildMessage(denial))
    this.name   = 'AuthorizationError'
    this.denial = denial
  }
}

function buildMessage(d: DenialReason): string {
  if (d.code === 'UNAUTHENTICATED')        return 'Giriş gerekli'
  if (d.code === 'SUBSCRIPTION_EXPIRED')   return 'Okul aboneliği sona erdi'
  if (d.code === 'INSUFFICIENT_SCOPE')     return `Yetki yetersiz: ${d.permission} — kendi kaydınız değil`
  return `Yetki yok: ${d.permission}`
}

// ─── Core logic (pure) ────────────────────────────────────────────────────────

function resolveScope(
  permissions: readonly GrantedPermission[],
  resource: Resource,
  action: Action,
): Scope | null {
  const matches = permissions.filter(p => p.resource === resource && p.action === action)
  if (!matches.length) return null
  // 'any' ve 'school' geniş scope — varsa school döner (school > own)
  return matches.some(p => p.scope === 'any' || p.scope === 'school') ? 'school' : 'own'
}

function runCheck(
  ctx:      AuthorizationContext,
  resource: Resource,
  action:   Action,
  ownerId?: string | null,
): AuthorizationResult {
  const key   = `${resource}:${action}`
  const scope = resolveScope(ctx.permissions, resource, action)

  if (!scope) {
    return {
      allowed: false,
      denial: { code: 'UNAUTHORIZED', permission: key, userId: ctx.userId, schoolId: ctx.schoolId },
    }
  }

  // own-scope: kayıt sahibi başkasıysa ret
  if (scope === 'own' && ownerId != null && ownerId !== ctx.userId) {
    return {
      allowed: false,
      denial: {
        code:           'INSUFFICIENT_SCOPE',
        permission:     key,
        required_scope: 'school',
        actual_scope:   'own',
        userId:         ctx.userId,
        schoolId:       ctx.schoolId,
      },
    }
  }

  return { allowed: true }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createAbility(ctx: AuthorizationContext): Ability {
  return {
    userId:   ctx.userId,
    schoolId: ctx.schoolId,

    can(perm, ownerId) {
      return runCheck(ctx, perm.resource, perm.action, ownerId).allowed
    },

    cannot(perm, ownerId) {
      return !runCheck(ctx, perm.resource, perm.action, ownerId).allowed
    },

    scope(perm) {
      return resolveScope(ctx.permissions, perm.resource, perm.action)
    },

    check(perm, ownerId) {
      return runCheck(ctx, perm.resource, perm.action, ownerId)
    },

    assert(perm, ownerId) {
      const result = runCheck(ctx, perm.resource, perm.action, ownerId)
      if (!result.allowed) throw new AuthorizationError(result.denial!)
    },
  }
}

// ─── Module-level API ─────────────────────────────────────────────────────────

/**
 * `can(ability, P.HOMEWORK.CREATE)` — kısa form, ability.can() alias'ı.
 * @param ownerId  own-scope kontrolü için kayıt sahibi ID'si (opsiyonel)
 */
export function can(
  ability:  Ability,
  perm:     PermissionKey,
  ownerId?: string | null,
): boolean {
  return ability.can(perm, ownerId)
}

/**
 * `cannot(ability, P.USERS.MANAGE)` — kısa form, ability.cannot() alias'ı.
 */
export function cannot(
  ability:  Ability,
  perm:     PermissionKey,
  ownerId?: string | null,
): boolean {
  return ability.cannot(perm, ownerId)
}

/**
 * `guard(ability, P.CLASSES.DELETE)` — izin yoksa AuthorizationError fırlatır.
 * Service ve action katmanında ad-hoc izin kontrolü için kullanın.
 *
 * @example
 * const ability = await requireAbility()
 * guard(ability, P.CLASSES.CREATE)
 * guard(ability, P.HOMEWORK.UPDATE, homework.teacher_id) // own-scope
 */
export function guard(
  ability:  Ability,
  perm:     PermissionKey,
  ownerId?: string | null,
): void {
  ability.assert(perm, ownerId)
}

/**
 * Tüm izinler gerekiyor (AND).
 * @throws AuthorizationError ilk başarısız izinde
 */
export function guardAll(ability: Ability, perms: readonly PermissionKey[]): void {
  for (const perm of perms) ability.assert(perm)
}

/**
 * Herhangi bir izin yeterli (OR).
 * @throws AuthorizationError hiçbiri yoksa
 */
export function guardAny(ability: Ability, perms: readonly PermissionKey[]): void {
  if (perms.some(p => ability.can(p))) return
  const list = perms.map(p => `${p.resource}:${p.action}`).join(' | ')
  throw new AuthorizationError({
    code:       'UNAUTHORIZED',
    permission: list,
    userId:     ability.userId,
    schoolId:   ability.schoolId,
  })
}
