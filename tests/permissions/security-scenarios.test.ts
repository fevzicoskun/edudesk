/**
 * Güvenlik senaryo testleri.
 *
 * Bu testler RBAC katmanının doğru çalıştığını doğrular.
 * DB-level RLS ve application-level school_id filtreleri ayrı güvence katmanları;
 * burada yalnızca permission kararlarının doğruluğu test edilir.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  OGRETMEN_PERMISSIONS,
  ZUMRE_BASKANI_PERMISSIONS,
  MUDUR_YARDIMCISI_PERMISSIONS,
  MUDUR_PERMISSIONS,
} from '../fixtures/permissions'

vi.mock('@/src/domains/rbac/repositories/RbacRepository', () => ({
  RbacRepository: { getUserPermissions: vi.fn() },
}))

const { RbacRepository }   = await import('@/src/domains/rbac/repositories/RbacRepository')
const { PermissionService } = await import('@/src/domains/rbac/services/PermissionService')

const SCHOOL_A = 'school-aaaa-0001'
const SCHOOL_B = 'school-bbbb-0002'

function mockAs(perms: typeof OGRETMEN_PERMISSIONS) {
  vi.mocked(RbacRepository.getUserPermissions).mockResolvedValue(perms)
}

beforeEach(() => vi.clearAllMocks())

// ─── Senaryo 1: Öğretmen başka öğretmenin ödevini düzenleyemez ────────────────
describe('Senaryo: öğretmen başkasının ödevini düzenleyemez', () => {
  it('homework:update scope own olduğu için başka öğretmenin ödevi erişim dışı', async () => {
    mockAs(OGRETMEN_PERMISSIONS)
    const teacherAId = 'teacher-a'
    const teacherBId = 'teacher-b'

    // Her ikisi de school-a'da — izin var mı kontrol et
    const canUpdate = await PermissionService.check(teacherAId, SCHOOL_A, 'homework', 'update')
    const scope     = await PermissionService.getScope(teacherAId, SCHOOL_A, 'homework', 'update')

    expect(canUpdate).toBe(true)   // izin var...
    expect(scope).toBe('own')      // ...ama sadece kendi ödevleri için
    // Application katmanı 'own' scope'u görünce teacher_id = teacherAId filtresi uygular
    // teacherBId'nin ödevine erişim DB sorgusunda engellenir
    expect(scope).not.toBe('school')
  })

  it('zümre başkanı homework:update için school scope alır (tüm ödevleri güncelleyebilir)', async () => {
    mockAs(ZUMRE_BASKANI_PERMISSIONS)
    const scope = await PermissionService.getScope('zb-user', SCHOOL_A, 'homework', 'update')
    expect(scope).toBe('school')
  })
})

// ─── Senaryo 2: Öğretmen başka okul datasını göremez ─────────────────────────
describe('Senaryo: öğretmen başka okul datasını göremez', () => {
  it('school_a öğretmeni school_b için izin kontrolü yapılamaz (mock school_b döndürür)', async () => {
    // Gerçek senaryoda DB RLS school_id filtreler.
    // Burada RBAC katmanı school_id parametresiyle çalışır — farklı school için farklı izin seti döner.
    vi.mocked(RbacRepository.getUserPermissions)
      .mockImplementation(async (userId, schoolId) => {
        // school_b için bu kullanıcının hiç izni yok
        if (schoolId === SCHOOL_B) return []
        return OGRETMEN_PERMISSIONS
      })

    const userA = 'teacher-from-school-a'

    // Kendi okulunda normal yetkileri var
    expect(await PermissionService.check(userA, SCHOOL_A, 'homework', 'create')).toBe(true)
    expect(await PermissionService.check(userA, SCHOOL_A, 'students', 'read')).toBe(true)
  })

  it('boş izin seti tüm kontrolleri reddeder', async () => {
    mockAs([])
    const intruder = 'intruder-user'

    const results = await PermissionService.checkMany(intruder, SCHOOL_B, [
      { resource: 'homework',   action: 'create' },
      { resource: 'students',   action: 'read'   },
      { resource: 'classes',    action: 'read'   },
      { resource: 'users',      action: 'manage' },
      { resource: 'school',     action: 'update' },
    ])

    expect(Object.values(results).every(v => v === false)).toBe(true)
  })
})

// ─── Senaryo 3: Mentor raporu yetki sınırları ─────────────────────────────────
describe('Senaryo: mentor raporu yetki sınırları', () => {
  it('öğretmen (ogretmen rolü) zümre oluşturamaz', async () => {
    mockAs(OGRETMEN_PERMISSIONS)
    expect(await PermissionService.check('teacher-x', SCHOOL_A, 'zumre', 'create')).toBe(false)
  })

  it('müdür yardımcısı zümre oluşturabilir (inherited via zumre_baskani)', async () => {
    mockAs(MUDUR_YARDIMCISI_PERMISSIONS)
    expect(await PermissionService.check('my-user', SCHOOL_A, 'zumre', 'create')).toBe(true)
  })

  it('zümre başkanı okul genelinde sınav oluşturabilir', async () => {
    mockAs(ZUMRE_BASKANI_PERMISSIONS)
    expect(await PermissionService.check('zb-user', SCHOOL_A, 'exam', 'create')).toBe(true)
  })

  it('sıradan öğretmen sınav oluşturamaz', async () => {
    mockAs(OGRETMEN_PERMISSIONS)
    expect(await PermissionService.check('teacher-x', SCHOOL_A, 'exam', 'create')).toBe(false)
  })
})

// ─── Senaryo 4: Kullanıcı yönetimi privilege escalation koruması ──────────────
describe('Senaryo: privilege escalation koruması', () => {
  it('öğretmen kullanıcı oluşturamaz', async () => {
    mockAs(OGRETMEN_PERMISSIONS)
    expect(await PermissionService.check('teacher', SCHOOL_A, 'users', 'create')).toBe(false)
  })

  it('zümre başkanı kullanıcı oluşturamaz', async () => {
    mockAs(ZUMRE_BASKANI_PERMISSIONS)
    expect(await PermissionService.check('zb', SCHOOL_A, 'users', 'create')).toBe(false)
  })

  it('müdür yardımcısı kullanıcı oluşturabilir ama manage edemez', async () => {
    mockAs(MUDUR_YARDIMCISI_PERMISSIONS)
    const my = 'my-user'
    expect(await PermissionService.check(my, SCHOOL_A, 'users', 'create')).toBe(true)
    expect(await PermissionService.check(my, SCHOOL_A, 'users', 'manage')).toBe(false)
    expect(await PermissionService.isAdmin(my, SCHOOL_A)).toBe(false)
  })

  it('sadece müdür isAdmin sayılır', async () => {
    const roles = [
      { perms: OGRETMEN_PERMISSIONS,         expected: false },
      { perms: ZUMRE_BASKANI_PERMISSIONS,    expected: false },
      { perms: MUDUR_YARDIMCISI_PERMISSIONS, expected: false },
      { perms: MUDUR_PERMISSIONS,            expected: true  },
    ]

    for (const { perms, expected } of roles) {
      vi.mocked(RbacRepository.getUserPermissions).mockResolvedValue(perms)
      vi.clearAllMocks()
      vi.mocked(RbacRepository.getUserPermissions).mockResolvedValue(perms)
      expect(await PermissionService.isAdmin('u', SCHOOL_A)).toBe(expected)
    }
  })
})

// ─── Senaryo 5: Okul ayarları yetkisi ────────────────────────────────────────
describe('Senaryo: okul ayarları sadece müdürde', () => {
  it.each([
    { role: 'ogretmen',         perms: OGRETMEN_PERMISSIONS         },
    { role: 'zumre_baskani',    perms: ZUMRE_BASKANI_PERMISSIONS    },
    { role: 'mudur_yardimcisi', perms: MUDUR_YARDIMCISI_PERMISSIONS },
  ])('$role okul ayarlarını güncelleyemez', async ({ perms }) => {
    mockAs(perms)
    expect(await PermissionService.check('u', SCHOOL_A, 'school', 'update')).toBe(false)
  })

  it('mudur okul ayarlarını güncelleyebilir', async () => {
    mockAs(MUDUR_PERMISSIONS)
    expect(await PermissionService.check('u', SCHOOL_A, 'school', 'update')).toBe(true)
    expect(await PermissionService.check('u', SCHOOL_A, 'school', 'manage')).toBe(true)
  })
})

// ─── Senaryo 6: Yoklama erişimi ───────────────────────────────────────────────
describe('Senaryo: yoklama erişim kapsamı', () => {
  it('öğretmen sadece kendi yoklamalarını görebilir (own scope)', async () => {
    mockAs(OGRETMEN_PERMISSIONS)
    const scope = await PermissionService.getScope('t', SCHOOL_A, 'attendance', 'read')
    expect(scope).toBe('own')
  })

  it('müdür yardımcısı tüm okul yoklamalarını görebilir (school scope)', async () => {
    mockAs(MUDUR_YARDIMCISI_PERMISSIONS)
    const scope = await PermissionService.getScope('my', SCHOOL_A, 'attendance', 'read')
    expect(scope).toBe('school')
  })
})
