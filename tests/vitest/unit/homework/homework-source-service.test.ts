import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAbility } from '@/src/shared/authorization'

vi.mock('@/src/shared/authorization/server', () => ({ getAbility: vi.fn() }))

vi.mock('@/src/domains/homework/repositories/HomeworkSourceRepository', () => ({
  HomeworkSourceRepository: {
    findByTeacher:      vi.fn(),
    insert:             vi.fn(),
    deactivate:         vi.fn(),
    findHomeworkDates:  vi.fn(),
  },
}))

const { getAbility }                  = await import('@/src/shared/authorization/server')
const { HomeworkSourceRepository }    = await import('@/src/domains/homework/repositories/HomeworkSourceRepository')
const { HomeworkSourceService }       = await import('@/src/domains/homework/services/HomeworkSourceService')

const TEACHER_ID = 'teacher-src-test'
const SCHOOL_ID  = 'school-src-test'

function makeAbility(perms: string[] = []) {
  return createAbility({
    userId:   TEACHER_ID,
    schoolId: SCHOOL_ID,
    permissions: perms.map(p => {
      const [resource, action] = p.split(':')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { resource: resource as any, action: action as any, scope: 'school' as const, source: 'role' as const }
    }),
  })
}

beforeEach(() => vi.clearAllMocks())

// ─── createSource — RBAC ─────────────────────────────────────

describe('HomeworkSourceService.createSource()', () => {
  it('giriş yapılmamışsa → { error: Giriş gerekli }', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)

    const result = await HomeworkSourceService.createSource('Kaynak', null)

    expect(result).toEqual({ error: 'Giriş gerekli', data: null })
    expect(HomeworkSourceRepository.insert).not.toHaveBeenCalled()
  })

  it('homework:create izni yoksa → { error: yetkiniz yok }', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)

    const result = await HomeworkSourceService.createSource('Kaynak', 'Matematik')

    expect(result.error).toMatch(/yetkiniz yok/i)
    expect(HomeworkSourceRepository.insert).not.toHaveBeenCalled()
  })

  it('yetkili kullanıcı → insert çağrılır, data döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(['homework:create']) as never)
    vi.mocked(HomeworkSourceRepository.insert).mockResolvedValue({
      data: { id: 'src-1', name: 'Kaynak', subject: 'Matematik' },
      error: null,
    } as never)

    const result = await HomeworkSourceService.createSource('Kaynak', 'Matematik')

    expect(result.data).toMatchObject({ id: 'src-1' })
    expect(HomeworkSourceRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Kaynak', subject: 'Matematik', teacher_id: TEACHER_ID })
    )
  })
})

// ─── deleteSource — RBAC ─────────────────────────────────────

describe('HomeworkSourceService.deleteSource()', () => {
  it('giriş yapılmamışsa → error', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)

    const result = await HomeworkSourceService.deleteSource('src-1')

    expect(result).toHaveProperty('error', 'Giriş gerekli')
  })

  it('homework:delete izni yoksa → error', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)

    const result = await HomeworkSourceService.deleteSource('src-1')

    expect(result.error).toMatch(/yetkiniz yok/i)
    expect(HomeworkSourceRepository.deactivate).not.toHaveBeenCalled()
  })

  it('yetkili kullanıcı → deactivate çağrılır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility(['homework:delete']) as never)
    vi.mocked(HomeworkSourceRepository.deactivate).mockResolvedValue({ error: null } as never)

    const result = await HomeworkSourceService.deleteSource('src-1')

    expect(result).toEqual({})
    expect(HomeworkSourceRepository.deactivate).toHaveBeenCalledWith('src-1', TEACHER_ID, SCHOOL_ID)
  })
})

// ─── getSourceUsage — hesaplama mantığı ─────────────────────
// En kritik davranış: thisMonth ve daysSince hesaplaması.

describe('HomeworkSourceService.getSourceUsage()', () => {
  it('giriş yapılmamışsa → error', async () => {
    vi.mocked(getAbility).mockResolvedValue(null)

    const result = await HomeworkSourceService.getSourceUsage()

    expect(result).toEqual({ error: 'Giriş gerekli', data: null })
  })

  it('ödev verisi olmayan kaynak → lastDate: null, daysSince: null, thisMonth: 0', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    vi.mocked(HomeworkSourceRepository.findByTeacher).mockResolvedValue({
      data: [{ id: 'src-1', name: 'Kaynak A', subject: null }], error: null,
    } as never)
    vi.mocked(HomeworkSourceRepository.findHomeworkDates).mockResolvedValue({
      data: [], error: null,
    } as never)

    const result = await HomeworkSourceService.getSourceUsage()

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    const src = result.data![0]
    expect(src.lastDate).toBeNull()
    expect(src.daysSince).toBeNull()
    expect(src.thisMonth).toBe(0)
  })

  it('kaynakla eşleşen ödev yoksa (farklı source_id) → thisMonth: 0', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    vi.mocked(HomeworkSourceRepository.findByTeacher).mockResolvedValue({
      data: [{ id: 'src-1', name: 'Kaynak A', subject: null }], error: null,
    } as never)
    vi.mocked(HomeworkSourceRepository.findHomeworkDates).mockResolvedValue({
      data: [{ source_id: 'src-OTHER', assigned_date: '2026-06-01' }], error: null,
    } as never)

    const result = await HomeworkSourceService.getSourceUsage()

    const src = result.data![0]
    expect(src.lastDate).toBeNull()
    expect(src.thisMonth).toBe(0)
  })

  it('birden fazla kaynak bağımsız hesaplanır', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    vi.mocked(HomeworkSourceRepository.findByTeacher).mockResolvedValue({
      data: [
        { id: 'src-1', name: 'Kaynak A', subject: null },
        { id: 'src-2', name: 'Kaynak B', subject: null },
      ], error: null,
    } as never)
    vi.mocked(HomeworkSourceRepository.findHomeworkDates).mockResolvedValue({
      data: [
        { source_id: 'src-1', assigned_date: '2026-06-01' },
        { source_id: 'src-1', assigned_date: '2026-06-03' }, // daha yeni
        { source_id: 'src-2', assigned_date: '2026-05-15' },
      ], error: null,
    } as never)

    const result = await HomeworkSourceService.getSourceUsage()

    expect(result.data).toHaveLength(2)
    const a = result.data!.find(s => s.id === 'src-1')!
    const b = result.data!.find(s => s.id === 'src-2')!
    // src-1: son tarih en büyük olan alınmalı
    expect(a.lastDate).toBe('2026-06-03')
    // src-2: farklı tarih
    expect(b.lastDate).toBe('2026-05-15')
  })

  it('repository hatası → error döner', async () => {
    vi.mocked(getAbility).mockResolvedValue(makeAbility([]) as never)
    vi.mocked(HomeworkSourceRepository.findByTeacher).mockResolvedValue({
      data: null, error: { message: 'DB bağlantı hatası' },
    } as never)

    const result = await HomeworkSourceService.getSourceUsage()

    expect(result.error).toBe('DB bağlantı hatası')
    expect(result.data).toBeNull()
  })
})
