/**
 * 2026-09-29: hızlı ödev ekleme (mavi "+" düğmesi) verildiği günü göndermiyordu; DB varsayılanı
 * CURRENT_DATE UTC olduğundan İstanbul'da gece 00:00–03:00 arası verilen ödev bir önceki güne yazılıyordu.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/src/infrastructure/inngest', () => ({ inngest: { send: vi.fn() } }))
vi.mock('@/src/shared/auth', () => ({ getCurrentUser: vi.fn(), getCurrentProfile: vi.fn().mockResolvedValue(null) }))
vi.mock('@/src/domains/homework/services/HomeworkService', () => ({
  HomeworkService: { createHomework: vi.fn().mockResolvedValue({ id: 'yeni-odev' }) },
}))

const { HomeworkService } = await import('@/src/domains/homework/services/HomeworkService')
const { quickCreateHomework } = await import('@/app/actions/homework')

const SINIF = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'

function form(dueDate: string) {
  const fd = new FormData()
  fd.append('class_id', SINIF)
  fd.append('title', 'Türev test')
  fd.append('subject', 'Matematik')
  fd.append('due_date', dueDate)
  return fd
}

describe('quickCreateHomework — verildiği gün İstanbul tarihiyle yazılır', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.useRealTimers())

  it('İstanbul 00:30 (UTC hâlâ önceki gün) → verildiği gün İstanbul günüdür', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-28T21:30:00Z')) // İstanbul 29 Eylül 00:30
    const r = await quickCreateHomework(form('2026-10-01'))
    expect(r.error).toBeUndefined()
    expect(HomeworkService.createHomework).toHaveBeenCalledWith(expect.objectContaining({ assigned_date: '2026-09-29' }))
  })

  it('gün içinde de İstanbul günü açıkça gönderilir (DB varsayılanına bırakılmaz)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-29T09:00:00Z'))
    await quickCreateHomework(form('2026-10-01'))
    expect(HomeworkService.createHomework).toHaveBeenCalledWith(expect.objectContaining({ assigned_date: '2026-09-29' }))
  })
})
