import { describe, it, expect } from 'vitest'
import { createStableToken, verifyPublicToken } from '@/src/infrastructure/tokens'

describe('createStableToken', () => {
  it('aynı girdiden aynı token üretir (URL kalıcı)', async () => {
    const a = await createStableToken('takvim', 'user-1', 'key-abc', { school_id: 'school-1' })
    const b = await createStableToken('takvim', 'user-1', 'key-abc', { school_id: 'school-1' })
    expect(a).toBe(b)
  })

  it('anahtar değişince token değişir', async () => {
    const a = await createStableToken('takvim', 'user-1', 'key-abc', { school_id: 'school-1' })
    const b = await createStableToken('takvim', 'user-1', 'key-xyz', { school_id: 'school-1' })
    expect(a).not.toBe(b)
  })

  it("imza doğrulanır; kullanıcı, anahtar (jti) ve okul payload'da", async () => {
    const token = await createStableToken('takvim', 'user-1', 'key-abc', { school_id: 'school-1' })
    const r = await verifyPublicToken(token, 'takvim')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.payload).toMatchObject({ t: 'takvim', id: 'user-1', jti: 'key-abc', m: { school_id: 'school-1' } })
    }
  })

  it("başka tipte doğrulanamaz (veli portalı token'ı yerine geçmez)", async () => {
    const token = await createStableToken('takvim', 'user-1', 'key-abc', { school_id: 'school-1' })
    expect(await verifyPublicToken(token, 'veli')).toEqual({ ok: false, reason: 'wrong_type' })
  })

  it('payload ile oynanırsa imza reddedilir', async () => {
    const token = await createStableToken('takvim', 'user-1', 'key-abc', { school_id: 'school-1' })
    const [v, , sig] = token.split('.')
    const forged = Buffer.from(
      JSON.stringify({ t: 'takvim', id: 'user-2', jti: 'key-abc', exp: 4102444800, m: { school_id: 'school-1' } }),
    ).toString('base64url')
    expect(await verifyPublicToken(`${v}.${forged}.${sig}`, 'takvim')).toEqual({ ok: false, reason: 'bad_signature' })
  })
})
