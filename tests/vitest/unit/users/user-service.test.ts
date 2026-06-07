import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS, MUDUR_PERMS, MUDUR_YARDIMCISI_PERMS } from '../../setup/factories'

vi.mock('@/src/shared/authorization/server', () => ({
  getAbility:     vi.fn(),
  requireAbility: vi.fn(),
}))

vi.mock('@/src/domains/users/repositories/UserRepository', () => ({
  UserRepository: {
    createAuthUser:  vi.fn(),
    adminSetProfile: vi.fn(),
    deleteAuthUser:  vi.fn(),
    getProfileById:  vi.fn(),
    assignRole:      vi.fn(),
    updateProfile:   vi.fn(),
  },
}))

const { getAbility, requireAbility } = await import('@/src/shared/authorization/server')
const { UserRepository }             = await import('@/src/domains/users/repositories/UserRepository')
const { UserService }                = await import('@/src/domains/users/services/UserService')

const SCHOOL_ID   = 'school-user-unit'
const CALLER_ID   = 'caller-unit'
const TARGET_ID   = 'target-unit'

function makeAbility(perms = OGRETMEN_PERMS, userId = CALLER_ID) {
  return createAbility({ userId, schoolId: SCHOOL_ID, permissions: perms })
}

function makeProfile(role: string) {
  return { data: { role, school_id: SCHOOL_ID }, error: null }
}

beforeEach(() => { vi.clearAllMocks() })

// ─────────────────────────────────────────────────────────────
describe('UserService.invite()', () => {
  const PARAMS = {
    email: 'yeni@test.com', full_name: 'Yeni Kişi', subject: 'Matematik', role: 'ogretmen' as const,
  }

  it('giriş yapılmamış → { error: "Giriş gerekli" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    expect((await UserService.invite(PARAMS)).error).toBe('Giriş gerekli')
    expect(UserRepository.createAuthUser).not.toHaveBeenCalled()
  })

  it('users:create izni yoksa hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    expect((await UserService.invite(PARAMS)).error).toBe('Yetki yok')
  })

  it('geçersiz e-posta → hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(MUDUR_YARDIMCISI_PERMS) as never)
    expect((await UserService.invite({ ...PARAMS, email: 'gecersiz' })).error).toContain('e-posta')
  })

  it('kısa isim → hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(MUDUR_YARDIMCISI_PERMS) as never)
    expect((await UserService.invite({ ...PARAMS, full_name: 'X' })).error).toContain('Ad soyad')
  })

  it('MY sadece ogretmen/zumre_baskani atayabilir, mudur_yardimcisi atayamaz', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(MUDUR_YARDIMCISI_PERMS) as never)
    expect(
      (await UserService.invite({ ...PARAMS, role: 'mudur_yardimcisi' as never })).error
    ).toBe('Bu rolü atayamazsınız')
  })

  it('müdür sadece mudur_yardimcisi atayabilir, ogretmen atayamaz', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(MUDUR_PERMS) as never)
    expect((await UserService.invite({ ...PARAMS, role: 'ogretmen' as never })).error).toBe('Bu rolü atayamazsınız')
  })

  it('müdür mudur_yardimcisi atayabilir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(MUDUR_PERMS) as never)
    vi.mocked(UserRepository.createAuthUser).mockResolvedValue({
      data: { user: { id: 'new-user-id' } }, error: null,
    } as never)
    vi.mocked(UserRepository.adminSetProfile).mockResolvedValue({ error: null } as never)
    const result = await UserService.invite({ ...PARAMS, role: 'mudur_yardimcisi' as never })
    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
  })

  it('createAuthUser hatası → error döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(MUDUR_YARDIMCISI_PERMS) as never)
    vi.mocked(UserRepository.createAuthUser).mockResolvedValue({
      data: null, error: { message: 'Sunucu hatası' },
    } as never)
    expect((await UserService.invite(PARAMS)).error).toBe('Sunucu hatası')
  })

  it('e-posta zaten kayıtlıysa özel hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(MUDUR_YARDIMCISI_PERMS) as never)
    vi.mocked(UserRepository.createAuthUser).mockResolvedValue({
      data: null, error: { message: 'User already been registered' },
    } as never)
    expect((await UserService.invite(PARAMS)).error).toBe('Bu e-posta zaten kayıtlı')
  })
})

// ─────────────────────────────────────────────────────────────
describe('UserService.deleteUser()', () => {
  it('giriş yapılmamış → { error: "Giriş gerekli" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    expect((await UserService.deleteUser(TARGET_ID)).error).toBe('Giriş gerekli')
  })

  it('users:delete izni yoksa hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    expect((await UserService.deleteUser(TARGET_ID)).error).toBe('Yetki yok')
  })

  it('hedef kullanıcı bulunamazsa hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(MUDUR_PERMS) as never)
    vi.mocked(UserRepository.getProfileById).mockResolvedValue({ data: null, error: null } as never)
    expect((await UserService.deleteUser(TARGET_ID)).error).toBe('Kullanıcı bulunamadı')
  })

  it('farklı okul kullanıcısı bulunamadı sayılır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(MUDUR_PERMS) as never)
    vi.mocked(UserRepository.getProfileById).mockResolvedValue({
      data: { role: 'ogretmen', school_id: 'baska-okul' }, error: null,
    } as never)
    expect((await UserService.deleteUser(TARGET_ID)).error).toBe('Kullanıcı bulunamadı')
  })

  it('mudur rolü silinemez', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(MUDUR_PERMS) as never)
    vi.mocked(UserRepository.getProfileById).mockResolvedValue(makeProfile('mudur') as never)
    expect((await UserService.deleteUser(TARGET_ID)).error).toBe('Müdür silinemez')
  })

  it('müdür (canManage) sadece mudur_yardimcisi silebilir, ogretmen silemez', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(MUDUR_PERMS) as never)
    vi.mocked(UserRepository.getProfileById).mockResolvedValue(makeProfile('ogretmen') as never)
    expect((await UserService.deleteUser(TARGET_ID)).error).toBe('Bu kullanıcıyı silemezsiniz')
  })

  it('MY sadece ogretmen/zumre_baskani silebilir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(MUDUR_YARDIMCISI_PERMS) as never)
    vi.mocked(UserRepository.getProfileById).mockResolvedValue(makeProfile('ogretmen') as never)
    vi.mocked(UserRepository.deleteAuthUser).mockResolvedValue({ error: null } as never)
    const result = await UserService.deleteUser(TARGET_ID)
    expect(result.error).toBeUndefined()
  })

  it('müdür mudur_yardimcisi silebilir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(MUDUR_PERMS) as never)
    vi.mocked(UserRepository.getProfileById).mockResolvedValue(makeProfile('mudur_yardimcisi') as never)
    vi.mocked(UserRepository.deleteAuthUser).mockResolvedValue({ error: null } as never)
    const result = await UserService.deleteUser(TARGET_ID)
    expect(result.error).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
describe('UserService.assignRole()', () => {
  beforeEach(() => {
    vi.mocked(UserRepository.assignRole).mockResolvedValue({ data: null, error: null } as never)
  })

  it('giriş yapılmamış → AuthorizationError fırlatır', async () => {
    vi.mocked(requireAbility).mockRejectedValue(new Error('Giriş gerekli'))
    await expect(UserService.assignRole(TARGET_ID, 'ogretmen')).rejects.toThrow()
  })

  it('users:update izni yoksa hata fırlatır', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility([]) as never)
    await expect(UserService.assignRole(TARGET_ID, 'ogretmen')).rejects.toThrow('Yetki yok')
  })

  it('kendi rolünü değiştiremez', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility(MUDUR_PERMS, CALLER_ID) as never)
    vi.mocked(UserRepository.getProfileById).mockResolvedValue(makeProfile('mudur') as never)
    await expect(UserService.assignRole(CALLER_ID, 'ogretmen')).rejects.toThrow('Kendi rolünüzü değiştiremezsiniz')
  })

  it('hedef bulunamazsa hata fırlatır', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility(MUDUR_PERMS) as never)
    vi.mocked(UserRepository.getProfileById).mockResolvedValue({ data: null, error: null } as never)
    await expect(UserService.assignRole(TARGET_ID, 'ogretmen')).rejects.toThrow('Kullanıcı bulunamadı')
  })

  it('müdür (canManage) sadece mudur_yardimcisi rolü atayabilir', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility(MUDUR_PERMS) as never)
    vi.mocked(UserRepository.getProfileById).mockResolvedValue(makeProfile('ogretmen') as never)
    await expect(UserService.assignRole(TARGET_ID, 'zumre_baskani')).rejects.toThrow('Bu rolü atayamazsınız')
  })

  it('müdür mudur_yardimcisi rolü atayabilir', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility(MUDUR_PERMS) as never)
    vi.mocked(UserRepository.getProfileById).mockResolvedValue(makeProfile('ogretmen') as never)
    await expect(UserService.assignRole(TARGET_ID, 'mudur_yardimcisi')).resolves.not.toThrow()
  })

  it('MY ogretmen→zumre_baskani atayabilir', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility(MUDUR_YARDIMCISI_PERMS) as never)
    vi.mocked(UserRepository.getProfileById).mockResolvedValue(makeProfile('ogretmen') as never)
    await expect(UserService.assignRole(TARGET_ID, 'zumre_baskani')).resolves.not.toThrow()
  })

  it('MY mudur_yardimcisi rolü atayamaz', async () => {
    vi.mocked(requireAbility).mockResolvedValue(makeAbility(MUDUR_YARDIMCISI_PERMS) as never)
    vi.mocked(UserRepository.getProfileById).mockResolvedValue(makeProfile('ogretmen') as never)
    await expect(UserService.assignRole(TARGET_ID, 'mudur_yardimcisi')).rejects.toThrow('Bu rolü atayamazsınız')
  })
})
