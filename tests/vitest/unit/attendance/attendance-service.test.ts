import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'
import { OGRETMEN_PERMS } from '../../setup/factories'

vi.mock('@/src/shared/authorization/server', () => ({
  getAbility: vi.fn(),
}))

vi.mock('@/src/domains/attendance/repositories/AttendanceRepository', () => ({
  AttendanceRepository: {
    findClass:          vi.fn(),
    findByClassDate:    vi.fn(),
    upsertEntries:      vi.fn(),
    findClassRange:     vi.fn(),
    findStudentHistory: vi.fn(),
    isTeacherOfClass:   vi.fn(),
  },
}))

vi.mock('@/src/infrastructure/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/src/infrastructure/inngest', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}))

const { getAbility }             = await import('@/src/shared/authorization/server')
const { AttendanceRepository }   = await import('@/src/domains/attendance/repositories/AttendanceRepository')
const { createClient }           = await import('@/src/infrastructure/supabase/server')
const { inngest }                = await import('@/src/infrastructure/inngest')
const { AttendanceService }      = await import('@/src/domains/attendance/services/AttendanceService')

// ─── Sabitler ────────────────────────────────────────────────────────────────

const SCHOOL_ID  = 'school-att-unit'
const TEACHER_ID = 'teacher-att-unit'
const CLASS_ID   = 'cls-att-unit'
const VALID_DATE = '2026-01-12' // Pazartesi — geçerli iş günü
const SAT_DATE   = '2026-01-10' // Cumartesi — hafta sonu

// ─── Yardımcı fabrikalar ─────────────────────────────────────────────────────

function makeAbility(perms = OGRETMEN_PERMS, userId = TEACHER_ID) {
  return createAbility({ userId, schoolId: SCHOOL_ID, permissions: perms })
}

/**
 * Thenable chain: her Supabase zincir metodu (select, eq, in, …)
 * aynı nesneyi döner; `.then()` ile await edilince `result` çözümlenir.
 */
function makeChain(result: unknown = { data: null, error: null }) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'is', 'not', 'order', 'single', 'limit', 'maybeSingle', 'upsert', 'gte', 'lte', 'neq']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain['then'] = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve)
  return chain
}

function makeDb(studentsResult: unknown = { data: null, error: null }) {
  const studentsChain = makeChain(studentsResult)
  const db = {
    from: vi.fn((table: string) => {
      if (table === 'students') return studentsChain
      return makeChain()
    }),
  }
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
describe('AttendanceService.getYoklama()', () => {

  it('1. giriş yapılmamış → "Giriş gerekli" fırlatır', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    await expect(
      AttendanceService.getYoklama(CLASS_ID, VALID_DATE)
    ).rejects.toThrow('Giriş gerekli')
  })

  it('2. attendance:read yetkisi yoksa → hata fırlatır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    await expect(
      AttendanceService.getYoklama(CLASS_ID, VALID_DATE)
    ).rejects.toThrow('Bu işlem için yetkiniz yok')
  })

  it('3. sınıf bulunamazsa → "Sınıf bulunamadı" fırlatır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(createClient).mockResolvedValue(makeDb() as never)
    vi.mocked(AttendanceRepository.findClass).mockResolvedValue(null)
    await expect(
      AttendanceService.getYoklama(CLASS_ID, VALID_DATE)
    ).rejects.toThrow('Sınıf bulunamadı')
  })

  it('4. başarılı → {st1: "absent", st2: "present"} map döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(createClient).mockResolvedValue(makeDb() as never)
    vi.mocked(AttendanceRepository.findClass).mockResolvedValue({
      id: CLASS_ID, mentor_teacher_id: TEACHER_ID,
    } as never)
    vi.mocked(AttendanceRepository.findByClassDate).mockResolvedValue([
      { student_id: 'st1', status: 'absent'  },
      { student_id: 'st2', status: 'present' },
    ] as never)

    const result = await AttendanceService.getYoklama(CLASS_ID, VALID_DATE)

    expect(result).toEqual({ st1: 'absent', st2: 'present' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('AttendanceService.saveYoklama()', () => {

  it('5. giriş yapılmamış → hata fırlatır', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)
    await expect(
      AttendanceService.saveYoklama(CLASS_ID, VALID_DATE, [])
    ).rejects.toThrow('Giriş gerekli')
  })

  it('6. geçersiz tarih formatı "15-01-2026" → "Geçersiz tarih formatı" fırlatır', async () => {
    // requireAbility çağrılmadan önce format kontrolü yapılıyor
    await expect(
      AttendanceService.saveYoklama(CLASS_ID, '15-01-2026', [])
    ).rejects.toThrow('Geçersiz tarih formatı')
    expect(getAbility).not.toHaveBeenCalled()
  })

  it('7. hafta sonu "2026-01-10" (Cumartesi) → hafta sonu hatası fırlatır', async () => {
    await expect(
      AttendanceService.saveYoklama(CLASS_ID, SAT_DATE, [])
    ).rejects.toThrow('Hafta sonu için yoklama girilemez')
    expect(getAbility).not.toHaveBeenCalled()
  })

  it('8. sınıf bulunamazsa → "Sınıf bulunamadı" fırlatır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(createClient).mockResolvedValue(makeDb() as never)
    vi.mocked(AttendanceRepository.findClass).mockResolvedValue(null)
    await expect(
      AttendanceService.saveYoklama(CLASS_ID, VALID_DATE, [])
    ).rejects.toThrow('Sınıf bulunamadı')
  })

  it('9. boş kayıt (entries=[]) → upsert çalışır, Inngest çağrılmaz', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(createClient).mockResolvedValue(makeDb() as never)
    vi.mocked(AttendanceRepository.findClass).mockResolvedValue({
      id: CLASS_ID, mentor_teacher_id: TEACHER_ID,
    } as never)
    vi.mocked(AttendanceRepository.upsertEntries).mockResolvedValue(undefined)

    await AttendanceService.saveYoklama(CLASS_ID, VALID_DATE, [])

    expect(AttendanceRepository.upsertEntries).toHaveBeenCalledOnce()
    expect(vi.mocked(inngest.send)).not.toHaveBeenCalled()
  })

  it('10. absent öğrenci varsa Inngest event gönderilir', async () => {
    const entries = [{ studentId: 'st1', status: 'absent' as const }]

    // students zinciri: geçerli öğrenci olarak st1 döner
    const studentsChain = makeChain({ data: [{ id: 'st1' }], error: null })
    const db = {
      from: vi.fn((table: string) => {
        if (table === 'students') return studentsChain
        return makeChain()
      }),
    }

    vi.mocked(getAbility).mockResolvedValue(makeAbility() as never)
    vi.mocked(createClient).mockResolvedValue(db as never)
    vi.mocked(AttendanceRepository.findClass).mockResolvedValue({
      id: CLASS_ID, mentor_teacher_id: TEACHER_ID,
    } as never)
    vi.mocked(AttendanceRepository.upsertEntries).mockResolvedValue(undefined)

    await AttendanceService.saveYoklama(CLASS_ID, VALID_DATE, entries)

    expect(AttendanceRepository.upsertEntries).toHaveBeenCalledOnce()
    expect(vi.mocked(inngest.send)).toHaveBeenCalledOnce()
    expect(vi.mocked(inngest.send)).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'attendance/absent',
        data: expect.objectContaining({ studentId: 'st1', classId: CLASS_ID, date: VALID_DATE }),
      }),
    ])
  })
})
