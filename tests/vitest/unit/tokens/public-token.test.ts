import { describe, it, expect, vi } from 'vitest'

vi.mock('@/src/infrastructure/observability/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const { createPublicToken, extractJti, verifyPublicToken } = await import('@/src/infrastructure/tokens')

describe('createPublicToken jti', () => {
  it('jti verilmezse rastgele üretir (iki token farklı jti)', async () => {
    const a = await createPublicToken('veli', 'stu-1', 7, { school_id: 'sch-1' })
    const b = await createPublicToken('veli', 'stu-1', 7, { school_id: 'sch-1' })
    expect(extractJti(a)).not.toBe(extractJti(b))
  })

  it('jti verilirse payload o jti ile imzalanır ve doğrulanır', async () => {
    const token = await createPublicToken('veli', 'stu-1', 7, { school_id: 'sch-1' }, 'plan-2026-09-14-stu-1')
    expect(extractJti(token)).toBe('plan-2026-09-14-stu-1')
    const r = await verifyPublicToken(token, 'veli')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.payload.jti).toBe('plan-2026-09-14-stu-1')
      expect(r.payload.m?.school_id).toBe('sch-1')
    }
  })
})
