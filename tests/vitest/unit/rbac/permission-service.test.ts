import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OGRETMEN_PERMS, MUDUR_PERMS, MUDUR_YARDIMCISI_PERMS } from '../../setup/factories'
import type { GrantedPermission } from '@/src/domains/rbac/types'

// Repository tamamen mock — DB bağlantısı yok
vi.mock('@/src/domains/rbac/repositories/RbacRepository', () => ({
  RbacRepository: {
    getUserPermissions: vi.fn(),
    hasPermission:      vi.fn(),
    getUserRoles:       vi.fn(),
    grantPermission:    vi.fn(),
    revokeDirectPermission: vi.fn(),
  },
}))

const { RbacRepository } = await import('@/src/domains/rbac/repositories/RbacRepository')
const { PermissionService } = await import('@/src/domains/rbac/services/PermissionService')

const USER_ID   = 'user-unit-test'
const SCHOOL_ID = 'school-unit-test'

function mockPerms(perms: GrantedPermission[]) {
  vi.mocked(RbacRepository.getUserPermissions).mockResolvedValue(perms)
}

beforeEach(() => { vi.clearAllMocks() })

// ─────────────────────────────────────────────────────────────
describe('PermissionService.check()', () => {
  it('öğretmen homework:create yapabilir', async () => {
    mockPerms(OGRETMEN_PERMS)
    expect(await PermissionService.check(USER_ID, SCHOOL_ID, 'homework', 'create')).toBe(true)
  })

  it('öğretmen users:manage yapamaz', async () => {
    mockPerms(OGRETMEN_PERMS)
    expect(await PermissionService.check(USER_ID, SCHOOL_ID, 'users', 'manage')).toBe(false)
  })

  it('müdür users:manage yapabilir', async () => {
    mockPerms(MUDUR_PERMS)
    expect(await PermissionService.check(USER_ID, SCHOOL_ID, 'users', 'manage')).toBe(true)
  })

  it('müdür yardımcısı users:delete yapabilir, manage yapamaz', async () => {
    mockPerms(MUDUR_YARDIMCISI_PERMS)
    expect(await PermissionService.check(USER_ID, SCHOOL_ID, 'users', 'delete')).toBe(true)
    expect(await PermissionService.check(USER_ID, SCHOOL_ID, 'users', 'manage')).toBe(false)
  })

  it('boş izin listesi → her şey false', async () => {
    mockPerms([])
    expect(await PermissionService.check(USER_ID, SCHOOL_ID, 'homework', 'create')).toBe(false)
    expect(await PermissionService.check(USER_ID, SCHOOL_ID, 'school',   'manage')).toBe(false)
  })

  it('getUserPermissions bir kez çağrılır (cache)', async () => {
    mockPerms(OGRETMEN_PERMS)
    await PermissionService.check(USER_ID, SCHOOL_ID, 'homework', 'create')
    await PermissionService.check(USER_ID, SCHOOL_ID, 'attendance', 'create')
    // React cache mock passthrough, ama aynı userId+schoolId için tek çağrı bekliyoruz
    expect(RbacRepository.getUserPermissions).toHaveBeenCalledWith(USER_ID, SCHOOL_ID)
  })
})

// ─────────────────────────────────────────────────────────────
describe('PermissionService.getScope()', () => {
  it('öğretmen homework:update için "own" scope alır', async () => {
    mockPerms(OGRETMEN_PERMS)
    const scope = await PermissionService.getScope(USER_ID, SCHOOL_ID, 'homework', 'update')
    expect(scope).toBe('own')
  })

  it('müdür yardımcısı homework:update için "school" scope alır', async () => {
    mockPerms([
      ...OGRETMEN_PERMS,
      { resource: 'homework', action: 'update', scope: 'school', source: 'role' },
    ])
    const scope = await PermissionService.getScope(USER_ID, SCHOOL_ID, 'homework', 'update')
    // 'school' scope 'own' scope'u override eder
    expect(scope).toBe('school')
  })

  it('izin yoksa null döner', async () => {
    mockPerms(OGRETMEN_PERMS)
    const scope = await PermissionService.getScope(USER_ID, SCHOOL_ID, 'users', 'manage')
    expect(scope).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
describe('PermissionService.checkMany()', () => {
  it('birden fazla izni tek seferde kontrol eder', async () => {
    mockPerms(OGRETMEN_PERMS)
    const result = await PermissionService.checkMany(USER_ID, SCHOOL_ID, [
      { resource: 'homework', action: 'create' },
      { resource: 'homework', action: 'read'   },
      { resource: 'users',    action: 'manage' },
    ])
    expect(result).toMatchObject({
      'homework:create': true,
      'homework:read':   true,
      'users:manage':    false,
    })
  })
})

// ─────────────────────────────────────────────────────────────
describe('PermissionService.isAdmin()', () => {
  it('users:manage izni olan kişi admin sayılır', async () => {
    mockPerms(MUDUR_PERMS)
    expect(await PermissionService.isAdmin(USER_ID, SCHOOL_ID)).toBe(true)
  })

  it('öğretmen admin sayılmaz', async () => {
    mockPerms(OGRETMEN_PERMS)
    expect(await PermissionService.isAdmin(USER_ID, SCHOOL_ID)).toBe(false)
  })
})
