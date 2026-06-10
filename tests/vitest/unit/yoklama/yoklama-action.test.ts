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

const mockSingle    = vi.fn()
const mockUpsert    = vi.fn()
const mockFromResult = {
  select: vi.fn().mockReturnThis(),
  eq:     vi.fn().mockReturnThis(),
  is:     vi.fn().mockReturnThis(),
  single: mockSingle,
  upsert: mockUpsert,
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

// Geçerli UUID formatındaki test öğrenci ID'leri
const S1 = '11111111-1111-4111-8111-111111111111'
const S2 = '22222222-2222-4222-8222-222222222222'
const SA = '33333333-3333-4333-8333-333333333333' // absent
const SP = '44444444-4444-4444-8444-444444444444' // present
const SE = '55555555-5555-4555-8555-555555555555' // excused

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
describe('saveYoklama() — action-level input validation', () => {
  it('geçersiz classId UUID → throw Geçersiz ID', async () => {
    await expect(saveYoklama('not-a-uuid', '2026-06-09', [])).rejects.toThrow('Geçersiz ID')
  })

  it('geçersiz tarih formatı → throw Geçersiz tarih formatı', async () => {
    await expect(saveYoklama(CLASS_ID, '09-06-2026', [])).rejects.toThrow('Geçersiz tarih formatı')
  })

  it('tarih string değil → throw', async () => {
    await expect(saveYoklama(CLASS_ID, '', [])).rejects.toThrow()
  })

  it('entry\'de geçersiz status → throw', async () => {
    await expect(saveYoklama(CLASS_ID, '2026-06-09', [
      { studentId: S1, status: 'yanlis_deger' as never },
    ])).rejects.toThrow()
  })

  it('entry\'de UUID olmayan studentId → throw Geçersiz ID', async () => {
    await expect(saveYoklama(CLASS_ID, '2026-06-09', [
      { studentId: 'ogrenci-1', status: 'present' },
    ])).rejects.toThrow('Geçersiz ID')
  })

  it('200\'den fazla entry → throw', async () => {
    const entries = Array.from({ length: 201 }, (_, i) => ({
      studentId: `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`,
      status: 'present' as const,
    }))
    await expect(saveYoklama(CLASS_ID, '2026-06-09', entries)).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────
describe('saveYoklama() — service-level guards', () => {
  it('hafta sonu → throw Hafta sonu için yoklama girilemez', async () => {
    await expect(saveYoklama(CLASS_ID, '2026-06-07', [])).rejects.toThrow('Hafta sonu için yoklama girilemez')
  })

  it('gelecek tarih (Salı) → throw Gelecek tarih için yoklama girilemez', async () => {
    await expect(saveYoklama(CLASS_ID, '2099-06-17', [])).rejects.toThrow('Gelecek tarih için yoklama girilemez')
  })

  it('giriş yapılmamış → throw Giriş gerekli', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    await expect(saveYoklama(CLASS_ID, '2026-06-09', [])).rejects.toThrow('Giriş gerekli')
  })

  it('attendance:update izni yok → throw yetkiniz yok', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(NO_ATTENDANCE_PERMS) as never)
    await expect(saveYoklama(CLASS_ID, '2026-06-09', [])).rejects.toThrow('yetkiniz yok')
  })

  it('sınıf başka okula ait → throw Sınıf bulunamadı', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    mockSingle.mockResolvedValue({ data: null, error: null })
    await expect(saveYoklama(CLASS_ID, '2026-06-09', [])).rejects.toThrow('Sınıf bulunamadı')
  })

  it('upsert başarısız → throw hata mesajı', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    mockUpsert.mockResolvedValue({ error: { message: 'DB hatası' } })
    await expect(saveYoklama(CLASS_ID, '2026-06-09', [])).rejects.toThrow('DB hatası')
  })
})

// ─────────────────────────────────────────────────────────────
describe('saveYoklama() — başarılı kayıt', () => {
  it('normal client ile upsert yapılır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const { createClient } = await import('@/src/infrastructure/supabase/server')
    await saveYoklama(CLASS_ID, '2026-06-09', [
      { studentId: S1, status: 'present' },
      { studentId: S2, status: 'absent' },
    ])
    expect(createClient).toHaveBeenCalled()
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ teacher_id: TEACHER_ID, school_id: SCHOOL_ID }),
      ]),
      { onConflict: 'class_id,student_id,date' }
    )
  })

  it('devamsız öğrenciler → inngest event gönderilir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const { inngest } = await import('@/src/infrastructure/inngest')
    await saveYoklama(CLASS_ID, '2026-06-09', [
      { studentId: SA, status: 'absent' },
    ])
    expect(inngest.send).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'attendance/absent', data: expect.objectContaining({ studentId: SA }) }),
      ])
    )
  })

  it('sadece present öğrenciler → inngest event gönderilmez', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const { inngest } = await import('@/src/infrastructure/inngest')
    await saveYoklama(CLASS_ID, '2026-06-09', [
      { studentId: SP, status: 'present' },
    ])
    expect(inngest.send).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────
describe('saveYoklama() — excused durum', () => {
  it('yalnız excused/present girişlerde Inngest eventi GÖNDERMEZ', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const { inngest } = await import('@/src/infrastructure/inngest')
    await saveYoklama(CLASS_ID, '2026-06-09', [
      { studentId: SE, status: 'excused' },
      { studentId: SP, status: 'present' },
    ])
    expect(inngest.send).not.toHaveBeenCalled()
  })

  it('excused + absent karışık girişte yalnız absent için event gönderir', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    const { inngest } = await import('@/src/infrastructure/inngest')
    await saveYoklama(CLASS_ID, '2026-06-09', [
      { studentId: SE, status: 'excused' },
      { studentId: SA, status: 'absent' },
    ])
    expect(inngest.send).toHaveBeenCalledTimes(1)
    const events = vi.mocked(inngest.send).mock.calls[0][0] as { data: { studentId: string } }[]
    expect(events).toHaveLength(1)
    expect(events[0].data.studentId).toBe(SA)
  })
})

// ─────────────────────────────────────────────────────────────
describe('getYoklama() — input validation & auth', () => {
  it('geçersiz tarih formatı → throw', async () => {
    await expect(getYoklama(CLASS_ID, '20260609')).rejects.toThrow('Geçersiz tarih formatı')
  })

  it('geçersiz classId → throw Geçersiz ID', async () => {
    await expect(getYoklama('sinif-123', '2026-06-09')).rejects.toThrow('Geçersiz ID')
  })

  it('giriş yapılmamış → throw Giriş gerekli', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    await expect(getYoklama(CLASS_ID, '2026-06-09')).rejects.toThrow('Giriş gerekli')
  })

  it('attendance:read izni yok → throw yetkiniz yok', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(NO_ATTENDANCE_PERMS) as never)
    await expect(getYoklama(CLASS_ID, '2026-06-09')).rejects.toThrow('yetkiniz yok')
  })

  it('sınıf başka okula ait → throw Sınıf bulunamadı', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    mockSingle.mockResolvedValue({ data: null, error: null })
    await expect(getYoklama(CLASS_ID, '2026-06-09')).rejects.toThrow('Sınıf bulunamadı')
  })
})
