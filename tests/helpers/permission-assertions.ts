import { expect } from 'vitest'
import type { GrantedPermission, Resource, Action } from '@/src/domains/rbac/types'

/** Perm setinin belirtilen resource:action çiftini içerdiğini doğrular. */
export function expectPermission(
  perms: GrantedPermission[],
  resource: Resource,
  action: Action,
  scope?: 'own' | 'school' | 'any'
) {
  if (scope) {
    // Exact triple match — önemli: aynı resource:action için birden fazla scope olabilir
    const match = perms.find(
      p => p.resource === resource && p.action === action && p.scope === scope
    )
    expect(match, `Expected ${resource}:${action}:${scope} to exist`).toBeDefined()
  } else {
    const match = perms.find(p => p.resource === resource && p.action === action)
    expect(match, `Expected ${resource}:${action} to exist`).toBeDefined()
  }
}

/** Perm setinin belirtilen resource:action çiftini İÇERMEDİĞİNİ doğrular. */
export function expectNoPermission(
  perms: GrantedPermission[],
  resource: Resource,
  action: Action
) {
  const match = perms.find(p => p.resource === resource && p.action === action)
  expect(match, `Expected ${resource}:${action} to NOT exist`).toBeUndefined()
}

/**
 * subPerms içindeki her iznin superPerms'de de bulunduğunu doğrular.
 * Alt rol inheritance testlerinde kullanılır.
 */
export function expectIncludes(
  superPerms: GrantedPermission[],
  subPerms: GrantedPermission[]
) {
  for (const sub of subPerms) {
    const found = superPerms.some(
      s => s.resource === sub.resource && s.action === sub.action && s.scope === sub.scope
    )
    expect(
      found,
      `Üst rol şu izni inherit etmeli: ${sub.resource}:${sub.action}:${sub.scope}`
    ).toBe(true)
  }
}

/** Perm setindeki toplam izin sayısını doğrular (snapshot guard). */
export function expectPermissionCount(perms: GrantedPermission[], count: number) {
  expect(perms.length, `Permission count should be ${count}`).toBe(count)
}

/** resource:action:scope üçlüsüne göre unique izin sayısını döndürür. */
export function uniquePerms(perms: GrantedPermission[]): GrantedPermission[] {
  const seen = new Set<string>()
  return perms.filter(p => {
    const key = `${p.resource}:${p.action}:${p.scope}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
