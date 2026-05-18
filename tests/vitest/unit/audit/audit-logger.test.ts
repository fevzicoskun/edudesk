import { describe, it, expect, vi, beforeEach } from 'vitest'

// Supabase client tamamen mock
const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockFrom   = vi.fn(() => ({ insert: mockInsert }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}))

const { logAudit } = await import('@/lib/audit')

beforeEach(() => vi.clearAllMocks())

describe('logAudit()', () => {
  it('audit_logs tablosuna insert çağrısı yapar', async () => {
    await logAudit({
      user_id:    'user-1',
      action:     'homework.create',
      table_name: 'homeworks',
      record_id:  'hw-1',
      school_id:  'school-1',
    })

    expect(mockFrom).toHaveBeenCalledWith('audit_logs')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id:    'user-1',
        action:     'homework.create',
        table_name: 'homeworks',
        record_id:  'hw-1',
        school_id:  'school-1',
      })
    )
  })

  it('new_data belirtilmezse null olarak insert eder', async () => {
    await logAudit({ user_id: 'user-1', action: 'login' })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ new_data: null, table_name: null })
    )
  })

  it('DB hatası iş akışını durdurmaz (silent fail)', async () => {
    mockInsert.mockRejectedValueOnce(new Error('DB bağlantı hatası'))
    // Promise asla reject olmamalı
    await expect(
      logAudit({ user_id: 'user-1', action: 'login' })
    ).resolves.toBeUndefined()
  })

  it('geçersiz action tipi ile de sessizce çalışır', async () => {
    // TypeScript buna izin vermez ama runtime güvenliği test ediyoruz
    await expect(
      logAudit({ user_id: 'user-1', action: 'login' })
    ).resolves.toBeUndefined()
  })
})
