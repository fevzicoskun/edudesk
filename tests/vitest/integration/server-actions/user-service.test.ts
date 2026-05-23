/**
 * UserService RBAC entegrasyon testleri.
 * users:create / users:delete / users:manage izin hiyerarşisini test eder.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  serviceDb,
  createTestSchool,
  createTestUser,
  cleanupTestData,
  type TestSchool,
  type TestUser,
} from '../../setup/db'
import { makeUser, OGRETMEN_PERMS, MUDUR_PERMS, MUDUR_YARDIMCISI_PERMS } from '../../setup/factories'
import type { GrantedPermission } from '@/src/domains/rbac/types'

// ── Mock'lar ──────────────────────────────────────────────────
vi.mock('@/src/shared/auth', () => ({
  getCurrentUser:        vi.fn(),
  getCurrentProfile:     vi.fn(),
  getCurrentPermissions: vi.fn(),
  requireSchoolId:       vi.fn(),
}))
vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(serviceDb),
}))
vi.mock('@/src/domains/rbac/repositories/RbacRepository', () => ({
  RbacRepository: { getUserPermissions: vi.fn() },
}))

const { getCurrentUser, getCurrentProfile, getCurrentPermissions, requireSchoolId } =
  await import('@/src/shared/auth')
const { RbacRepository }  = await import('@/src/domains/rbac/repositories/RbacRepository')
const { UserService }     = await import('@/src/domains/users/services/UserService')
const { UserRepository }  = await import('@/src/domains/users/repositories/UserRepository')

// ── Test fixture ──────────────────────────────────────────────
let school:         TestSchool
let callerUser:     TestUser
let targetOgretmen: TestUser
const createdUserIds: string[] = []

beforeAll(async () => {
  school         = await createTestSchool('_US')
  callerUser     = await createTestUser({ role: 'mudur',    schoolId: school.id })
  targetOgretmen = await createTestUser({ role: 'ogretmen', schoolId: school.id })
})

afterAll(async () => {
  await cleanupTestData({
    userIds:  [callerUser.id, targetOgretmen.id, ...createdUserIds],
    schoolIds: [school.id],
  })
})

function setupCaller(perms: GrantedPermission[], role = 'mudur') {
  const user = { ...makeUser(school.id), id: callerUser.id }
  const profile = { full_name: 'Caller', subject: 'X', role, school_id: school.id, schools: null }
  vi.mocked(getCurrentUser).mockResolvedValue(user as never)
  vi.mocked(getCurrentProfile).mockResolvedValue(profile as never)
  vi.mocked(getCurrentPermissions).mockResolvedValue(perms as never)
  vi.mocked(requireSchoolId).mockResolvedValue(school.id)
  vi.mocked(RbacRepository.getUserPermissions).mockResolvedValue(perms)
}

beforeEach(() => vi.clearAllMocks())

// ─────────────────────────────────────────────────────────────
describe('UserService.invite()', () => {
  it('users:create izni olan kullanıcı öğretmen davet edebilir', async () => {
    setupCaller(MUDUR_YARDIMCISI_PERMS, 'mudur_yardimcisi')
    const result = await UserService.invite({
      email:     `invite_test_${Date.now()}@test.example`,
      full_name: 'Yeni Öğretmen',
      subject:   'Fizik',
      role:      'ogretmen',
    })
    if (result.success && 'tempPassword' in result) {
      // Oluşturulan kullanıcıyı temizlik listesine ekle
      // email'den user bul
      const { data: p } = await serviceDb
        .from('profiles')
        .select('id')
        .eq('school_id', school.id)
        .ilike('full_name', 'Yeni Öğretmen')
        .maybeSingle()
      if (p?.id) createdUserIds.push(p.id)
    }
    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
  })

  it('users:create izni olmayan kullanıcı davet edemez', async () => {
    setupCaller(OGRETMEN_PERMS, 'ogretmen')
    const result = await UserService.invite({
      email:     `blocked_${Date.now()}@test.example`,
      full_name: 'Engellenen Davet',
      subject:   'X',
      role:      'ogretmen',
    })
    expect(result.error).toBeTruthy()
  })

  it('müdür yardımcısı mudur_yardimcisi rolü atayamaz (manage izni yok)', async () => {
    setupCaller(MUDUR_YARDIMCISI_PERMS, 'mudur_yardimcisi')
    const result = await UserService.invite({
      email:     `restricted_${Date.now()}@test.example`,
      full_name: 'Kısıtlı Davet',
      subject:   'X',
      role:      'mudur_yardimcisi',  // müdür yardımcısı bu rolü atayamaz
    })
    expect(result.error).toBeTruthy()
  })

  it('müdür mudur_yardimcisi rolü atayabilir', async () => {
    setupCaller(MUDUR_PERMS, 'mudur')
    const result = await UserService.invite({
      email:     `mudur_yrd_${Date.now()}@test.example`,
      full_name: 'Yeni Müdür Yardımcısı',
      subject:   'İdare',
      role:      'mudur_yardimcisi',
    })
    if (result.success) {
      const { data: p } = await serviceDb
        .from('profiles').select('id')
        .eq('school_id', school.id).ilike('full_name', 'Yeni Müdür Yardımcısı')
        .maybeSingle()
      if (p?.id) createdUserIds.push(p.id)
    }
    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
describe('UserService.deleteUser()', () => {
  it('mudur_yardimcisi öğretmeni silebilir', async () => {
    // Müdür sadece MY silebilir; MY ise ogretmen/zumre_baskani silebilir
    setupCaller(MUDUR_YARDIMCISI_PERMS, 'mudur_yardimcisi')
    const tmp = await createTestUser({ role: 'ogretmen', schoolId: school.id, suffix: '_del' })
    const result = await UserService.deleteUser(tmp.id)
    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
  })

  it('users:delete izni olmayan kullanıcı silemez', async () => {
    setupCaller(OGRETMEN_PERMS, 'ogretmen')
    const result = await UserService.deleteUser(targetOgretmen.id)
    expect(result.error).toBeTruthy()
  })

  it('müdür kendini silemez', async () => {
    setupCaller(MUDUR_PERMS, 'mudur')
    // Müdürün kendi profilini silmeye çalışması — mudur rolü korumalı
    const { data: mudurProfile } = await serviceDb
      .from('profiles').select('role').eq('id', callerUser.id).single()
    expect(mudurProfile?.role).toBe('mudur')
    // mudur rolündeki kişiyi silmeye çalış
    const result = await UserService.deleteUser(callerUser.id)
    // Müdür kendini silemez (school_id eşleşmez veya mudur koruması)
    expect(result.error).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────
describe('UserService.assignRole()', () => {
  // assign_user_role RPC auth.uid() kullandığından service client ile çağrılamaz.
  // Repo katmanını spy ile mock'layıp UserService'in izin mantığını test ediyoruz.
  beforeEach(() => {
    vi.spyOn(UserRepository, 'assignRole').mockResolvedValue({ data: null, error: null } as never)
    vi.spyOn(UserRepository, 'getProfileById').mockResolvedValue({
      data: { role: 'ogretmen', school_id: school.id }, error: null,
    } as never)
  })

  it('mudur_yardimcisi ogretmeni zumre_baskani yapabilir', async () => {
    // MY: canManage=false → ogretmen/zumre_baskani arasında atama yapabilir
    setupCaller(MUDUR_YARDIMCISI_PERMS, 'mudur_yardimcisi')
    await expect(
      UserService.assignRole(targetOgretmen.id, 'zumre_baskani')
    ).resolves.not.toThrow()
  })

  it('kendi rolünü değiştiremez', async () => {
    setupCaller(MUDUR_PERMS, 'mudur')
    await expect(
      UserService.assignRole(callerUser.id, 'ogretmen')
    ).rejects.toThrow('Kendi rolünüzü değiştiremezsiniz')
  })

  it('users:update izni olmayan kullanıcı rol atayamaz', async () => {
    setupCaller(OGRETMEN_PERMS, 'ogretmen')
    await expect(
      UserService.assignRole(targetOgretmen.id, 'zumre_baskani')
    ).rejects.toThrow()
  })
})
