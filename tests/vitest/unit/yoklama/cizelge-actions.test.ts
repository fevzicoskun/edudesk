import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS } from '../../setup/factories'

vi.mock('@/src/shared/authorization/server', () => ({ getAbility: vi.fn() }))

const mockSingle      = vi.fn()
const mockMaybeSingle = vi.fn()
const mockLimit       = vi.fn()
const mockFromResult = {
  select:      vi.fn().mockReturnThis(),
  eq:          vi.fn().mockReturnThis(),
  is:          vi.fn().mockReturnThis(),
  gte:         vi.fn().mockReturnThis(),
  lte:         vi.fn().mockReturnThis(),
  neq:         vi.fn().mockReturnThis(),
  order:       vi.fn().mockReturnThis(),
  in:          vi.fn().mockReturnThis(),
  not:         vi.fn().mockReturnThis(),
  single:      mockSingle,
  maybeSingle: mockMaybeSingle,
  limit:       mockLimit,
}
const mockSupabase = { from: vi.fn().mockReturnValue(mockFromResult) }

vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}))
vi.mock('@/src/infrastructure/inngest', () => ({
  inngest: { send: vi.fn().mockResolvedValue(undefined) },
}))

const { getAbility }   = await import('@/src/shared/authorization/server')
const { getCizelge }   = await import('@/app/actions/yoklama')

const CLASS_ID   = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
const SCHOOL_ID  = 'school-cizelge-unit'
const TEACHER_ID = 'teacher-cizelge-unit'

beforeEach(() => {
  vi.clearAllMocks()
  mockSupabase.from.mockReturnValue(mockFromResult)
  mockFromResult.select.mockReturnThis()
  mockFromResult.eq.mockReturnThis()
  mockFromResult.is.mockReturnThis()
  mockFromResult.gte.mockReturnThis()
  mockFromResult.lte.mockReturnThis()
  mockFromResult.not.mockReturnThis()
})

describe('getCizelge()', () => {
  it('giriş yoksa hata fırlatır', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    await expect(getCizelge(CLASS_ID, 2026, 6)).rejects.toThrow('Giriş gerekli')
  })

  it('yönetici rolünde gün listesi + satırları döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(
      createAbility({ userId: TEACHER_ID, schoolId: SCHOOL_ID, permissions: OGRETMEN_PERMS }) as never
    )
    // 1. findClass → sınıf var; 2. profiles role → mudur; 3. findClassRange → satırlar
    mockSingle
      .mockResolvedValueOnce({ data: { id: CLASS_ID, mentor_teacher_id: null }, error: null })
      .mockResolvedValueOnce({ data: { role: 'mudur' }, error: null })
    mockLimit.mockResolvedValueOnce({
      data: [{ student_id: 'st1', status: 'absent', date: '2026-06-08' }],
      error: null,
    })
    const result = await getCizelge(CLASS_ID, 2026, 6)
    expect(result.days).toHaveLength(22)
    expect(result.rows).toEqual([{ student_id: 'st1', status: 'absent', date: '2026-06-08' }])
  })

  it('öğretmen okul-içi başka sınıfın çizelgesini de görebilir', async () => {
    vi.mocked(getAbility).mockResolvedValue(
      createAbility({ userId: TEACHER_ID, schoolId: SCHOOL_ID, permissions: OGRETMEN_PERMS }) as never
    )
    // findClass → başka öğretmenin sınıfı; okul-içi olduğu için erişim serbest
    mockSingle.mockResolvedValueOnce({ data: { id: CLASS_ID, mentor_teacher_id: 'baskasi' }, error: null })
    mockLimit.mockResolvedValueOnce({
      data: [{ student_id: 'st1', status: 'absent', date: '2026-06-08' }],
      error: null,
    })
    const result = await getCizelge(CLASS_ID, 2026, 6)
    expect(result.days).toHaveLength(22)
    expect(result.rows).toHaveLength(1)
  })

  it('geçersiz yıl → hata fırlatır', async () => {
    vi.mocked(getAbility).mockResolvedValue(
      createAbility({ userId: TEACHER_ID, schoolId: SCHOOL_ID, permissions: OGRETMEN_PERMS }) as never
    )
    await expect(getCizelge(CLASS_ID, 2019, 6)).rejects.toThrow('Geçersiz yıl')
  })

  it('geçersiz ay → hata fırlatır', async () => {
    vi.mocked(getAbility).mockResolvedValue(
      createAbility({ userId: TEACHER_ID, schoolId: SCHOOL_ID, permissions: OGRETMEN_PERMS }) as never
    )
    await expect(getCizelge(CLASS_ID, 2026, 13)).rejects.toThrow('Geçersiz ay')
  })
})
