import { describe, it, expect } from 'vitest'
import { yoklamasiAcik } from '@/src/domains/school/yoklamaAnahtari'

describe('yoklamasiAcik — yoklama modülü kapalı okulların satırlarını ayıklar (zamanlanmış işler)', () => {
  const kapali = new Set(['okulB'])
  it('kapalı okulun satırları çıkar, açık okulunkiler sırasıyla kalır', () => {
    const rows = [{ id: 1, school_id: 'okulA' }, { id: 2, school_id: 'okulB' }, { id: 3, school_id: 'okulA' }]
    expect(yoklamasiAcik(rows, kapali).map(r => r.id)).toEqual([1, 3])
  })
  it('kapalı okul yoksa hepsi kalır', () => {
    expect(yoklamasiAcik([{ school_id: 'x' }], new Set())).toHaveLength(1)
  })
  it('okulu belirsiz (null) satır atlanır — hangi okula gideceği bilinmeyen hatırlatma gönderilmez', () => {
    expect(yoklamasiAcik([{ school_id: null }], kapali)).toEqual([])
  })
})
