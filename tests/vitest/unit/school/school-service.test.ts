import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS, MUDUR_PERMS } from '../../setup/factories'

vi.mock('@/src/shared/authorization/server', () => ({
  getAbility: vi.fn(),
}))

vi.mock('@/src/domains/school/repositories/SchoolRepository', () => ({
  SchoolRepository: {
    updateSchool: vi.fn(),
    findYoklamaAktif: vi.fn(),
    setYoklamaAktif: vi.fn(),
  },
}))
vi.mock('@/src/shared/auth', () => ({ getCurrentProfile: vi.fn() }))
vi.mock('@/src/infrastructure/observability/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

const { getAbility }        = await import('@/src/shared/authorization/server')
const { SchoolRepository }  = await import('@/src/domains/school/repositories/SchoolRepository')
const { SchoolService }     = await import('@/src/domains/school/services/SchoolService')
const { getCurrentProfile } = await import('@/src/shared/auth')

const SCHOOL_ID = 'school-service-unit'
const CALLER_ID = 'caller-unit'

function makeAbility(perms = MUDUR_PERMS) {
  return createAbility({ userId: CALLER_ID, schoolId: SCHOOL_ID, permissions: perms })
}

beforeEach(() => { vi.clearAllMocks() })

// ─────────────────────────────────────────────────────────────
describe('SchoolService.setupSchool()', () => {
  it('giriş yapılmamış → { error: "Yetki yok" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    expect((await SchoolService.setupSchool('Test Okul')).error).toBe('Yetki yok')
    expect(SchoolRepository.updateSchool).not.toHaveBeenCalled()
  })

  it('school:update izni yoksa → { error: "Yetki yok" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(OGRETMEN_PERMS) as never)
    expect((await SchoolService.setupSchool('Test Okul')).error).toBe('Yetki yok')
    expect(SchoolRepository.updateSchool).not.toHaveBeenCalled()
  })

  it('1 karakterlik isim → hata, updateSchool çağrılmaz', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const result = await SchoolService.setupSchool('A')
    expect(result.error).toContain('2 karakter')
    expect(SchoolRepository.updateSchool).not.toHaveBeenCalled()
  })

  it('200 karakterlik isim → kabul edilir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(SchoolRepository.updateSchool).mockResolvedValue({ error: null } as never)
    const result = await SchoolService.setupSchool('A'.repeat(200))
    expect(result.error).toBeUndefined()
  })

  it('201 karakterlik isim → { error: "çok uzun" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const result = await SchoolService.setupSchool('A'.repeat(201))
    expect(result.error).toContain('uzun')
  })

  it('başarılı kurulum → { redirect: "/anasayfa" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(SchoolRepository.updateSchool).mockResolvedValue({ error: null } as never)
    const result = await SchoolService.setupSchool('Atatürk İlkokulu')
    expect(result.error).toBeUndefined()
    expect(result.redirect).toBe('/anasayfa')
  })

  it('DB hatası varsa error döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(SchoolRepository.updateSchool).mockResolvedValue({
      error: { message: 'unique constraint' },
    } as never)
    expect((await SchoolService.setupSchool('Okul')).error).toBe('unique constraint')
  })

  it('TENANT: ability.schoolId doğru aktarılır (başka okul enjekte edilemez)', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(SchoolRepository.updateSchool).mockResolvedValue({ error: null } as never)
    await SchoolService.setupSchool('Okul Adı')
    expect(SchoolRepository.updateSchool).toHaveBeenCalledWith(SCHOOL_ID, expect.any(Object))
    // Başka bir school_id ile çağrılmadığını doğrula
    const callArgs = vi.mocked(SchoolRepository.updateSchool).mock.calls[0]
    expect(callArgs[0]).toBe(SCHOOL_ID)
  })

  it('oluşturulan kod [A-Z]{4}[0-9]{4} formatındadır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(SchoolRepository.updateSchool).mockResolvedValue({ error: null } as never)
    await SchoolService.setupSchool('Okul')
    const slugArg = vi.mocked(SchoolRepository.updateSchool).mock.calls[0][1] as Record<string, string>
    expect(slugArg.slug).toMatch(/^[A-Z]{4}\d{4}$/)
  })
})

// ─────────────────────────────────────────────────────────────
describe('SchoolService.updateSchoolSettings()', () => {
  it('giriş yapılmamış → { error: "Yetki yok" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    expect((await SchoolService.updateSchoolSettings('Okul')).error).toBe('Yetki yok')
  })

  it('school:update izni yoksa hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(OGRETMEN_PERMS) as never)
    expect((await SchoolService.updateSchoolSettings('Okul')).error).toBe('Yetki yok')
  })

  it('yetkili kullanıcı sadece name günceller (slug değişmez)', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(SchoolRepository.updateSchool).mockResolvedValue({ error: null } as never)
    const result = await SchoolService.updateSchoolSettings('Güncellendi')
    expect(result.error).toBeUndefined()
    expect(SchoolRepository.updateSchool).toHaveBeenCalledWith(SCHOOL_ID, { name: 'Güncellendi' })
  })
})

// ─────────────────────────────────────────────────────────────
describe('SchoolService.regenerateSchoolCode()', () => {
  it('giriş yapılmamış → { error: "Yetki yok" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    expect((await SchoolService.regenerateSchoolCode()).error).toBe('Yetki yok')
  })

  it('school:update izni yoksa hata döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(OGRETMEN_PERMS) as never)
    expect((await SchoolService.regenerateSchoolCode()).error).toBe('Yetki yok')
  })

  it('yetkili kullanıcı yeni kod üretir → { code: /^[A-Z]{4}\\d{4}$/ }', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(SchoolRepository.updateSchool).mockResolvedValue({ error: null } as never)
    const result = await SchoolService.regenerateSchoolCode()
    expect(result.error).toBeUndefined()
    expect(result.code).toMatch(/^[A-Z]{4}\d{4}$/)
  })

  it('TENANT: slug doğru school_id ile kaydedilir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(SchoolRepository.updateSchool).mockResolvedValue({ error: null } as never)
    await SchoolService.regenerateSchoolCode()
    expect(SchoolRepository.updateSchool).toHaveBeenCalledWith(SCHOOL_ID, expect.objectContaining({ slug: expect.any(String) }))
  })

  it('DB hatası varsa error döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(SchoolRepository.updateSchool).mockResolvedValue({
      error: { message: 'DB down' },
    } as never)
    expect((await SchoolService.regenerateSchoolCode()).error).toBe('DB down')
  })
})

// ─────────────────────────────────────────────────────────────
describe('SchoolService — yoklama anahtarı', () => {
  const profil = (role: string) => vi.mocked(getCurrentProfile).mockResolvedValue({ id: CALLER_ID, school_id: SCHOOL_ID, role } as never)

  it('yoklamaAktif: okuldaki değeri döner', async () => {
    vi.mocked(SchoolRepository.findYoklamaAktif).mockResolvedValue({ data: { yoklama_aktif: false }, error: null } as never)
    expect(await SchoolService.yoklamaAktif(SCHOOL_ID)).toBe(false)
  })

  it('yoklamaAktif: okuma hatasında AÇIK sayar (yanlışlıkla gizlemek yok) ve loglar', async () => {
    const { logger } = await import('@/src/infrastructure/observability/logger')
    vi.mocked(SchoolRepository.findYoklamaAktif).mockResolvedValue({ data: null, error: { message: 'x' } } as never)
    expect(await SchoolService.yoklamaAktif(SCHOOL_ID)).toBe(true)
    expect(logger.error).toHaveBeenCalled()
  })

  it.each(['ogretmen', 'zumre_baskani'])('setYoklamaAktif: %s → Yetki yok, RPC çağrılmaz', async rol => {
    profil(rol)
    expect(await SchoolService.setYoklamaAktif(false)).toEqual({ error: 'Yetki yok' })
    expect(SchoolRepository.setYoklamaAktif).not.toHaveBeenCalled()
  })

  it.each(['mudur', 'mudur_yardimcisi'])('setYoklamaAktif: %s → RPC çağrılır', async rol => {
    profil(rol)
    vi.mocked(SchoolRepository.setYoklamaAktif).mockResolvedValue({ error: null } as never)
    expect(await SchoolService.setYoklamaAktif(true)).toEqual({})
    expect(SchoolRepository.setYoklamaAktif).toHaveBeenCalledWith(true)
  })

  it('setYoklamaAktif: RPC hatası iletilir', async () => {
    profil('mudur')
    vi.mocked(SchoolRepository.setYoklamaAktif).mockResolvedValue({ error: { message: 'izin yok' } } as never)
    expect(await SchoolService.setYoklamaAktif(false)).toEqual({ error: 'izin yok' })
  })
})
