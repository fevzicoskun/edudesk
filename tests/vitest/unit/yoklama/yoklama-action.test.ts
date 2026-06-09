import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS } from '../../setup/factories'
import type { GrantedPermission } from '@/src/domains/rbac/types'

const NO_ATTENDANCE_PERMS: GrantedPermission[] = OGRETMEN_PERMS.filter(
  p => p.resource !== 'attendance'
)

vi.mock('@/src/shared/authorization/server', () => ({
  getAbility: vi.fn(),
}))

// Supabase mock: .from().select().eq()...single() ve .from().select()...
const mockSingle    = vi.fn()
const mockUpsert    = vi.fn()
const mockSelectChain = {
  select: vi.fn().mockReturnThis(),
  eq:     vi.fn().mockReturnThis(),
  is:     vi.fn().mockReturnThis(),
  single: mockSingle,
}
const mockFromResult = {
  select:  vi.fn().mockReturnThis(),
  eq:      vi.fn().mockReturnThis(),
  is:      vi.fn().mockReturnThis(),
  single:  mockSingle,
  upsert:  mockUpsert,
}
const mockSupabase = { from: vi.fn().mockReturnValue(mockFromResult) }

vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}))

vi.mock('@/src/infrastructure/inngest', () => ({
  inngest: { send: vi.fn().mockResolvedValue(undefined) },
}))

const { getAbility }                = await import('@/src/shared/authorization/server')
const { saveYoklama, getYoklama }   = await import('@/app/actions/yoklama')

const SCHOOL_ID  = 'school-yoklama-unit'
const CLASS_ID   = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
const TEACHER_ID = 'teacher-yoklama-unit'

function makeAbility(perms = OGRETMEN_PERMS) {
  return createAbility({ userId: TEACHER_ID, schoolId: SCHOOL_ID, permissions: perms })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSupabase.from.mockReturnValue(mockFromResult)
  mockFromResult.select.mockReturnThis()
  mockFromResult.eq.mockReturnThis()
  mockFromResult.is.mockReturnThis()
  mockSingle.mockResolvedValue({ data: { id: CLASS_ID }, error: null })
  mockUpsert.mockResolvedValue({ error: null })
})

// ─────────────────────────────────────────────────────────────
describe('saveYoklama()', () => {
  it('giriş yapılmamış → throw Giriş gerekli', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    await expect(saveYoklama(CLASS_ID, '2026-06-07', [])).rejects.toThrow('Giriş gerekli')
  })

  it('attendance:update izni yok → throw yetkiniz yok', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(NO_ATTENDANCE_PERMS) as never)
    await expect(saveYoklama(CLASS_ID, '2026-06-07', [])).rejects.toThrow('yetkiniz yok')
  })

  it('sınıf başka okula ait → throw Sınıf bulunamadı', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    mockSingle.mockResolvedValue({ data: null, error: null })
    await expect(saveYoklama(CLASS_ID, '2026-06-07', [])).rejects.toThrow('Sınıf bulunamadı')
  })

  it('başarılı kayıt → service client kullanılmaz (normal client ile upsert)', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const { createClient } = await import('@/src/infrastructure/supabase/server')
    await saveYoklama(CLASS_ID, '2026-06-07', [
      { studentId: 'student-1', status: 'present' },
      { studentId: 'student-2', status: 'absent' },
    ])
    // Normal client (createClient) kullanıldı
    expect(createClient).toHaveBeenCalled()
    // createServiceClient çağrılmadı (import'ta bile yok artık)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ teacher_id: TEACHER_ID, school_id: SCHOOL_ID }),
      ]),
      { onConflict: 'class_id,student_id,date' }
    )
  })

  it('upsert başarısız → throw hata mesajı', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    mockUpsert.mockResolvedValue({ error: { message: 'DB hatası' } })
    await expect(saveYoklama(CLASS_ID, '2026-06-07', [])).rejects.toThrow('DB hatası')
  })

  it('devamsız öğrenciler → inngest event gönderilir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const { inngest } = await import('@/src/infrastructure/inngest')
    await saveYoklama(CLASS_ID, '2026-06-07', [
      { studentId: 'absent-student', status: 'absent' },
    ])
    expect(inngest.send).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'attendance/absent', data: expect.objectContaining({ studentId: 'absent-student' }) }),
      ])
    )
  })

  it('sadece present öğrenciler → inngest event gönderilmez', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const { inngest } = await import('@/src/infrastructure/inngest')
    await saveYoklama(CLASS_ID, '2026-06-07', [
      { studentId: 'present-student', status: 'present' },
    ])
    expect(inngest.send).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────
describe('saveYoklama() — excused', () => {
  it('yalnız excused/present girişlerde Inngest eventi GÖNDERMEZ', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const { inngest } = await import('@/src/infrastructure/inngest')
    await saveYoklama(CLASS_ID, '2026-06-08', [
      { studentId: 's1', status: 'excused' },
      { studentId: 's2', status: 'present' },
    ])
    expect(inngest.send).not.toHaveBeenCalled()
  })

  it('excused + absent karışık girişte yalnız absent için event gönderir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const { inngest } = await import('@/src/infrastructure/inngest')
    await saveYoklama(CLASS_ID, '2026-06-08', [
      { studentId: 's1', status: 'excused' },
      { studentId: 's2', status: 'absent' },
    ])
    expect(inngest.send).toHaveBeenCalledTimes(1)
    const events = vi.mocked(inngest.send).mock.calls[0][0] as { data: { studentId: string } }[]
    expect(events).toHaveLength(1)
    expect(events[0].data.studentId).toBe('s2')
  })
})

// ─────────────────────────────────────────────────────────────
describe('getYoklama()', () => {
  it('giriş yapılmamış → throw Giriş gerekli', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    await expect(getYoklama(CLASS_ID, '2026-06-07')).rejects.toThrow('Giriş gerekli')
  })

  it('attendance:read izni yok → throw yetkiniz yok', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(NO_ATTENDANCE_PERMS) as never)
    await expect(getYoklama(CLASS_ID, '2026-06-07')).rejects.toThrow('yetkiniz yok')
  })

  it('sınıf başka okula ait → throw Sınıf bulunamadı', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    mockSingle.mockResolvedValue({ data: null, error: null })
    await expect(getYoklama(CLASS_ID, '2026-06-07')).rejects.toThrow('Sınıf bulunamadı')
  })
})
