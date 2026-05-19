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

// ─── Zümre yönetimi ───────────────────────────────────────────────────────────
describe('Zümre (zumre)', () => {
  it('zümre toplantısı oluşturabilir', () => {
    expectPermission(ZUMRE_BASKANI_PERMISSIONS, 'zumre', 'create', 'school')
  })
  it('zümre kayıtlarını okuyabilir', () => {
    expectPermission(ZUMRE_BASKANI_PERMISSIONS, 'zumre', 'read', 'school')
  })
  it('zümre kayıtlarını güncelleyebilir', () => {
    expectPermission(ZUMRE_BASKANI_PERMISSIONS, 'zumre', 'update', 'school')
  })
  it('zümre kayıtlarını silebilir', () => {
    expectPermission(ZUMRE_BASKANI_PERMISSIONS, 'zumre', 'delete', 'school')
  })
  it('zümre yönetim yetkisine sahip', () => {
    expectPermission(ZUMRE_BASKANI_PERMISSIONS, 'zumre', 'manage', 'school')
  })
})

// ─── Sınav yönetimi ───────────────────────────────────────────────────────────
describe('Sınav (exam)', () => {
  it('ortak sınav oluşturabilir', () => {
    expectPermission(ZUMRE_BASKANI_PERMISSIONS, 'exam', 'create', 'school')
  })
  it('sınavları okuyabilir', () => {
    expectPermission(ZUMRE_BASKANI_PERMISSIONS, 'exam', 'read', 'school')
  })
  it('sınav güncelleyebilir', () => {
    expectPermission(ZUMRE_BASKANI_PERMISSIONS, 'exam', 'update', 'school')
  })
  it('sınav silebilir', () => {
    expectPermission(ZUMRE_BASKANI_PERMISSIONS, 'exam', 'delete', 'school')
  })
})

// ─── Sınıf yönetimi ───────────────────────────────────────────────────────────
describe('Sınıf (classes)', () => {
  it('sınıf oluşturabilir', () => {
    expectPermission(ZUMRE_BASKANI_PERMISSIONS, 'classes', 'create', 'school')
  })
  it('sınıf silebilir', () => {
    expectPermission(ZUMRE_BASKANI_PERMISSIONS, 'classes', 'delete', 'school')
  })
  it('sınıfları okuyabilir (inherited)', () => {
    expectPermission(ZUMRE_BASKANI_PERMISSIONS, 'classes', 'read', 'school')
  })
})

// ─── Ödev — genişletilmiş scope ───────────────────────────────────────────────
describe('Ödev geniş kapsam (homework)', () => {
  it('tüm okul ödevlerini güncelleyebilir (school scope)', () => {
    expectPermission(ZUMRE_BASKANI_PERMISSIONS, 'homework', 'update', 'school')
  })
  it('homework:update için en geniş scope school olmalı', async () => {
    expect(await PermissionService.getScope(U, S, 'homework', 'update')).toBe('school')
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
  it('zumre:create → true', async () => {
    expect(await PermissionService.check(U, S, 'zumre', 'create')).toBe(true)
  })
  it('exam:create → true', async () => {
    expect(await PermissionService.check(U, S, 'exam', 'create')).toBe(true)
  })
  it('users:manage → false', async () => {
    expect(await PermissionService.check(U, S, 'users', 'manage')).toBe(false)
  })
  it('isAdmin() → false', async () => {
    expect(await PermissionService.isAdmin(U, S)).toBe(false)
  })
  it('checkMany() doğru çalışır', async () => {
    const result = await PermissionService.checkMany(U, S, [
      { resource: 'zumre',    action: 'create' },
      { resource: 'exam',     action: 'create' },
      { resource: 'classes',  action: 'create' },
      { resource: 'users',    action: 'manage' },
      { resource: 'school',   action: 'update' },
    ])
    expect(result['zumre:create']).toBe(true)
    expect(result['exam:create']).toBe(true)
    expect(result['classes:create']).toBe(true)
    expect(result['users:manage']).toBe(false)
    expect(result['school:update']).toBe(false)
  })
})
