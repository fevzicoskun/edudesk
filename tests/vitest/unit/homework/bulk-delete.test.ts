/**
 * bulkDeleteHomeworks action — RBAC + tenant isolation + soft delete testleri.
 *
 * Silme soft_delete_homeworks RPC'siyle yapılır (2026-09-25); sahiplik + okul filtresi
 * DB'de uygulanır ve gerçek JWT'lerle integration/rls/homework-owner-delete.test.ts'de sınanır.
 * Burada action/service mantığı (izin, UUID filtresi, sayım, geri al için id'ler) test edilir.
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

// RPC dönüşü: gerçekten silinen ödevlerin id'leri
const mockRpc = vi.fn()
const mockSupabase = { rpc: mockRpc }

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
  mockRpc.mockResolvedValue({ data: VALID_IDS, error: null })
})

// ─────────────────────────────────────────────────────────────
describe('bulkDeleteHomeworks()', () => {
  it('giriş yapılmamış → { deleted: 0, error: "Giriş gerekli" }', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    const result = await bulkDeleteHomeworks(VALID_IDS)
    expect(result.deleted).toBe(0)
    expect(result.error).toBe('Giriş gerekli')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('homework:delete izni yoksa → { deleted: 0, error }', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(NO_DELETE_PERMS) as never)
    const result = await bulkDeleteHomeworks(VALID_IDS)
    expect(result.deleted).toBe(0)
    expect(result.error).toBeTruthy()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('boş liste → { deleted: 0 }, DB çağrısı yapılmaz', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const result = await bulkDeleteHomeworks([])
    expect(result.deleted).toBe(0)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('geçersiz UUID\'ler filtrelenir, DB çağrısı yapılmaz', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const result = await bulkDeleteHomeworks(['gecersiz-id', 'baska-gecersiz'])
    expect(result.deleted).toBe(0)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('başarılı silme → deleted sayısı döner, revalidatePath çağrılır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const result = await bulkDeleteHomeworks(VALID_IDS)
    expect(result.error).toBeUndefined()
    expect(result.deleted).toBeGreaterThan(0)
    expect(revalidatePath).toHaveBeenCalledWith('/odevler')
  })

  it('soft_delete_homeworks RPC seçilen idlerle çağrılır, geri al için silinenler döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const result = await bulkDeleteHomeworks(VALID_IDS)
    expect(mockRpc).toHaveBeenCalledWith('soft_delete_homeworks', { p_ids: VALID_IDS })
    expect(result.deletedIds).toEqual(VALID_IDS)
  })

  it('DB hatası → { deleted: 0, error }', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    mockRpc.mockResolvedValue({ data: null, error: { message: 'DB down' } })
    const result = await bulkDeleteHomeworks(VALID_IDS)
    expect(result.deleted).toBe(0)
    expect(result.error).toBe('DB down')
  })

  it('REGRESYON: başkasının ödevi atlanınca deleted şişirilmez, skipped raporlanır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    // 2 ödev seçildi, DB yalnızca 1'ini güncelledi (diğeri başka öğretmenin)
    mockRpc.mockResolvedValue({ data: [VALID_IDS[0]], error: null })
    const result = await bulkDeleteHomeworks(VALID_IDS)
    expect(result.error).toBeUndefined()
    expect(result.deleted).toBe(1)
    expect(result.skipped).toBe(1)
  })

  it('REGRESYON: hiçbir satır güncellenmezse deleted 0 döner (sessiz başarı yok)', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    mockRpc.mockResolvedValue({ data: [], error: null })
    const result = await bulkDeleteHomeworks(VALID_IDS)
    expect(result.error).toBeUndefined()
    expect(result.deleted).toBe(0)
    expect(result.skipped).toBe(VALID_IDS.length)
  })

  it('karma liste: sadece geçerli UUID\'ler işlenir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    mockRpc.mockResolvedValue({ data: [VALID_IDS[0]], error: null })
    const result = await bulkDeleteHomeworks([VALID_IDS[0], 'gecersiz-uuid'])
    expect(result.error).toBeUndefined()
    // Sadece 1 geçerli ID işlendi
    expect(mockRpc).toHaveBeenCalledWith('soft_delete_homeworks', { p_ids: [VALID_IDS[0]] })
  })
})
