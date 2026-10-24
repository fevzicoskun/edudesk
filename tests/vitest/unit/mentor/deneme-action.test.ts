import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('exceljs', () => ({ default: { Workbook: vi.fn() } }))
vi.mock('@/src/domains/mentor/services/TakipService', () => ({ TakipService: { acikMi: vi.fn() } }))
vi.mock('@/src/domains/mentor/deneme/DenemeService', () => ({ DenemeService: { onizle: vi.fn() } }))

const { denemeOnizle } = await import('@/app/actions/deneme')
const { TakipService } = await import('@/src/domains/mentor/services/TakipService')
const ExcelJS = (await import('exceljs')).default

const dosya = () => { const fd = new FormData(); fd.set('file', new File(['x'], 'stoys.xlsx')); return fd }

describe('denemeOnizle — kapı Excel okunmadan önce denetlenir (2026-10-24 tarama)', () => {
  beforeEach(() => vi.clearAllMocks())
  it('kapı kapalı: dosya hiç okunmaz, açık hata döner', async () => {
    vi.mocked(TakipService.acikMi).mockResolvedValue(false)
    expect(await denemeOnizle(dosya())).toEqual({ error: 'Bu özellik henüz açık değil.' })
    expect(ExcelJS.Workbook).not.toHaveBeenCalled()
  })
})
