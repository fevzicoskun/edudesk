import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  MUDUR_PERMISSIONS,
  MUDUR_YARDIMCISI_PERMISSIONS,
  ZUMRE_BASKANI_PERMISSIONS,
  OGRETMEN_PERMISSIONS,
} from '../fixtures/permissions'
import {
  expectPermission,
  expectIncludes,
} from '../helpers/permission-assertions'

vi.mock('@/src/domains/rbac/repositories/RbacRepository', () => ({
  RbacRepository: { getUserPermissions: vi.fn() },
}))

const { RbacRepository }   = await import('@/src/domains/rbac/repositories/RbacRepository')
const { PermissionService } = await import('@/src/domains/rbac/services/PermissionService')

const U = 'user-mudur'
const S = 'school-test'

function mock() {
  vi.mocked(RbacRepository.getUserPermissions).mockResolvedValue(MUDUR_PERMISSIONS)
}

beforeEach(() => { vi.clearAllMocks(); mock() })

// ─── Fixture integrity ────────────────────────────────────────────────────────
describe('MUDUR_PERMISSIONS fixture', () => {
  it('snapshot', () => {
    expect(MUDUR_PERMISSIONS).toMatchSnapshot()
  })

  it('müdür yardımcısı izinlerini tam içerir (inheritance)', () => {
    expectIncludes(MUDUR_PERMISSIONS, MUDUR_YARDIMCISI_PERMISSIONS)
  })

  it('zümre başkanı izinlerini tam içerir (transitive)', () => {
    expectIncludes(MUDUR_PERMISSIONS, ZUMRE_BASKANI_PERMISSIONS)
  })

  it('öğretmen izinlerini tam içerir (transitive)', () => {
    expectIncludes(MUDUR_PERMISSIONS, OGRETMEN_PERMISSIONS)
  })
})

// ─── Tam kullanıcı yönetimi ───────────────────────────────────────────────────
describe('Kullanıcı yönetimi (users)', () => {
  it('kullanıcı yönetim yetkisine sahip (manage)', () => {
    expectPermission(MUDUR_PERMISSIONS, 'users', 'manage', 'school')
  })
  it('isAdmin() → true', async () => {
    expect(await PermissionService.isAdmin(U, S)).toBe(true)
  })
})

// ─── Okul yönetimi ────────────────────────────────────────────────────────────
describe('Okul yönetimi (school)', () => {
  it('okul bilgilerini okuyabilir', () => {
    expectPermission(MUDUR_PERMISSIONS, 'school', 'read', 'school')
  })
  it('okul ayarlarını güncelleyebilir', () => {
    expectPermission(MUDUR_PERMISSIONS, 'school', 'update', 'school')
  })
  it('okul yönetim yetkisine sahip', () => {
    expectPermission(MUDUR_PERMISSIONS, 'school', 'manage', 'school')
  })
})

// ─── Notlara geniş erişim ─────────────────────────────────────────────────────
describe('Notlar — geniş okuma', () => {
  it('tüm öğretmenlerin notlarını okuyabilir (school scope)', () => {
    expectPermission(MUDUR_PERMISSIONS, 'notes', 'read', 'school')
  })
})

// ─── PermissionService entegrasyonu ──────────────────────────────────────────
describe('PermissionService ile müdür kontrolü', () => {
  it('users:manage → true', async () => {
    expect(await PermissionService.check(U, S, 'users', 'manage')).toBe(true)
  })
  it('school:manage → true', async () => {
    expect(await PermissionService.check(U, S, 'school', 'manage')).toBe(true)
  })
  it('school:update → true', async () => {
    expect(await PermissionService.check(U, S, 'school', 'update')).toBe(true)
  })
  it('zumre:create → true (inherited)', async () => {
    expect(await PermissionService.check(U, S, 'zumre', 'create')).toBe(true)
  })
  it('exam:create → true (inherited)', async () => {
    expect(await PermissionService.check(U, S, 'exam', 'create')).toBe(true)
  })
  it('notes:read scope → school', async () => {
    expect(await PermissionService.getScope(U, S, 'notes', 'read')).toBe('school')
  })
  it('checkMany() tam yetki doğrulaması', async () => {
    const result = await PermissionService.checkMany(U, S, [
      { resource: 'users',  action: 'manage' },
      { resource: 'school', action: 'update' },
      { resource: 'school', action: 'manage' },
      { resource: 'zumre',  action: 'create' },
      { resource: 'exam',   action: 'create' },
    ])
    expect(Object.values(result).every(Boolean)).toBe(true)
  })
})
