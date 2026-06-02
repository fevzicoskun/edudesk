import { describe, it, expect } from 'vitest'
import {
  OGRETMEN_PERMISSIONS,
  ZUMRE_BASKANI_PERMISSIONS,
  MUDUR_YARDIMCISI_PERMISSIONS,
  MUDUR_PERMISSIONS,
  ROLE_PERMISSIONS,
} from '../fixtures/permissions'
import { expectIncludes, uniquePerms } from '../helpers/permission-assertions'
import type { MockRole } from '../fixtures/permissions'

// ─── Kümülatif hiyerarşi: ogretmen ⊂ zumre_baskani ⊂ mudur_yardimcisi ⊂ mudur
describe('Rol inheritance hiyerarşisi', () => {
  it('zumre_baskani tüm ogretmen izinlerini içerir', () => {
    expectIncludes(ZUMRE_BASKANI_PERMISSIONS, OGRETMEN_PERMISSIONS)
  })

  it('mudur_yardimcisi tüm zumre_baskani izinlerini içerir', () => {
    expectIncludes(MUDUR_YARDIMCISI_PERMISSIONS, ZUMRE_BASKANI_PERMISSIONS)
  })

  it('mudur tüm mudur_yardimcisi izinlerini içerir', () => {
    expectIncludes(MUDUR_PERMISSIONS, MUDUR_YARDIMCISI_PERMISSIONS)
  })

  it('mudur transitif olarak tüm ogretmen izinlerini içerir', () => {
    expectIncludes(MUDUR_PERMISSIONS, OGRETMEN_PERMISSIONS)
  })
})

// ─── İzin sayısı monoton artışı ───────────────────────────────────────────────
describe('İzin kümesi büyüklüğü', () => {
  const roles: MockRole[] = ['ogretmen', 'zumre_baskani', 'mudur_yardimcisi', 'mudur']

  it('her üst rol bir öncekinden fazla veya eşit izne sahiptir', () => {
    for (let i = 1; i < roles.length; i++) {
      const lower = uniquePerms(ROLE_PERMISSIONS[roles[i - 1]]).length
      const upper = uniquePerms(ROLE_PERMISSIONS[roles[i]]).length
      expect(upper, `${roles[i]} (${upper}) >= ${roles[i-1]} (${lower})`).toBeGreaterThanOrEqual(lower)
    }
  })

  it('ogretmen en küçük izin kümesine sahiptir', () => {
    const ogretmenCount = uniquePerms(OGRETMEN_PERMISSIONS).length
    for (const role of ['zumre_baskani', 'mudur_yardimcisi', 'mudur'] as const) {
      expect(
        uniquePerms(ROLE_PERMISSIONS[role]).length,
        `${role} ogretmen'den daha fazla unique izne sahip olmalı`
      ).toBeGreaterThan(ogretmenCount)
    }
  })

  it('mudur en büyük izin kümesine sahiptir', () => {
    const mudurCount = uniquePerms(MUDUR_PERMISSIONS).length
    for (const role of ['ogretmen', 'zumre_baskani', 'mudur_yardimcisi'] as const) {
      expect(
        uniquePerms(ROLE_PERMISSIONS[role]).length,
        `${role} mudur'den daha az unique izne sahip olmalı`
      ).toBeLessThan(mudurCount)
    }
  })
})

// ─── Exclusive (üst role özgü) izinler ────────────────────────────────────────
describe('Role-exclusive izinler', () => {

  it('users:create sadece mudur_yardimcisi ve üstünde var', () => {
    const hasUsersCreate = (perms: typeof OGRETMEN_PERMISSIONS) =>
      perms.some(p => p.resource === 'users' && p.action === 'create')

    expect(hasUsersCreate(OGRETMEN_PERMISSIONS)).toBe(false)
    expect(hasUsersCreate(ZUMRE_BASKANI_PERMISSIONS)).toBe(false)
    expect(hasUsersCreate(MUDUR_YARDIMCISI_PERMISSIONS)).toBe(true)
    expect(hasUsersCreate(MUDUR_PERMISSIONS)).toBe(true)
  })

  it('classes:create sadece mudur_yardimcisi ve üstünde var', () => {
    const hasClassesCreate = (perms: typeof OGRETMEN_PERMISSIONS) =>
      perms.some(p => p.resource === 'classes' && p.action === 'create')

    expect(hasClassesCreate(OGRETMEN_PERMISSIONS)).toBe(false)
    expect(hasClassesCreate(ZUMRE_BASKANI_PERMISSIONS)).toBe(false)
    expect(hasClassesCreate(MUDUR_YARDIMCISI_PERMISSIONS)).toBe(true)
    expect(hasClassesCreate(MUDUR_PERMISSIONS)).toBe(true)
  })

  it('homework:delete: ogretmen(own), zumre_baskani ve üstü (school)', () => {
    const getHighestDeleteScope = (perms: typeof OGRETMEN_PERMISSIONS) => {
      const scopes = perms
        .filter(p => p.resource === 'homework' && p.action === 'delete')
        .map(p => p.scope)
      return scopes.includes('school') ? 'school' : scopes[0]
    }

    expect(getHighestDeleteScope(OGRETMEN_PERMISSIONS)).toBe('own')
    expect(getHighestDeleteScope(ZUMRE_BASKANI_PERMISSIONS)).toBe('school')
    expect(getHighestDeleteScope(MUDUR_YARDIMCISI_PERMISSIONS)).toBe('school')
    expect(getHighestDeleteScope(MUDUR_PERMISSIONS)).toBe('school')
  })

  it('users:manage sadece mudurde var', () => {
    const hasUsersManage = (perms: typeof OGRETMEN_PERMISSIONS) =>
      perms.some(p => p.resource === 'users' && p.action === 'manage')

    expect(hasUsersManage(OGRETMEN_PERMISSIONS)).toBe(false)
    expect(hasUsersManage(ZUMRE_BASKANI_PERMISSIONS)).toBe(false)
    expect(hasUsersManage(MUDUR_YARDIMCISI_PERMISSIONS)).toBe(false)
    expect(hasUsersManage(MUDUR_PERMISSIONS)).toBe(true)
  })

  it('school:update sadece mudurde var', () => {
    const hasSchoolUpdate = (perms: typeof OGRETMEN_PERMISSIONS) =>
      perms.some(p => p.resource === 'school' && p.action === 'update')

    expect(hasSchoolUpdate(OGRETMEN_PERMISSIONS)).toBe(false)
    expect(hasSchoolUpdate(ZUMRE_BASKANI_PERMISSIONS)).toBe(false)
    expect(hasSchoolUpdate(MUDUR_YARDIMCISI_PERMISSIONS)).toBe(false)
    expect(hasSchoolUpdate(MUDUR_PERMISSIONS)).toBe(true)
  })
})

// ─── ROLE_PERMISSIONS lookup tablosu ─────────────────────────────────────────
describe('ROLE_PERMISSIONS lookup', () => {
  it('4 rol tanımlı', () => {
    expect(Object.keys(ROLE_PERMISSIONS)).toHaveLength(4)
  })

  it('her rol için dizi boş değil', () => {
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      expect(perms.length, `${role} izin listesi boş olmamalı`).toBeGreaterThan(0)
    }
  })

  it('kaynak tipleri beklenen listeyle sınırlı', () => {
    const VALID_RESOURCES = new Set([
      'homework', 'attendance', 'students', 'classes',
      'users', 'school', 'export', 'notes',
    ])
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      for (const p of perms) {
        expect(VALID_RESOURCES.has(p.resource), `Geçersiz resource: ${p.resource}`).toBe(true)
      }
    }
  })

  it('action tipleri beklenen listeyle sınırlı', () => {
    const VALID_ACTIONS = new Set(['create', 'read', 'update', 'delete', 'manage'])
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      for (const p of perms) {
        expect(VALID_ACTIONS.has(p.action), `Geçersiz action: ${p.action}`).toBe(true)
      }
    }
  })

  it('source değerleri sadece role veya direct', () => {
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      for (const p of perms) {
        expect(['role', 'direct']).toContain(p.source)
      }
    }
  })
})
