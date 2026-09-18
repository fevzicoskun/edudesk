import { describe, it, expect } from 'vitest'
import { hataKaydiOlustur, MESAJ_SINIRI } from '@/src/infrastructure/observability/hataKaydi'

describe('hataKaydiOlustur()', () => {
  it('ad, mesaj ve kaynağı taşır', () => {
    const kayit = hataKaydiOlustur({ name: 'ClientError', message: 'Beklenmeyen hata', source: 'client' })
    expect(kayit.name).toBe('ClientError')
    expect(kayit.message).toBe('Beklenmeyen hata')
    expect(kayit.source).toBe('client')
  })

  it('aynı hata için parmak izi kararlıdır', () => {
    const a = hataKaydiOlustur({ name: 'X', message: 'aynı mesaj', source: 'server' })
    const b = hataKaydiOlustur({ name: 'X', message: 'aynı mesaj', source: 'server' })
    expect(a.fingerprint).toBe(b.fingerprint)
  })

  it('farklı mesaj farklı parmak izi üretir', () => {
    const a = hataKaydiOlustur({ name: 'X', message: 'birinci', source: 'server' })
    const b = hataKaydiOlustur({ name: 'X', message: 'ikinci', source: 'server' })
    expect(a.fingerprint).not.toBe(b.fingerprint)
  })

  it('çok uzun mesaj kırpılır — tek bir hata tabloyu şişirmesin', () => {
    const kayit = hataKaydiOlustur({ name: 'X', message: 'a'.repeat(5000), source: 'server' })
    expect(kayit.message.length).toBe(MESAJ_SINIRI)
  })

  it('context içindeki gizli alanlar maskelenir', () => {
    const kayit = hataKaydiOlustur({
      name: 'X', message: 'm', source: 'server',
      context: { userId: 'u1', password: 'gizli', token: 'abc', access_token: 'xyz' },
    })
    expect(kayit.context).toEqual({ userId: 'u1', password: '[GIZLI]', token: '[GIZLI]', access_token: '[GIZLI]' })
  })

  it('undefined/null context alanları düşer', () => {
    const kayit = hataKaydiOlustur({
      name: 'X', message: 'm', source: 'server',
      context: { userId: 'u1', url: undefined, digest: null },
    })
    expect(kayit.context).toEqual({ userId: 'u1' })
  })

  it('context yoksa boş nesne olur — null yerine', () => {
    const kayit = hataKaydiOlustur({ name: 'X', message: 'm', source: 'server' })
    expect(kayit.context).toEqual({})
  })

  it('boş mesaj "(mesaj yok)" ile kaydedilir — NOT NULL kolonu kırılmasın', () => {
    const kayit = hataKaydiOlustur({ name: 'X', message: '   ', source: 'server' })
    expect(kayit.message).toBe('(mesaj yok)')
  })
})

// ─────────────────────────────────────────────────────────────
import { gruplaHatalar } from '@/src/infrastructure/observability/hataKaydi'

describe('gruplaHatalar()', () => {
  const kayit = (fingerprint: string, created_at: string, over: Partial<{ name: string; message: string; source: string }> = {}) => ({
    id: `${fingerprint}-${created_at}`,
    fingerprint,
    name:    over.name    ?? 'X',
    message: over.message ?? 'mesaj',
    source:  over.source  ?? 'server',
    created_at,
    context: {},
  })

  it('aynı parmak izli hatalar tek grupta sayılır', () => {
    const gruplar = gruplaHatalar([
      kayit('aaa', '2026-09-19T10:00:00Z'),
      kayit('aaa', '2026-09-19T11:00:00Z'),
      kayit('aaa', '2026-09-19T12:00:00Z'),
    ])
    expect(gruplar).toHaveLength(1)
    expect(gruplar[0].adet).toBe(3)
  })

  it('grup en son görülme zamanını taşır', () => {
    const gruplar = gruplaHatalar([
      kayit('aaa', '2026-09-19T10:00:00Z'),
      kayit('aaa', '2026-09-19T12:00:00Z'),
      kayit('aaa', '2026-09-19T11:00:00Z'),
    ])
    expect(gruplar[0].sonGorulme).toBe('2026-09-19T12:00:00Z')
    expect(gruplar[0].ilkGorulme).toBe('2026-09-19T10:00:00Z')
  })

  it('gruplar en son görülene göre sıralanır — taze hata üstte', () => {
    const gruplar = gruplaHatalar([
      kayit('eski', '2026-09-18T10:00:00Z'),
      kayit('yeni', '2026-09-19T15:00:00Z'),
      kayit('orta', '2026-09-19T09:00:00Z'),
    ])
    expect(gruplar.map(g => g.fingerprint)).toEqual(['yeni', 'orta', 'eski'])
  })

  it('aynı sayıda değil, en son görülene göre sıralanır — çok tekrarlayan eski hata üste çıkmaz', () => {
    const gruplar = gruplaHatalar([
      kayit('eski', '2026-09-18T10:00:00Z'),
      kayit('eski', '2026-09-18T10:01:00Z'),
      kayit('eski', '2026-09-18T10:02:00Z'),
      kayit('yeni', '2026-09-19T15:00:00Z'),
    ])
    expect(gruplar[0].fingerprint).toBe('yeni')
    expect(gruplar[1].adet).toBe(3)
  })

  it('boş liste boş grup döner', () => {
    expect(gruplaHatalar([])).toEqual([])
  })
})
