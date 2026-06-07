import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/auth/repositories/AuthRepository', () => ({
  AuthRepository: {
    signInWithPassword: vi.fn(),
    signOut:            vi.fn(),
    signUp:             vi.fn(),
    updateUser:         vi.fn(),
    getUser:            vi.fn(),
    findSchoolByCode:   vi.fn(),
    adminSetProfile:    vi.fn(),
  },
}))

vi.mock('@/src/infrastructure/observability/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}))

const { AuthRepository } = await import('@/src/domains/auth/repositories/AuthRepository')
const { AuthService }    = await import('@/src/domains/auth/services/AuthService')

beforeEach(() => vi.clearAllMocks())

// ─── signIn ─────────────────────────────────────────────────

describe('AuthService.signIn()', () => {
  it('yanlış şifre → kullanıcı dostu hata mesajı döner (raw hata sızdırmaz)', async () => {
    vi.mocked(AuthRepository.signInWithPassword).mockResolvedValue({
      error: { code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 },
      data: { user: null, session: null },
    } as never)

    const result = await AuthService.signIn('a@b.com', 'wrong')

    expect(result).toEqual({ error: 'E-posta veya şifre hatalı.' })
  })

  it('başarılı giriş → null döner', async () => {
    vi.mocked(AuthRepository.signInWithPassword).mockResolvedValue({
      error: null, data: { user: { id: 'u1' }, session: {} },
    } as never)

    const result = await AuthService.signIn('a@b.com', 'pass')

    expect(result).toBeNull()
  })
})

// ─── signUp ─────────────────────────────────────────────────

describe('AuthService.signUp()', () => {
  const BASE = {
    email: 'ogretmen@okul.edu.tr',
    password: 'sifre123',
    full_name: 'Ali Öğretmen',
    subject: 'Matematik',
    school_code: 'OKUL01',
  }

  it('geçersiz okul kodu → hata mesajı döner, signUp çağrılmaz', async () => {
    vi.mocked(AuthRepository.findSchoolByCode).mockResolvedValue({ data: null, error: null } as never)

    const result = await AuthService.signUp(BASE)

    expect(result).toEqual({ error: 'Geçersiz okul kodu. Müdürünüzden doğrulayın.' })
    expect(AuthRepository.signUp).not.toHaveBeenCalled()
  })

  it('geçerli okul kodu ama Supabase signUp hatası → hata mesajı döner', async () => {
    vi.mocked(AuthRepository.findSchoolByCode).mockResolvedValue({ data: { id: 'school-1' }, error: null } as never)
    vi.mocked(AuthRepository.signUp).mockResolvedValue({
      data: { user: null, session: null }, error: { message: 'Email already registered' },
    } as never)

    const result = await AuthService.signUp(BASE)

    expect(result).toEqual({ error: 'Email already registered' })
    expect(AuthRepository.adminSetProfile).not.toHaveBeenCalled()
  })

  it('signUp başarılı ama user null → genel hata döner', async () => {
    vi.mocked(AuthRepository.findSchoolByCode).mockResolvedValue({ data: { id: 'school-1' }, error: null } as never)
    vi.mocked(AuthRepository.signUp).mockResolvedValue({
      data: { user: null, session: null }, error: null,
    } as never)

    const result = await AuthService.signUp(BASE)

    expect(result).toEqual({ error: 'Kayıt başarısız, tekrar deneyin.' })
  })

  it('adminSetProfile hatası → hata mesajı döner', async () => {
    vi.mocked(AuthRepository.findSchoolByCode).mockResolvedValue({ data: { id: 'school-1' }, error: null } as never)
    vi.mocked(AuthRepository.signUp).mockResolvedValue({
      data: { user: { id: 'u-new' }, session: null }, error: null,
    } as never)
    vi.mocked(AuthRepository.adminSetProfile).mockResolvedValue({
      data: null, error: { code: 'P0001', message: 'Profil güncelleme hatası' },
    } as never)

    const result = await AuthService.signUp(BASE)

    expect(result?.error).toMatch(/Profil oluşturulamadı/)
  })

  it('session varsa (e-posta doğrulama gerekmez) → null döner (anasayfaya yönlendir)', async () => {
    vi.mocked(AuthRepository.findSchoolByCode).mockResolvedValue({ data: { id: 'school-1' }, error: null } as never)
    vi.mocked(AuthRepository.signUp).mockResolvedValue({
      data: { user: { id: 'u-new' }, session: { access_token: 'tok' } }, error: null,
    } as never)
    vi.mocked(AuthRepository.adminSetProfile).mockResolvedValue({ data: null, error: null } as never)

    const result = await AuthService.signUp(BASE)

    expect(result).toBeNull()
  })

  it('session yoksa (e-posta doğrulaması gerekiyor) → __registered__ döner', async () => {
    vi.mocked(AuthRepository.findSchoolByCode).mockResolvedValue({ data: { id: 'school-1' }, error: null } as never)
    vi.mocked(AuthRepository.signUp).mockResolvedValue({
      data: { user: { id: 'u-new' }, session: null }, error: null,
    } as never)
    vi.mocked(AuthRepository.adminSetProfile).mockResolvedValue({ data: null, error: null } as never)

    const result = await AuthService.signUp(BASE)

    expect(result).toEqual({ error: '__registered__' })
  })
})

// ─── updatePassword ──────────────────────────────────────────

describe('AuthService.updatePassword()', () => {
  it('giriş yapılmamışsa → error: Giriş gerekli', async () => {
    vi.mocked(AuthRepository.getUser).mockResolvedValue({ data: { user: null }, error: null } as never)

    const result = await AuthService.updatePassword('yeni123')

    expect(result).toEqual({ error: 'Giriş gerekli' })
    expect(AuthRepository.updateUser).not.toHaveBeenCalled()
  })

  it('başarılı şifre güncelleme → null döner', async () => {
    vi.mocked(AuthRepository.getUser).mockResolvedValue({ data: { user: { id: 'u1' } }, error: null } as never)
    vi.mocked(AuthRepository.updateUser).mockResolvedValue({ data: {}, error: null } as never)

    const result = await AuthService.updatePassword('yeniSifre123!')

    expect(result).toBeNull()
    expect(AuthRepository.updateUser).toHaveBeenCalledWith('yeniSifre123!')
  })
})
