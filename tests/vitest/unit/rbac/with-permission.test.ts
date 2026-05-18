import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OGRETMEN_PERMS, MUDUR_PERMS, makeUser, makeProfile } from '../../setup/factories'
import type { GrantedPermission } from '@/src/domains/rbac/types'

// ── Mock'lar ─────────────────────────────────────────────────
vi.mock('@/lib/auth', () => ({
  getCurrentUser:   vi.fn(),
  getCurrentProfile: vi.fn(),
  requireSchoolId:  vi.fn(),
  requirePermission: vi.fn(),
}))

vi.mock('@/src/domains/rbac/repositories/RbacRepository', () => ({
  RbacRepository: {
    getUserPermissions: vi.fn(),
  },
}))

const { getCurrentUser, getCurrentProfile, requireSchoolId } =
  await import('@/lib/auth')
const { RbacRepository } = await import('@/src/domains/rbac/repositories/RbacRepository')
const { withPermission, withAnyPermission, checkPermission } =
  await import('@/src/domains/rbac/middleware/withPermission')

const SCHOOL_ID = 'school-wp-test'
const testUser  = makeUser(SCHOOL_ID)

function setupAuth(role: 'ogretmen' | 'mudur', perms: GrantedPermission[]) {
  vi.mocked(getCurrentUser).mockResolvedValue(testUser as never)
  vi.mocked(getCurrentProfile).mockResolvedValue(makeProfile(role, SCHOOL_ID) as never)
  vi.mocked(requireSchoolId).mockResolvedValue(SCHOOL_ID)
  vi.mocked(RbacRepository.getUserPermissions).mockResolvedValue(perms)
}

beforeEach(() => vi.clearAllMocks())

// ─────────────────────────────────────────────────────────────
describe('withPermission()', () => {
  it('yetkili kullanıcı handler ctx ile çağırır', async () => {
    setupAuth('ogretmen', OGRETMEN_PERMS)
    const handler = vi.fn(async (_ctx: unknown) => 'başarılı')
    const action  = withPermission('homework', 'create', handler)

    const result = await action()
    expect(result).toBe('başarılı')
    expect(handler).toHaveBeenCalledOnce()

    const ctx = vi.mocked(handler).mock.calls[0][0] as { userId: string; schoolId: string; scope: string }
    expect(ctx.userId).toBe(testUser.id)
    expect(ctx.schoolId).toBe(SCHOOL_ID)
    expect(ctx.scope).toBe('own')  // öğretmenin homework:create scope'u 'own'
  })

  it('yetkisiz kullanıcı "Yetki yok" hatası alır', async () => {
    setupAuth('ogretmen', OGRETMEN_PERMS)
    const action = withPermission('users', 'manage', vi.fn())

    await expect(action()).rejects.toThrow('Yetki yok: users:manage')
  })

  it('giriş yapmamış kullanıcı "Giriş gerekli" hatası alır', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const action = withPermission('homework', 'create', vi.fn())

    await expect(action()).rejects.toThrow('Giriş gerekli')
  })

  it('müdür users:manage yapabilir, scope "school" döner', async () => {
    setupAuth('mudur', MUDUR_PERMS)
    const handler = vi.fn(async (_ctx: unknown) => 'ok')
    const action  = withPermission('users', 'manage', handler)

    await action()
    const ctx = vi.mocked(handler).mock.calls[0][0] as { scope: string }
    expect(ctx.scope).toBe('school')
  })

  it('handlera gecilen argümanlar iletilir', async () => {
    setupAuth('ogretmen', OGRETMEN_PERMS)
    const handler = vi.fn(async (_ctx: unknown, a: string, b: number) => `${a}:${b}`)
    const action  = withPermission('homework', 'create', handler)

    const result = await action('merhaba', 42)
    expect(result).toBe('merhaba:42')
  })
})

// ─────────────────────────────────────────────────────────────
describe('withAnyPermission()', () => {
  it('listeden herhangi biri yeterliyse geçer (OR mantığı)', async () => {
    setupAuth('ogretmen', OGRETMEN_PERMS)
    const handler = vi.fn(async () => 'ok')
    const action  = withAnyPermission(
      [{ resource: 'users', action: 'manage' }, { resource: 'homework', action: 'create' }],
      handler
    )

    // ogretmen users:manage yapamaz ama homework:create yapabilir → geçmeli
    await expect(action()).resolves.toBe('ok')
  })

  it('hiçbiri yoksa hata fırlatır', async () => {
    setupAuth('ogretmen', OGRETMEN_PERMS)
    const action = withAnyPermission(
      [{ resource: 'users', action: 'manage' }, { resource: 'school', action: 'update' }],
      vi.fn()
    )

    await expect(action()).rejects.toThrow('Yetki yok')
  })
})

// ─────────────────────────────────────────────────────────────
describe('checkPermission()', () => {
  it('izni olan kullanıcı için true döner', async () => {
    setupAuth('ogretmen', OGRETMEN_PERMS)
    expect(await checkPermission('homework', 'create')).toBe(true)
  })

  it('izni olmayan kullanıcı için false döner', async () => {
    setupAuth('ogretmen', OGRETMEN_PERMS)
    expect(await checkPermission('users', 'delete')).toBe(false)
  })

  it('giriş yapmamış kullanıcı için false döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    expect(await checkPermission('homework', 'create')).toBe(false)
  })
})
