/**
 * bulkDeleteHomeworks action — RBAC + tenant isolation + soft delete testleri.
 *
 * Bu action service katmanını bypass edip doğrudan Supabase kullanır.
 * Teacher_id + school_id filtrelerinin her ikisinin de uygulandığını doğrularız.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS } from '../../setup/factories'
import type { GrantedPermission } from '@/src/domains/rbac/types'

const NO_DELETE_PERMS: GrantedPermission[] = OGRETMEN_PERMS.filter(
  p => !(p.resource === 'homework' && p.action === 'delete')
)

vi.mock('@/src/shared/authorization/server', () => ({
  getAbility: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Supabase fluent mock: .from().update().in().eq().eq().is()
const mockIsChain = vi.fn().mockResolvedValue({ error: null, count: 2 })
const mockEqChain = { eq: vi.fn().mockReturnThis(), is: mockIsChain }
const mockInChain = { in: vi.fn().mockReturnValue(mockEqChain) }
const mockUpdate  = vi.fn().mockReturnValue(mockInChain)
const mockSupabase = { from: vi.fn().mockReturnValue({ update: mockUpdate }) }

vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}))

const { getAbility }        = await import('@/src/shared/authorization/server')
const { revalidatePath }    = await import('next/cache')
const { bulkDeleteHomeworks } = await import('@/app/actions/homework')

const SCHOOL_ID  = 'school-bulk-unit'
const TEACHER_ID = 'teacher-bulk-unit'

// Geçerli UUID formatında test ID'leri
const VALID_IDS = [
  'd1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1',
  'e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2',
]

function makeAbility(perms = OGRETMEN_PERMS) {
  return createAbility({ userId: TEACHER_ID, schoolId: SCHOOL_ID, permissions: perms })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSupabase.from.mockReturnValue({ update: mockUpdate })
  mockUpdate.mockReturnValue(mockInChain)
  mockInChain.in.mockReturnValue(mockEqChain)
  mockEqChain.eq.mockReturnThis()
  mockIsChain.mockResolvedValue({ error: null, count: VALID_IDS.length })
})

// ─────────────────────────────────────────────────────────────
describe('bulkDeleteHomeworks()', () => {
  it('giriş yapılmamış → { deleted: 0, error: "Giriş gerekli" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const result = await bulkDeleteHomeworks(VALID_IDS)
    expect(result.deleted).toBe(0)
    expect(result.error).toBe('Giriş gerekli')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('homework:delete izni yoksa → { deleted: 0, error }', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(NO_DELETE_PERMS) as never)
    const result = await bulkDeleteHomeworks(VALID_IDS)
    expect(result.deleted).toBe(0)
    expect(result.error).toBeTruthy()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('boş liste → { deleted: 0 }, DB çağrısı yapılmaz', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const result = await bulkDeleteHomeworks([])
    expect(result.deleted).toBe(0)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('geçersiz UUID\'ler filtrelenir, DB çağrısı yapılmaz', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const result = await bulkDeleteHomeworks(['gecersiz-id', 'baska-gecersiz'])
    expect(result.deleted).toBe(0)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('başarılı silme → deleted sayısı döner, revalidatePath çağrılır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const result = await bulkDeleteHomeworks(VALID_IDS)
    expect(result.error).toBeUndefined()
    expect(result.deleted).toBeGreaterThan(0)
    expect(revalidatePath).toHaveBeenCalledWith('/odevler')
  })

  it('TENANT: teacher_id filtresi (ability.userId) uygulanır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    await bulkDeleteHomeworks(VALID_IDS)

    // .eq('teacher_id', ability.userId) çağrısı yapıldığını doğrula
    const eqCalls = vi.mocked(mockEqChain.eq).mock.calls
    const teacherIdCall = eqCalls.find(([col]) => col === 'teacher_id')
    expect(teacherIdCall).toBeDefined()
    expect(teacherIdCall![1]).toBe(TEACHER_ID)
  })

  it('TENANT: school_id filtresi (ability.schoolId) uygulanır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    await bulkDeleteHomeworks(VALID_IDS)

    const eqCalls = vi.mocked(mockEqChain.eq).mock.calls
    const schoolIdCall = eqCalls.find(([col]) => col === 'school_id')
    expect(schoolIdCall).toBeDefined()
    expect(schoolIdCall![1]).toBe(SCHOOL_ID)
  })

  it('DB hatası → { deleted: 0, error }', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    mockIsChain.mockResolvedValue({ error: { message: 'DB down' }, count: null })
    const result = await bulkDeleteHomeworks(VALID_IDS)
    expect(result.deleted).toBe(0)
    expect(result.error).toBe('DB down')
  })

  it('karma liste: sadece geçerli UUID\'ler işlenir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    mockIsChain.mockResolvedValue({ error: null, count: 1 })
    const result = await bulkDeleteHomeworks([VALID_IDS[0], 'gecersiz-uuid'])
    expect(result.error).toBeUndefined()
    // Sadece 1 geçerli ID işlendi
    const inCall = vi.mocked(mockInChain.in).mock.calls[0]
    expect(inCall[1]).toHaveLength(1)
    expect(inCall[1][0]).toBe(VALID_IDS[0])
  })
})
