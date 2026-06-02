import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ZUMRE_BASKANI_PERMISSIONS, OGRETMEN_PERMISSIONS } from '../fixtures/permissions'
import {
  expectPermission,
  expectNoPermission,
  expectIncludes,
  uniquePerms,
} from '../helpers/permission-assertions'

vi.mock('@/src/domains/rbac/repositories/RbacRepository', () => ({
  RbacRepository: { getUserPermissions: vi.fn() },
}))

const { RbacRepository }   = await import('@/src/domains/rbac/repositories/RbacRepository')
const { PermissionService } = await import('@/src/domains/rbac/services/PermissionService')

const U = 'user-zumre-baskani'
const S = 'school-test'

function mock() {
  vi.mocked(RbacRepository.getUserPermissions).mockResolvedValue(ZUMRE_BASKANI_PERMISSIONS)
}

beforeEach(() => { vi.clearAllMocks(); mock() })

// ─── Fixture integrity ────────────────────────────────────────────────────────
describe('ZUMRE_BASKANI_PERMISSIONS fixture', () => {
  it('snapshot — rol değişikliklerini yakalar', () => {
    expect(ZUMRE_BASKANI_PERMISSIONS).toMatchSnapshot()
  })

  it('öğretmen izinlerini tam içerir (inheritance)', () => {
    expectIncludes(ZUMRE_BASKANI_PERMISSIONS, OGRETMEN_PERMISSIONS)
  })
})


// ─── Sınıf yönetimi ───────────────────────────────────────────────────────────
describe('Sınıf (classes)', () => {
  it('sınıfları okuyabilir (inherited)', () => {
    expectPermission(ZUMRE_BASKANI_PERMISSIONS, 'classes', 'read', 'school')
  })
  it('sınıf OLUŞTURAMAZ — bu yetki müdür yardımcısına aittir', () => {
    expectNoPermission(ZUMRE_BASKANI_PERMISSIONS, 'classes', 'create')
  })
  it('sınıf SİLEMEz — bu yetki müdür yardımcısına aittir', () => {
    expectNoPermission(ZUMRE_BASKANI_PERMISSIONS, 'classes', 'delete')
  })
})

// ─── Ödev — genişletilmiş scope ───────────────────────────────────────────────
describe('Ödev geniş kapsam (homework)', () => {
  it('tüm okul ödevlerini güncelleyebilir (school scope)', () => {
    expectPermission(ZUMRE_BASKANI_PERMISSIONS, 'homework', 'update', 'school')
  })
  it('tüm okul ödevlerini silebilir (school scope)', () => {
    expectPermission(ZUMRE_BASKANI_PERMISSIONS, 'homework', 'delete', 'school')
  })
  it('homework:update için en geniş scope school olmalı', async () => {
    expect(await PermissionService.getScope(U, S, 'homework', 'update')).toBe('school')
  })
  it('homework:delete için en geniş scope school olmalı', async () => {
    expect(await PermissionService.getScope(U, S, 'homework', 'delete')).toBe('school')
  })
})

// ─── Yasak işlemler ───────────────────────────────────────────────────────────
describe('Yasak işlemler', () => {
  it('kullanıcı YÖNETEMEz (manage)', () => {
    expectNoPermission(ZUMRE_BASKANI_PERMISSIONS, 'users', 'manage')
  })
  it('kullanıcı OLUŞTURAMAZ', () => {
    expectNoPermission(ZUMRE_BASKANI_PERMISSIONS, 'users', 'create')
  })
  it('okul ayarlarını GÜNCELLEYEMEz', () => {
    expectNoPermission(ZUMRE_BASKANI_PERMISSIONS, 'school', 'update')
  })
  it('okul YÖNETEMEz', () => {
    expectNoPermission(ZUMRE_BASKANI_PERMISSIONS, 'school', 'manage')
  })
})

// ─── PermissionService entegrasyonu ──────────────────────────────────────────
describe('PermissionService ile zümre başkanı kontrolü', () => {
  it('users:manage → false', async () => {
    expect(await PermissionService.check(U, S, 'users', 'manage')).toBe(false)
  })
  it('isAdmin() → false', async () => {
    expect(await PermissionService.isAdmin(U, S)).toBe(false)
  })
  it('checkMany() doğru çalışır', async () => {
    const result = await PermissionService.checkMany(U, S, [
      { resource: 'homework', action: 'delete' },
      { resource: 'classes',  action: 'create' },
      { resource: 'users',    action: 'manage' },
      { resource: 'school',   action: 'update' },
    ])
    expect(result['homework:delete']).toBe(true)
    expect(result['classes:create']).toBe(false)
    expect(result['users:manage']).toBe(false)
    expect(result['school:update']).toBe(false)
  })
})
