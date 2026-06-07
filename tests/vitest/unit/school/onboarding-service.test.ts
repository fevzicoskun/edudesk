import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/shared/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/src/domains/school/repositories/SchoolRepository', () => ({
  SchoolRepository: {
    findProfileSchool:  vi.fn(),
    insertSchool:       vi.fn(),
    adminOnboardUser:   vi.fn(),
    findSchoolBySlug:   vi.fn(),
  },
}))

vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn(),
}))

const { getCurrentUser }    = await import('@/src/shared/auth')
const { SchoolRepository }  = await import('@/src/domains/school/repositories/SchoolRepository')
const { OnboardingService } = await import('@/src/domains/school/services/OnboardingService')
const { createClient }      = await import('@/src/infrastructure/supabase/server')

const USER_ID   = 'user-onboard-test'
const SCHOOL_ID = 'school-onboard-test'

function makeDb() {
  const db = { auth: { updateUser: vi.fn().mockResolvedValue({}) } }
  vi.mocked(createClient).mockResolvedValue(db as never)
  return db
}

beforeEach(() => vi.clearAllMocks())

// ─── setupSchool ─────────────────────────────────────────────

describe('OnboardingService.setupSchool()', () => {
  it('giriş yapılmamışsa → throws Giriş gerekli', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    await expect(OnboardingService.setupSchool('Test Okulu'))
      .rejects.toThrow('Giriş gerekli')
  })

  it('kullanıcının zaten okulu varsa → redirect, insertSchool çağrılmaz', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: USER_ID } as never)
    vi.mocked(SchoolRepository.findProfileSchool).mockResolvedValue({
      data: { school_id: SCHOOL_ID }, error: null,
    } as never)

    const result = await OnboardingService.setupSchool('Test Okulu')

    expect(result).toMatchObject({ redirect: '/anasayfa' })
    expect(SchoolRepository.insertSchool).not.toHaveBeenCalled()
  })

  it('insertSchool DB hatası → { error: mesaj }', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: USER_ID } as never)
    vi.mocked(SchoolRepository.findProfileSchool).mockResolvedValue({
      data: null, error: null,
    } as never)
    vi.mocked(SchoolRepository.insertSchool).mockResolvedValue({
      data: null, error: { message: 'unique constraint' },
    } as never)

    const result = await OnboardingService.setupSchool('Test Okulu')

    expect(result).toEqual({ error: 'unique constraint' })
    expect(SchoolRepository.adminOnboardUser).not.toHaveBeenCalled()
  })

  it('insertSchool null data (no error) → { error: Okul oluşturulamadı }', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: USER_ID } as never)
    vi.mocked(SchoolRepository.findProfileSchool).mockResolvedValue({
      data: null, error: null,
    } as never)
    vi.mocked(SchoolRepository.insertSchool).mockResolvedValue({
      data: null, error: null,
    } as never)

    const result = await OnboardingService.setupSchool('Test Okulu')

    expect(result).toEqual({ error: 'Okul oluşturulamadı' })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('adminOnboardUser hatası → { error: mesaj }, createClient çağrılmaz', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: USER_ID } as never)
    vi.mocked(SchoolRepository.findProfileSchool).mockResolvedValue({
      data: null, error: null,
    } as never)
    vi.mocked(SchoolRepository.insertSchool).mockResolvedValue({
      data: { id: SCHOOL_ID }, error: null,
    } as never)
    vi.mocked(SchoolRepository.adminOnboardUser).mockResolvedValue({
      data: null, error: { message: 'RPC hatası' },
    } as never)

    const result = await OnboardingService.setupSchool('Test Okulu')

    expect(result).toEqual({ error: 'RPC hatası' })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('başarılı → updateUser school_id ile çağrılır, {} döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: USER_ID } as never)
    vi.mocked(SchoolRepository.findProfileSchool).mockResolvedValue({
      data: null, error: null,
    } as never)
    vi.mocked(SchoolRepository.insertSchool).mockResolvedValue({
      data: { id: SCHOOL_ID }, error: null,
    } as never)
    vi.mocked(SchoolRepository.adminOnboardUser).mockResolvedValue({
      data: null, error: null,
    } as never)
    const db = makeDb()

    const result = await OnboardingService.setupSchool('Test Okulu')

    expect(result).toEqual({})
    expect(db.auth.updateUser).toHaveBeenCalledWith(
      expect.objectContaining({ data: { school_id: SCHOOL_ID } })
    )
  })
})

// ─── joinSchool ─────────────────────────────────────────────

describe('OnboardingService.joinSchool()', () => {
  it('giriş yapılmamışsa → throws Giriş gerekli', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    await expect(OnboardingService.joinSchool('ABCD1234'))
      .rejects.toThrow('Giriş gerekli')
  })

  it('kullanıcının zaten okulu varsa → redirect, findSchoolBySlug çağrılmaz', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: USER_ID } as never)
    vi.mocked(SchoolRepository.findProfileSchool).mockResolvedValue({
      data: { school_id: SCHOOL_ID }, error: null,
    } as never)

    const result = await OnboardingService.joinSchool('ABCD1234')

    expect(result).toMatchObject({ redirect: '/anasayfa' })
    expect(SchoolRepository.findSchoolBySlug).not.toHaveBeenCalled()
  })

  it('okul bulunamazsa → { error: Bu kod ile... }', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: USER_ID } as never)
    vi.mocked(SchoolRepository.findProfileSchool).mockResolvedValue({
      data: null, error: null,
    } as never)
    vi.mocked(SchoolRepository.findSchoolBySlug).mockResolvedValue({
      data: [], error: null,
    } as never)

    const result = await OnboardingService.joinSchool('WXYZ9999')

    expect(result.error).toMatch(/Bu kod ile/)
    expect(SchoolRepository.adminOnboardUser).not.toHaveBeenCalled()
  })

  it('adminOnboardUser hatası → { error: mesaj }', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: USER_ID } as never)
    vi.mocked(SchoolRepository.findProfileSchool).mockResolvedValue({
      data: null, error: null,
    } as never)
    vi.mocked(SchoolRepository.findSchoolBySlug).mockResolvedValue({
      data: [{ id: SCHOOL_ID }], error: null,
    } as never)
    vi.mocked(SchoolRepository.adminOnboardUser).mockResolvedValue({
      data: null, error: { message: 'RPC bağlantı hatası' },
    } as never)

    const result = await OnboardingService.joinSchool('ABCD1234')

    expect(result).toEqual({ error: 'RPC bağlantı hatası' })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('başarılı → updateUser school_id ile çağrılır, {} döner', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: USER_ID } as never)
    vi.mocked(SchoolRepository.findProfileSchool).mockResolvedValue({
      data: null, error: null,
    } as never)
    vi.mocked(SchoolRepository.findSchoolBySlug).mockResolvedValue({
      data: [{ id: SCHOOL_ID }], error: null,
    } as never)
    vi.mocked(SchoolRepository.adminOnboardUser).mockResolvedValue({
      data: null, error: null,
    } as never)
    const db = makeDb()

    const result = await OnboardingService.joinSchool('ABCD1234')

    expect(result).toEqual({})
    expect(db.auth.updateUser).toHaveBeenCalledWith(
      expect.objectContaining({ data: { school_id: SCHOOL_ID } })
    )
  })
})
