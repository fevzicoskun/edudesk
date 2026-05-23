import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeUser, makeProfile, type MockRole } from '../../setup/factories'

vi.mock('@/src/shared/auth', () => ({
  getCurrentUser:    vi.fn(),
  getCurrentProfile: vi.fn(),
  requireSchoolId:   vi.fn(),
}))

vi.mock('@/src/domains/tokens/repositories/TokenRepository', () => ({
  TokenRepository: {
    findStudentById:      vi.fn(),
    insertVeliToken:      vi.fn(),
    insertRevokedToken:   vi.fn(),
    findVeliTokenByJti:   vi.fn(),
    listActiveVeliTokens: vi.fn(),
    listRevokedByJtis:    vi.fn(),
    listRevokedTokens:    vi.fn(),
  },
}))

vi.mock('@/src/infrastructure/security/revocation', () => ({
  cacheRevocation: vi.fn(),
}))

vi.mock('@/src/infrastructure/tokens', () => ({
  createPublicToken: vi.fn(),
  extractJti:        vi.fn(),
}))

const { getCurrentUser, getCurrentProfile, requireSchoolId } =
  await import('@/src/shared/auth')
const { TokenRepository } =
  await import('@/src/domains/tokens/repositories/TokenRepository')
const { cacheRevocation } =
  await import('@/src/infrastructure/security/revocation')
const { extractJti } =
  await import('@/src/infrastructure/tokens')
const { TokenService } =
  await import('@/src/domains/tokens/services/TokenService')

const SCHOOL_ID = 'school-token-unit'

function setupAuth(role: MockRole) {
  const user    = makeUser(SCHOOL_ID)
  const profile = makeProfile(role, SCHOOL_ID)
  vi.mocked(getCurrentUser).mockResolvedValue(user as never)
  vi.mocked(getCurrentProfile).mockResolvedValue(profile as never)
  return { user, profile }
}

beforeEach(() => { vi.clearAllMocks() })

// ─────────────────────────────────────────────────────────────
describe('TokenService.revokeToken()', () => {
  it('giriş yapılmamış → { ok: false }', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    vi.mocked(getCurrentProfile).mockResolvedValue(null)
    const result = await TokenService.revokeToken('some-jti', 'veli')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Giriş gerekli')
  })

  it('v1. prefix ile extractJti null dönünce geçersiz format hatası', async () => {
    setupAuth('mudur')
    vi.mocked(extractJti).mockReturnValue(null as never)
    const result = await TokenService.revokeToken('v1.bozuk-token', 'veli')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Geçersiz token formatı')
  })

  it('öğretmen başkasının tokenını revoke edemez', async () => {
    const { user } = setupAuth('ogretmen')
    vi.mocked(TokenRepository.findVeliTokenByJti).mockResolvedValue({
      data: { issued_by: 'baska-ogretmen-id' }, error: null,
    } as never)
    const result = await TokenService.revokeToken('raw-jti-uuid', 'veli')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('yalnızca oluşturan kişi')
    expect(TokenRepository.insertRevokedToken).not.toHaveBeenCalled()
  })

  it('öğretmen kendi tokenını revoke edebilir', async () => {
    const { user } = setupAuth('ogretmen')
    vi.mocked(TokenRepository.findVeliTokenByJti).mockResolvedValue({
      data: { issued_by: user.id }, error: null,
    } as never)
    vi.mocked(TokenRepository.insertRevokedToken).mockResolvedValue({ error: null } as never)
    vi.mocked(cacheRevocation).mockResolvedValue(undefined)

    const result = await TokenService.revokeToken('raw-jti-uuid', 'veli')
    expect(result.ok).toBe(true)
    expect(cacheRevocation).toHaveBeenCalledWith('raw-jti-uuid', expect.any(String))
  })

  it('müdür herhangi bir tokenı revoke edebilir (findVeliTokenByJti çağrılmaz)', async () => {
    setupAuth('mudur')
    vi.mocked(TokenRepository.insertRevokedToken).mockResolvedValue({ error: null } as never)
    vi.mocked(cacheRevocation).mockResolvedValue(undefined)

    const result = await TokenService.revokeToken('raw-jti-uuid', 'veli')
    expect(result.ok).toBe(true)
    expect(TokenRepository.findVeliTokenByJti).not.toHaveBeenCalled()
  })

  it('zümre başkanı yönetici rol sayılır — token sahibi kontrolü atlanır', async () => {
    setupAuth('zumre_baskani')
    vi.mocked(TokenRepository.insertRevokedToken).mockResolvedValue({ error: null } as never)
    vi.mocked(cacheRevocation).mockResolvedValue(undefined)

    const result = await TokenService.revokeToken('raw-jti-uuid', 'veli')
    expect(result.ok).toBe(true)
    expect(TokenRepository.findVeliTokenByJti).not.toHaveBeenCalled()
  })

  it('zaten iptal edilmiş token → { ok: false, error: "Token zaten iptal edilmiş" }', async () => {
    setupAuth('mudur')
    vi.mocked(TokenRepository.insertRevokedToken).mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value' },
    } as never)

    const result = await TokenService.revokeToken('duplicate-jti', 'veli')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Token zaten iptal edilmiş')
  })

  it('başarılı revoke sonrası cacheRevocation çağrılır', async () => {
    setupAuth('mudur')
    vi.mocked(TokenRepository.insertRevokedToken).mockResolvedValue({ error: null } as never)
    vi.mocked(cacheRevocation).mockResolvedValue(undefined)

    await TokenService.revokeToken('cache-test-jti', 'veli', 'test sebebi')
    expect(cacheRevocation).toHaveBeenCalledOnce()
  })
})

// ─────────────────────────────────────────────────────────────
describe('TokenService.getActiveVeliTokens()', () => {
  it('hiç token yoksa boş dizi döner', async () => {
    vi.mocked(requireSchoolId).mockResolvedValue(SCHOOL_ID)
    vi.mocked(TokenRepository.listActiveVeliTokens).mockResolvedValue({
      data: [], error: null,
    } as never)

    const result = await TokenService.getActiveVeliTokens('student-id')
    expect(result).toEqual([])
    expect(TokenRepository.listRevokedByJtis).not.toHaveBeenCalled()
  })

  it('revoke edilmiş tokenlar sonuçtan çıkarılır', async () => {
    vi.mocked(requireSchoolId).mockResolvedValue(SCHOOL_ID)
    const tokens = [
      { jti: 'jti-active',  expires_at: '2099-01-01', created_at: '2026-01-01' },
      { jti: 'jti-revoked', expires_at: '2099-01-01', created_at: '2026-01-01' },
    ]
    vi.mocked(TokenRepository.listActiveVeliTokens).mockResolvedValue({
      data: tokens, error: null,
    } as never)
    vi.mocked(TokenRepository.listRevokedByJtis).mockResolvedValue({
      data: [{ jti: 'jti-revoked' }], error: null,
    } as never)

    const result = await TokenService.getActiveVeliTokens('student-id')
    expect(result).toHaveLength(1)
    expect(result[0].jti).toBe('jti-active')
  })

  it('tüm tokenlar revoke edilmişse boş dizi döner', async () => {
    vi.mocked(requireSchoolId).mockResolvedValue(SCHOOL_ID)
    const tokens = [{ jti: 'jti-a', expires_at: '2099-01-01', created_at: '2026-01-01' }]
    vi.mocked(TokenRepository.listActiveVeliTokens).mockResolvedValue({
      data: tokens, error: null,
    } as never)
    vi.mocked(TokenRepository.listRevokedByJtis).mockResolvedValue({
      data: [{ jti: 'jti-a' }], error: null,
    } as never)

    const result = await TokenService.getActiveVeliTokens('student-id')
    expect(result).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────
describe('TokenService.listRevokedTokens()', () => {
  it('öğretmen listeyemez — yetersiz yetki', async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(makeProfile('ogretmen', SCHOOL_ID) as never)
    const result = await TokenService.listRevokedTokens()
    expect(result.data).toBeNull()
    expect(result.error).toBe('Yetersiz yetki')
  })

  it('müdür listeleyebilir', async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(makeProfile('mudur', SCHOOL_ID) as never)
    vi.mocked(TokenRepository.listRevokedTokens).mockResolvedValue({
      data: [], error: null,
    } as never)
    const result = await TokenService.listRevokedTokens()
    expect(result.error).toBeUndefined()
    expect(TokenRepository.listRevokedTokens).toHaveBeenCalledOnce()
  })
})
