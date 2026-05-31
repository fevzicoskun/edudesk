import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS, MUDUR_PERMS } from '../../setup/factories'
import type { GrantedPermission } from '@/src/domains/rbac/types'

vi.mock('@/src/shared/authorization/server', () => ({
  getAbility: vi.fn(),
}))

vi.mock('@/src/domains/kanaat/repositories/KanaatRepository', () => ({
  KanaatRepository: {
    findByClassAndDonem: vi.fn(),
    upsertMany:          vi.fn(),
    findAllByClass:      vi.fn(),
  },
}))

// Supabase client mock — generateKanaat içindeki doğrudan sorgular için
vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn(),
}))

const { getAbility }         = await import('@/src/shared/authorization/server')
const { KanaatRepository }   = await import('@/src/domains/kanaat/repositories/KanaatRepository')
const { KanaatService }      = await import('@/src/domains/kanaat/services/KanaatService')
const { createClient }       = await import('@/src/infrastructure/supabase/server')

const SCHOOL_ID  = 'school-kanaat-unit'
const TEACHER_ID = 'teacher-kanaat-unit'
const CLASS_ID   = 'class-kanaat-unit'
const DONEM      = '2025-2026-1'

function makeAbility(perms: GrantedPermission[] = OGRETMEN_PERMS, userId = TEACHER_ID) {
  return createAbility({ userId, schoolId: SCHOOL_ID, permissions: perms })
}

beforeEach(() => { vi.clearAllMocks() })

// ── getKanaatKayitlari ────────────────────────────────────────
describe('KanaatService.getKanaatKayitlari()', () => {
  it('giriş yoksa → error', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const r = await KanaatService.getKanaatKayitlari(CLASS_ID, DONEM)
    expect(r.error).toBe('Giriş gerekli')
    expect(KanaatRepository.findByClassAndDonem).not.toHaveBeenCalled()
  })

  it('kanaat:read izni yoksa → error', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    const r = await KanaatService.getKanaatKayitlari(CLASS_ID, DONEM)
    expect(r.error).toBe('Bu işlem için yetkiniz yok.')
  })

  it('yetki varsa kayıtlar döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(KanaatRepository.findByClassAndDonem).mockResolvedValue({
      data: [], error: null,
    } as never)
    const r = await KanaatService.getKanaatKayitlari(CLASS_ID, DONEM)
    expect(r.error).toBeUndefined()
    expect(r.data).toEqual([])
    expect(KanaatRepository.findByClassAndDonem).toHaveBeenCalledWith(CLASS_ID, DONEM, SCHOOL_ID)
  })
})

// ── saveKanaatKayitlari ──────────────────────────────────────
describe('KanaatService.saveKanaatKayitlari()', () => {
  const kayitlar = [
    { studentId: 'stu-1', score: 4 as const, text: 'Ali iyi bir dönem geçirdi.' },
  ]

  it('giriş yoksa → error', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const r = await KanaatService.saveKanaatKayitlari(CLASS_ID, DONEM, kayitlar)
    expect(r.error).toBe('Giriş gerekli')
    expect(KanaatRepository.upsertMany).not.toHaveBeenCalled()
  })

  it('kanaat:create izni yoksa → error', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    const r = await KanaatService.saveKanaatKayitlari(CLASS_ID, DONEM, kayitlar)
    expect(r.error).toBe('Bu işlem için yetkiniz yok.')
    expect(KanaatRepository.upsertMany).not.toHaveBeenCalled()
  })

  it('yetki varsa kayıtlar upsert edilir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(KanaatRepository.upsertMany).mockResolvedValue({ error: null } as never)
    const r = await KanaatService.saveKanaatKayitlari(CLASS_ID, DONEM, kayitlar)
    expect(r.error).toBeUndefined()
    expect(KanaatRepository.upsertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          student_id: 'stu-1',
          class_id:   CLASS_ID,
          teacher_id: TEACHER_ID,
          school_id:  SCHOOL_ID,
          score:      4,
          text:       'Ali iyi bir dönem geçirdi.',
          donem:      DONEM,
        }),
      ])
    )
  })

  it('DB hatası varsa error döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(KanaatRepository.upsertMany).mockResolvedValue({
      error: { message: 'duplicate key' },
    } as never)
    const r = await KanaatService.saveKanaatKayitlari(CLASS_ID, DONEM, kayitlar)
    expect(r.error).toBeDefined()
  })
})

// ── generateKanaatHesap ──────────────────────────────────────
describe('KanaatService.generateKanaatHesap()', () => {
  it('giriş yoksa → error', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const r = await KanaatService.generateKanaatHesap(CLASS_ID, DONEM)
    expect(r.error).toBe('Giriş gerekli')
  })

  it('kanaat:create izni yoksa → error', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    const r = await KanaatService.generateKanaatHesap(CLASS_ID, DONEM)
    expect(r.error).toBe('Bu işlem için yetkiniz yok.')
  })

  it('öğrenci yoksa → boş dizi döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        is:     vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    const r = await KanaatService.generateKanaatHesap(CLASS_ID, DONEM)
    expect(r.error).toBeUndefined()
    expect(r.data).toEqual([])
  })

  it('DB hatası (students sorgusu) → error döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        is:     vi.fn().mockResolvedValue({ data: null, error: { message: 'DB bağlantı hatası' } }),
      }),
    }
    vi.mocked(createClient).mockResolvedValue(mockDb as never)
    const r = await KanaatService.generateKanaatHesap(CLASS_ID, DONEM)
    expect(r.error).toBe('DB bağlantı hatası')
  })
})
