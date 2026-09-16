import { describe, it, expect } from 'vitest'
import { readdirSync } from 'fs'
import path from 'path'
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

  it('app/(dashboard) altındaki her modül klasörü izlenir (yeni modül unutulmasın)', () => {
    // Not: DB tarafındaki increment_usage whitelist'i de aynı listeyle güncellenmeli.
    const dir = path.join(process.cwd(), 'app', '(dashboard)')
    const moduller = readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
    expect(moduller.filter(m => !(FEATURES as readonly string[]).includes(m))).toEqual([])
  })
})
