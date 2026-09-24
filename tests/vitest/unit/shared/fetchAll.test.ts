import { describe, it, expect } from 'vitest'
import { fetchAll, fetchAllResult } from '@/src/shared/utils/fetchAll'

// PostgREST gibi davranan sahte sayfa: max_rows=1000, range kapsayıcı
const sahteTablo = (n: number) => async (from: number, to: number) =>
  ({ data: Array.from({ length: Math.max(0, Math.min(n, to + 1) - from) }, (_, i) => from + i), error: null })

describe('fetchAll() — PostgREST max_rows=1000 sessiz kesilmesine karşı', () => {
  it('1000 üstünü sayfa sayfa eksiksiz okur (2500 → 2500)', async () => {
    const r = await fetchAll(sahteTablo(2500))
    expect(r).toHaveLength(2500)
    expect(r[1000]).toBe(1000)
  })

  it('tam 1000 satırda son boş sayfayla biter', async () => {
    expect(await fetchAll(sahteTablo(1000))).toHaveLength(1000)
  })

  it('hata → fırlatır (yarım veri dönmez)', async () => {
    await expect(fetchAll(async () => ({ data: null, error: { message: 'boom' } }))).rejects.toThrow('boom')
  })
})

describe('fetchAllResult() — { data, error } şekli', () => {
  it('başarıda tüm satırlar', async () => {
    const r = await fetchAllResult(sahteTablo(1500))
    expect(r.error).toBeNull()
    expect(r.data).toHaveLength(1500)
  })

  it('hatada data=null + error (yarım veri dönmez)', async () => {
    let cagri = 0
    const r = await fetchAllResult(async (from, to) =>
      ++cagri === 1 ? sahteTablo(5000)(from, to) : { data: null, error: { message: 'kopma' } })
    expect(r.data).toBeNull()
    expect(r.error?.message).toBe('kopma')
  })
})
