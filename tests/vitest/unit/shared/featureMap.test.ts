import { describe, it, expect } from 'vitest'
import { featureFromPath, FEATURES } from '@/src/shared/usage/featureMap'

describe('featureFromPath', () => {
  it('bilinen kök route\'u eşler', () => {
    expect(featureFromPath('/yoklama')).toBe('yoklama')
    expect(featureFromPath('/anasayfa')).toBe('anasayfa')
  })

  it('alt path\'i kök özelliğe eşler', () => {
    expect(featureFromPath('/yoklama/5a-sinifi')).toBe('yoklama')
    expect(featureFromPath('/siniflar/123/ogrenciler')).toBe('siniflar')
  })

  it('bilinmeyen route\'ta null döner', () => {
    expect(featureFromPath('/platform')).toBeNull()
    expect(featureFromPath('/login')).toBeNull()
    expect(featureFromPath('/')).toBeNull()
  })

  it('FEATURES 40 karakteri aşan ad içermez (RPC guard sınırı)', () => {
    for (const f of FEATURES) expect(f.length).toBeLessThanOrEqual(40)
  })
})
