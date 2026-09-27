import { describe, it, expect, vi, beforeEach } from 'vitest'

// Serverless'ta (Vercel) cevap döndükten sonra bekleyen promise'in bitmesi garanti
// değil. Hata kaydı ancak çağıran onu BEKLEYEBİLİRSE kalıcıdır.

let yazilan: string[] = []
vi.mock('@/src/infrastructure/supabase/service', () => ({
  createServiceClient: () => ({
    from: () => ({
      insert: async (satir: { message: string }) => {
        await new Promise(r => setTimeout(r, 20))
        yazilan.push(satir.message)
        return { error: null }
      },
    }),
  }),
}))

const { sendCriticalAlert } = await import('@/src/infrastructure/observability/alerts')

describe('sendCriticalAlert → app_errors', () => {
  beforeEach(() => { yazilan = [] })

  it('döndürdüğü promise insert bitmeden resolve olmaz', async () => {
    await sendCriticalAlert({ name: 'TestHata', message: 'bir', source: 'server' })
    expect(yazilan).toEqual(['bir'])
  })

  it('eşzamanlı iki hatanın ikisi de yazılır (biri diğerini düşürmez)', async () => {
    await Promise.all([
      sendCriticalAlert({ name: 'A', message: 'a', source: 'server' }),
      sendCriticalAlert({ name: 'B', message: 'b', source: 'client' }),
    ])
    expect(yazilan.sort()).toEqual(['a', 'b'])
  })
})
