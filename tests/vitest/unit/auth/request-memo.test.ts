import { describe, it, expect, vi, beforeEach } from 'vitest'

// Server action bağlamı: React render'ı yok → React.cache memoize etmez. Vitest de render dışında
// çalıştığı için action ile aynı koşulu verir. Regresyon: tek requireAbility() 5× auth.getUser +
// 3× profiles round-trip'i atıyordu (haftalık plan aksiyonlarının gecikme kök nedeni).
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('@/src/infrastructure/observability/logger', () => ({ securityLog: vi.fn(), logger: { error: vi.fn() } }))
vi.mock('@/src/domains/rbac/services/PermissionService', () => ({ PermissionService: { load: vi.fn() } }))

const getUser = vi.fn()
const profileSingle = vi.fn()
const from = vi.fn(() => ({ select: () => ({ eq: () => ({ single: profileSingle }) }) }))
vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}))

const { cookies } = await import('next/headers')
const { PermissionService } = await import('@/src/domains/rbac/services/PermissionService')
const { requireAbility } = await import('@/src/shared/authorization/server')
const { getCurrentProfile } = await import('@/src/shared/auth')

type CookieStore = Awaited<ReturnType<typeof cookies>>
const newRequest = () => vi.mocked(cookies).mockResolvedValue({} as CookieStore)

beforeEach(() => {
  vi.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  profileSingle.mockResolvedValue({ data: { id: 'u1', school_id: 's1', role: 'ogretmen', subject: 'Matematik', schools: null } })
  vi.mocked(PermissionService.load).mockResolvedValue([])
})

describe('auth istek-kapsamlı memo (server action bağlamı)', () => {
  it('tek istekte requireAbility + getCurrentProfile: getUser, profil ve izin birer kez okunur', async () => {
    newRequest()
    const ability = await requireAbility()
    await getCurrentProfile()

    expect(ability.userId).toBe('u1')
    expect(getUser).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledTimes(1)
    expect(PermissionService.load).toHaveBeenCalledTimes(1)
  })

  it('yeni istek (farklı cookie store) memo paylaşmaz — kullanıcı istekler arası sızmaz', async () => {
    newRequest()
    await getCurrentProfile()
    getUser.mockResolvedValue({ data: { user: { id: 'u2' } } })
    profileSingle.mockResolvedValue({ data: { id: 'u2', school_id: 's2', schools: null } })

    newRequest()
    const p = await getCurrentProfile()

    expect(p?.id).toBe('u2')
    expect(getUser).toHaveBeenCalledTimes(2)
  })
})
