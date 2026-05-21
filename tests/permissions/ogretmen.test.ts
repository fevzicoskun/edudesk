import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OGRETMEN_PERMISSIONS } from '../fixtures/permissions'
import { expectPermission, expectNoPermission, uniquePerms } from '../helpers/permission-assertions'

vi.mock('@/src/domains/rbac/repositories/RbacRepository', () => ({
  RbacRepository: { getUserPermissions: vi.fn() },
}))

const { RbacRepository }   = await import('@/src/domains/rbac/repositories/RbacRepository')
const { PermissionService } = await import('@/src/domains/rbac/services/PermissionService')

const U = 'user-ogretmen'
const S = 'school-test'

function mock() {
  vi.mocked(RbacRepository.getUserPermissions).mockResolvedValue(OGRETMEN_PERMISSIONS)
}

beforeEach(() => { vi.clearAllMocks(); mock() })

// ─── Fixture integrity ────────────────────────────────────────────────────────
describe('OGRETMEN_PERMISSIONS fixture', () => {
  it('19 izin içerir', () => {
    expect(uniquePerms(OGRETMEN_PERMISSIONS)).toHaveLength(19)
  })

  it('snapshot — rol değişikliklerini yakalar', () => {
    expect(OGRETMEN_PERMISSIONS).toMatchSnapshot()
  })
})

// ─── Ödev izinleri ────────────────────────────────────────────────────────────
describe('Ödev (homework)', () => {
  it('kendi ödevini oluşturabilir (own)', () => {
    expectPermission(OGRETMEN_PERMISSIONS, 'homework', 'create', 'own')
  })
  it('okul genelindeki ödevleri okuyabilir (school)', () => {
    expectPermission(OGRETMEN_PERMISSIONS, 'homework', 'read', 'school')
  })
  it('kendi ödevini güncelleyebilir (own)', () => {
    expectPermission(OGRETMEN_PERMISSIONS, 'homework', 'update', 'own')
  })
  it('kendi ödevini silebilir (own)', () => {
    expectPermission(OGRETMEN_PERMISSIONS, 'homework', 'delete', 'own')
  })
})

// ─── Yoklama izinleri ─────────────────────────────────────────────────────────
describe('Yoklama (attendance)', () => {
  it('yoklama alabilir (own)', () => {
    expectPermission(OGRETMEN_PERMISSIONS, 'attendance', 'create', 'own')
  })
  it('kendi yoklamalarını okuyabilir (own)', () => {
    expectPermission(OGRETMEN_PERMISSIONS, 'attendance', 'read', 'own')
  })
  it('kendi yoklamalarını güncelleyebilir (own)', () => {
    expectPermission(OGRETMEN_PERMISSIONS, 'attendance', 'update', 'own')
  })
  it('tüm okul yoklamalarını GÖREMEZ', () => {
    expectNoPermission(OGRETMEN_PERMISSIONS, 'attendance', 'delete')
  })
})

// ─── Müfredat izinleri ────────────────────────────────────────────────────────
describe('Müfredat (curriculum)', () => {
  it('kendi ilerlemesini oluşturabilir', () => {
    expectPermission(OGRETMEN_PERMISSIONS, 'curriculum', 'create', 'own')
  })
  it('okul geneli müfredatı okuyabilir', () => {
    expectPermission(OGRETMEN_PERMISSIONS, 'curriculum', 'read', 'school')
  })
  it('kendi ilerlemesini güncelleyebilir', () => {
    expectPermission(OGRETMEN_PERMISSIONS, 'curriculum', 'update', 'own')
  })
})

// ─── Öğrenci / Sınıf ─────────────────────────────────────────────────────────
describe('Öğrenci & Sınıf', () => {
  it('okul geneli öğrencileri okuyabilir', () => {
    expectPermission(OGRETMEN_PERMISSIONS, 'students', 'read', 'school')
  })
  it('öğrenci ekleyebilir', () => {
    expectPermission(OGRETMEN_PERMISSIONS, 'students', 'create', 'school')
  })
  it('sınıfları okuyabilir', () => {
    expectPermission(OGRETMEN_PERMISSIONS, 'classes', 'read', 'school')
  })
  it('sınıf OLUŞTURAMAZ', () => {
    expectNoPermission(OGRETMEN_PERMISSIONS, 'classes', 'create')
  })
  it('sınıf SİLEMEZ', () => {
    expectNoPermission(OGRETMEN_PERMISSIONS, 'classes', 'delete')
  })
})

// ─── Kişisel notlar ───────────────────────────────────────────────────────────
describe('Notlar', () => {
  it('not oluşturabilir (own)', () => {
    expectPermission(OGRETMEN_PERMISSIONS, 'notes', 'create', 'own')
  })
  it('kendi notlarını okuyabilir (own)', () => {
    expectPermission(OGRETMEN_PERMISSIONS, 'notes', 'read', 'own')
  })
  it('kendi notlarını güncelleyebilir', () => {
    expectPermission(OGRETMEN_PERMISSIONS, 'notes', 'update', 'own')
  })
  it('kendi notlarını silebilir', () => {
    expectPermission(OGRETMEN_PERMISSIONS, 'notes', 'delete', 'own')
  })
  it('başka öğretmenin notlarını OKUYAMAZ (school scope yok)', () => {
    const schoolRead = OGRETMEN_PERMISSIONS.find(
      p => p.resource === 'notes' && p.action === 'read' && p.scope === 'school'
    )
    expect(schoolRead).toBeUndefined()
  })
})

// ─── Yasak işlemler ───────────────────────────────────────────────────────────
describe('Yasak işlemler', () => {
  it('zümre OLUŞTURAMAZ', () => {
    expectNoPermission(OGRETMEN_PERMISSIONS, 'zumre', 'create')
  })
  it('sınav OLUŞTURAMAZ', () => {
    expectNoPermission(OGRETMEN_PERMISSIONS, 'exam', 'create')
  })
  it('kullanıcı YÖNETEMEz', () => {
    expectNoPermission(OGRETMEN_PERMISSIONS, 'users', 'manage')
  })
  it('kullanıcı OLUŞTURAMAZ', () => {
    expectNoPermission(OGRETMEN_PERMISSIONS, 'users', 'create')
  })
  it('okul ayarlarını GÜNCELLEYEMEz', () => {
    expectNoPermission(OGRETMEN_PERMISSIONS, 'school', 'update')
  })
})

// ─── PermissionService entegrasyonu ──────────────────────────────────────────
describe('PermissionService ile öğretmen kontrolü', () => {
  it('homework:create → true', async () => {
    expect(await PermissionService.check(U, S, 'homework', 'create')).toBe(true)
  })
  it('homework:update scope → own', async () => {
    expect(await PermissionService.getScope(U, S, 'homework', 'update')).toBe('own')
  })
  it('users:manage → false', async () => {
    expect(await PermissionService.check(U, S, 'users', 'manage')).toBe(false)
  })
  it('isAdmin() → false', async () => {
    expect(await PermissionService.isAdmin(U, S)).toBe(false)
  })
})
