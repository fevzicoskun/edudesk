import { describe, it, expect, vi, beforeEach } from 'vitest'

// 2026-10-17 tarama: tarih kutusuna yıl elle yazılırken ara değerler (0002-10-16…) weekRange'i boş döndürüyor,
// action yine sorgu atıyordu → PostgREST 400 (due_date=gte.&due_date=lte.).
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/src/infrastructure/inngest', () => ({ inngest: { send: vi.fn() } }))
vi.mock('@/src/shared/auth', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1' }),
  getCurrentProfile: vi.fn().mockResolvedValue({ id: 'u1', school_id: 's1' }),
}))
vi.mock('@/src/domains/homework/repositories/HomeworkRepository', () => ({
  HomeworkRepository: { findWeekLoadRows: vi.fn().mockResolvedValue({ data: [], error: null }) },
}))

const { HomeworkRepository } = await import('@/src/domains/homework/repositories/HomeworkRepository')
const { getClassWeekLoad } = await import('@/app/actions/homework')
const SINIF = '11111111-1111-4111-8111-111111111111'

beforeEach(() => vi.clearAllMocks())

describe('getClassWeekLoad', () => {
  it('yazım sırasındaki ara yıl (0002-10-16) → sorgu atılmaz, boş döner', async () => {
    expect(await getClassWeekLoad([SINIF], '0002-10-16')).toEqual([])
    expect(HomeworkRepository.findWeekLoadRows).not.toHaveBeenCalled()
  })

  it('geçerli tarih → Pzt–Paz aralığıyla sorgulanır', async () => {
    await getClassWeekLoad([SINIF], '2026-10-16')
    expect(HomeworkRepository.findWeekLoadRows).toHaveBeenCalledWith('s1', [SINIF], '2026-10-12', '2026-10-18')
  })
})
