import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/export/repositories/ExportRepository', () => ({
  ExportRepository: {
    create:        vi.fn(),
    findByEventId: vi.fn(),
    findById:      vi.fn(),
    markCancelled: vi.fn(),
  },
}))

vi.mock('@/src/infrastructure/inngest', () => ({
  inngest: { send: vi.fn().mockResolvedValue(undefined) },
}))

const { ExportRepository }  = await import('@/src/domains/export/repositories/ExportRepository')
const { inngest }            = await import('@/src/infrastructure/inngest')
const { ExportService }      = await import('@/src/domains/export/services/ExportService')

const USER_ID   = 'user-export-test'
const SCHOOL_ID = 'school-export-test'

beforeEach(() => vi.clearAllMocks())

// ─── enqueue ────────────────────────────────────────────────

describe('ExportService.enqueue()', () => {
  it('başarılı insert → jobId döner ve inngest.send çağrılır', async () => {
    vi.mocked(ExportRepository.create).mockResolvedValue({ data: { id: 'job-1' }, error: null } as never)

    const result = await ExportService.enqueue('excel_odevler', {}, USER_ID, SCHOOL_ID)

    expect(result).toEqual({ jobId: 'job-1' })
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'export/requested', data: expect.objectContaining({ jobId: 'job-1' }) })
    )
  })

  it('unique constraint (23505) → mevcut iş bulunur, aynı jobId döner', async () => {
    vi.mocked(ExportRepository.create).mockResolvedValue({
      data: null, error: { code: '23505', message: 'duplicate' },
    } as never)
    vi.mocked(ExportRepository.findByEventId).mockResolvedValue({ data: { id: 'job-existing' }, error: null } as never)

    const result = await ExportService.enqueue('excel_odevler', {}, USER_ID, SCHOOL_ID)

    expect(result).toEqual({ jobId: 'job-existing' })
    expect(inngest.send).not.toHaveBeenCalled()
  })

  it('unique constraint ama mevcut iş de bulunamazsa → error döner', async () => {
    vi.mocked(ExportRepository.create).mockResolvedValue({
      data: null, error: { code: '23505', message: 'duplicate' },
    } as never)
    vi.mocked(ExportRepository.findByEventId).mockResolvedValue({ data: null, error: null } as never)

    const result = await ExportService.enqueue('excel_odevler', {}, USER_ID, SCHOOL_ID)

    expect(result).toHaveProperty('error')
  })

  it('DB hatası (non-23505) → error mesajı döner', async () => {
    vi.mocked(ExportRepository.create).mockResolvedValue({
      data: null, error: { code: '42P01', message: 'table not found' },
    } as never)

    const result = await ExportService.enqueue('excel_odevler', {}, USER_ID, SCHOOL_ID)

    expect(result).toEqual({ error: 'table not found' })
    expect(inngest.send).not.toHaveBeenCalled()
  })

  it('insert başarılı ama data null → genel hata döner', async () => {
    vi.mocked(ExportRepository.create).mockResolvedValue({ data: null, error: null } as never)

    const result = await ExportService.enqueue('excel_odevler', {}, USER_ID, SCHOOL_ID)

    expect(result).toEqual({ error: 'İş oluşturulamadı' })
  })
})

// ─── cancel ─────────────────────────────────────────────────

describe('ExportService.cancel()', () => {
  it('iş bulunamazsa → error: İş bulunamadı', async () => {
    vi.mocked(ExportRepository.findById).mockResolvedValue({ data: null, error: null } as never)

    const result = await ExportService.cancel('job-x', USER_ID)

    expect(result).toEqual({ error: 'İş bulunamadı' })
    expect(inngest.send).not.toHaveBeenCalled()
  })

  it('iş "done" durumundaysa → iptal edilemez, error döner', async () => {
    vi.mocked(ExportRepository.findById).mockResolvedValue({ data: { id: 'job-1', status: 'done' }, error: null } as never)

    const result = await ExportService.cancel('job-1', USER_ID)

    expect(result).toEqual({ error: 'İş zaten done durumunda' })
    expect(ExportRepository.markCancelled).not.toHaveBeenCalled()
  })

  it('iş "error" durumundaysa → iptal edilemez', async () => {
    vi.mocked(ExportRepository.findById).mockResolvedValue({ data: { id: 'job-1', status: 'error' }, error: null } as never)

    const result = await ExportService.cancel('job-1', USER_ID)

    expect(result).toHaveProperty('error')
  })

  it('"pending" iş → markCancelled çağrılır ve inngest event gönderilir', async () => {
    vi.mocked(ExportRepository.findById).mockResolvedValue({ data: { id: 'job-1', status: 'pending' }, error: null } as never)
    vi.mocked(ExportRepository.markCancelled).mockResolvedValue(undefined as never)

    const result = await ExportService.cancel('job-1', USER_ID)

    expect(result).toEqual({})
    expect(ExportRepository.markCancelled).toHaveBeenCalledWith('job-1', USER_ID)
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'export/cancelled', data: { jobId: 'job-1', cancelledBy: USER_ID } })
    )
  })

  it('"processing" iş de iptal edilebilir', async () => {
    vi.mocked(ExportRepository.findById).mockResolvedValue({ data: { id: 'job-1', status: 'processing' }, error: null } as never)
    vi.mocked(ExportRepository.markCancelled).mockResolvedValue(undefined as never)

    const result = await ExportService.cancel('job-1', USER_ID)

    expect(result).toEqual({})
    expect(ExportRepository.markCancelled).toHaveBeenCalled()
  })
})
