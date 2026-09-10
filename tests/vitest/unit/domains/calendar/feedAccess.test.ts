import { describe, it, expect } from 'vitest'
import { evaluateFeedAccess, type FeedAccessInput } from '@/src/domains/calendar/feedAccess'

const TODAY = '2026-09-10'
const payload = { id: 'user-1', jti: 'key-abc', m: { school_id: 'school-1' } }
const activeSchool = { status: 'active', access_until: null }

function input(over: Partial<FeedAccessInput> = {}): FeedAccessInput {
  return {
    payload,
    storedKey: 'key-abc',
    profile: { school_id: 'school-1', role: 'ogretmen', schools: activeSchool },
    today: TODAY,
    ...over,
  }
}

describe('evaluateFeedAccess', () => {
  it('geçerli anahtar + aynı okul → öğretmen kapsamı (canManage=false)', () => {
    expect(evaluateFeedAccess(input())).toEqual({
      ok: true, scope: { userId: 'user-1', schoolId: 'school-1', canManage: false },
    })
  })

  it('müdür/MY → canManage=true', () => {
    const r = evaluateFeedAccess(input({ profile: { school_id: 'school-1', role: 'mudur_yardimcisi', schools: activeSchool } }))
    expect(r).toMatchObject({ ok: true, scope: { canManage: true } })
  })

  it('yenilenmiş (farklı) anahtar → not_found (eski bağlantı iptal)', () => {
    expect(evaluateFeedAccess(input({ storedKey: 'key-new' }))).toEqual({ ok: false, reason: 'not_found' })
  })

  it.each([null, undefined, ''])('saklı anahtar yok (%s) → not_found', storedKey => {
    expect(evaluateFeedAccess(input({ storedKey }))).toEqual({ ok: false, reason: 'not_found' })
  })

  it('profil yok → not_found', () => {
    expect(evaluateFeedAccess(input({ profile: null }))).toEqual({ ok: false, reason: 'not_found' })
  })

  it('kullanıcı başka okula geçmiş (token okulu ≠ profil okulu) → not_found', () => {
    const r = evaluateFeedAccess(input({ profile: { school_id: 'school-2', role: 'ogretmen', schools: activeSchool } }))
    expect(r).toEqual({ ok: false, reason: 'not_found' })
  })

  it('token okul bilgisi taşımıyor → not_found', () => {
    expect(evaluateFeedAccess(input({ payload: { id: 'user-1', jti: 'key-abc' } }))).toEqual({ ok: false, reason: 'not_found' })
  })

  it.each([
    [{ status: 'active', access_until: '2026-09-09' }],
    [{ status: 'suspended', access_until: null }],
  ])('abonelik kilitli okul (%j) → locked', schools => {
    expect(evaluateFeedAccess(input({ profile: { school_id: 'school-1', role: 'mudur', schools } }))).toEqual({ ok: false, reason: 'locked' })
  })

  it('okul satırı okunamadı → fail-open (layout ile aynı)', () => {
    const r = evaluateFeedAccess(input({ profile: { school_id: 'school-1', role: 'ogretmen', schools: null } }))
    expect(r).toMatchObject({ ok: true })
  })
})
