import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  MUDUR_YARDIMCISI_PERMISSIONS,
  ZUMRE_BASKANI_PERMISSIONS,
  OGRETMEN_PERMISSIONS,
} from '../fixtures/permissions'
import {
  expectPermission,
  expectNoPermission,
  expectIncludes,
} from '../helpers/permission-assertions'

vi.mock('@/src/domains/rbac/repositories/RbacRepository', () => ({
  RbacRepository: { getUserPermissions: vi.fn() },
}))

const { RbacRepository }   = await import('@/src/domains/rbac/repositories/RbacRepository')
const { PermissionService } = await import('@/src/domains/rbac/services/PermissionService')

const U = 'user-mudur-yardimcisi'
const S = 'school-test'

function mock() {
  vi.mocked(RbacRepository.getUserPermissions).mockResolvedValue(MUDUR_YARDIMCISI_PERMISSIONS)
}

beforeEach(() => { vi.clearAllMocks(); mock() })

// ─── Fixture integrity ────────────────────────────────────────────────────────
describe('MUDUR_YARDIMCISI_PERMISSIONS fixture', () => {
  it('snapshot', () => {
    expect(MUDUR_YARDIMCISI_PERMISSIONS).toMatchSnapshot()
  })

  it('zümre başkanı izinlerini tam içerir (inheritance)', () => {
    expectIncludes(MUDUR_YARDIMCISI_PERMISSIONS, ZUMRE_BASKANI_PERMISSIONS)
  })

  it('öğretmen izinlerini tam içerir (transitive inheritance)', () => {
    expectIncludes(MUDUR_YARDIMCISI_PERMISSIONS, OGRETMEN_PERMISSIONS)
  })
})

// ─── Kullanıcı yönetimi ───────────────────────────────────────────────────────
describe('Kullanıcı (users)', () => {
  it('kullanıcı oluşturabilir', () => {
    expectPermission(MUDUR_YARDIMCISI_PERMISSIONS, 'users', 'create', 'school')
  })
  it('kullanıcı listesi görebilir', () => {
    expectPermission(MUDUR_YARDIMCISI_PERMISSIONS, 'users', 'read', 'school')
  })
  it('kullanıcı güncelleyebilir', () => {
    expectPermission(MUDUR_YARDIMCISI_PERMISSIONS, 'users', 'update', 'school')
  })
  it('kullanıcı silebilir', () => {
    expectPermission(MUDUR_YARDIMCISI_PERMISSIONS, 'users', 'delete', 'school')
  })
  it('kullanıcı YÖNETEMEz — manage yetkisi yok', () => {
    expectNoPermission(MUDUR_YARDIMCISI_PERMISSIONS, 'users', 'manage')
  })
})

// ─── Okul erişimi ─────────────────────────────────────────────────────────────
describe('Okul (school)', () => {
  it('okul bilgilerini okuyabilir', () => {
    expectPermission(MUDUR_YARDIMCISI_PERMISSIONS, 'school', 'read', 'school')
  })
  it('okul ayarlarını GÜNCELLEYEMEz', () => {
    expectNoPermission(MUDUR_YARDIMCISI_PERMISSIONS, 'school', 'update')
  })
  it('okul YÖNETEMEz', () => {
    expectNoPermission(MUDUR_YARDIMCISI_PERMISSIONS, 'school', 'manage')
  })
})

// ─── Genişletilmiş kapsam ─────────────────────────────────────────────────────
describe('Genişletilmiş kapsamlar', () => {
  it('tüm öğretmenlerin müfredatını güncelleyebilir (school scope)', () => {
    expectPermission(MUDUR_YARDIMCISI_PERMISSIONS, 'curriculum', 'update', 'school')
  })
  it('tüm yoklamaları görebilir (school scope)', () => {
    expectPermission(MUDUR_YARDIMCISI_PERMISSIONS, 'attendance', 'read', 'school')
  })
  it('curriculum:update scope → school', async () => {
    expect(await PermissionService.getScope(U, S, 'curriculum', 'update')).toBe('school')
  })
})

// ─── Yasak işlemler ───────────────────────────────────────────────────────────
describe('Yasak işlemler', () => {
  it('isAdmin() → false (manage yetkisi olmadığı için)', async () => {
    expect(await PermissionService.isAdmin(U, S)).toBe(false)
  })
  it('okul YÖNETEMEz', async () => {
    expect(await PermissionService.check(U, S, 'school', 'manage')).toBe(false)
  })
  it('kullanıcı YÖNETEMEz', async () => {
    expect(await PermissionService.check(U, S, 'users', 'manage')).toBe(false)
  })
})

// ─── PermissionService entegrasyonu ──────────────────────────────────────────
describe('PermissionService ile müdür yardımcısı kontrolü', () => {
  it('users:create → true', async () => {
    expect(await PermissionService.check(U, S, 'users', 'create')).toBe(true)
  })
  it('school:read → true', async () => {
    expect(await PermissionService.check(U, S, 'school', 'read')).toBe(true)
  })
  it('zumre:create → true (inherited)', async () => {
    expect(await PermissionService.check(U, S, 'zumre', 'create')).toBe(true)
  })
  it('checkMany() doğru çalışır', async () => {
    const result = await PermissionService.checkMany(U, S, [
      { resource: 'users',  action: 'create' },
      { resource: 'users',  action: 'manage' },
      { resource: 'school', action: 'read'   },
      { resource: 'school', action: 'update' },
    ])
    expect(result['users:create']).toBe(true)
    expect(result['users:manage']).toBe(false)
    expect(result['school:read']).toBe(true)
    expect(result['school:update']).toBe(false)
  })
})
